# Sprint 13 Implementation Spec: Session Persistence Migration

**Status**: Draft — awaiting PM review  
**Sprint Goal**: Replace in-memory `SessionManager` with Supabase reads and writes. The `/chat` endpoint behaviour is unchanged from the user's perspective. Ready for Sprint 14 to add generation endpoints.

---

## 1. Scope

### What changes

| Layer | File | Change |
|---|---|---|
| Backend | `requirements.txt` | Add `supabase>=2.0.0` |
| Backend | `services/api/core/config.py` | Add Supabase env vars to Settings |
| Backend | `services/api/agent/models.py` | Delete unused `notes` field from `VacationPlan` |
| Frontend | `apps/web/src/types.ts` | Remove `notes` from `VacationPlan` type |
| Frontend | `apps/web/src/App.tsx` | Remove `notes: ''` from `defaultPlan` |
| Backend | `services/api/agent/session.py` | Replace `SessionManager` with `SupabaseSessionManager` |
| Backend | `services/api/main.py` | Add `POST /sessions` endpoint; switch to `SupabaseSessionManager` |
| Frontend | `apps/web/src/hooks/useAgent.ts` | Replace client-side random ID; expose `createSession()` |
| Frontend | `apps/web/src/App.tsx` | Make `handleStartSession` async; call `createSession()` at click time |

### What does NOT change

- `PrototypeSessionManager` stays in-memory (locked Sprint 3 demo, out of scope)
- All agent orchestration logic (`orchestrator.py`, `prompt.py`)
- All frontend components and UX — no visible behaviour change
- The `/chat` endpoint interface (request/response models are unchanged)
- All constraints from prior sprints (listed in Section 9)

---

## 2. No schema migration required

The five-table schema from Sprint 12 (`supabase/schema.sql`) is already live in Supabase. No DDL changes are needed for this sprint. The candidate write strategy (fetch-then-upsert by PK) requires no new unique indexes — see Section 4.2.4 for details.

---

## 3. Dependency

Add to `requirements.txt`:

```
supabase>=2.0.0
```

The `supabase-py` v2 package provides the synchronous `create_client` and `Client` used throughout `SupabaseSessionManager`. The sync client is appropriate here — the existing codebase uses synchronous Groq calls in the same FastAPI async endpoints.

---

## 4. Backend changes

### 4.1 `services/api/core/config.py`

Add three fields to `Settings`. They are already present in `.env`; this step makes them available via `settings.*`.

```python
SUPABASE_URL: str = ""
SUPABASE_ANON_KEY: str = ""
SUPABASE_SERVICE_ROLE_KEY: str = ""
```

The `SupabaseSessionManager` uses `SUPABASE_SERVICE_ROLE_KEY`. RLS is disabled — the service role key bypasses it entirely, as agreed in Sprint 12.

---

### 4.2 `services/api/agent/session.py`

Remove `SessionManager`. Add `SupabaseSessionManager` with three public methods: `create_session`, `get_session`, `save_session`. `PrototypeSessionManager` is kept unchanged.

#### 4.2.1 Supabase client

The client is initialised once at instantiation and reused:

```python
from supabase import create_client, Client
from core.config import settings

class SupabaseSessionManager:
    def __init__(self):
        self.supabase: Client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY,
        )
```

#### 4.2.2 `create_session() -> str`

Inserts a new row into `sessions` (no fields required — `id` defaults to `gen_random_uuid()`, `mode` defaults to `'explore'`). Returns the new UUID string.

```
INSERT INTO sessions DEFAULT VALUES → returns id
```

No `trip_profile` row is pre-created; it is written on the first `save_session` call via upsert.

#### 4.2.3 `get_session(session_id: str) -> Session`

Reads all five tables and reconstructs a `Session` object. If the `sessions` row does not exist, raises `HTTPException(404)`.

**Step 1 — `sessions` row:**
```
SELECT * FROM sessions WHERE id = session_id
→ mode, selected_winner
```

**Step 2 — `trip_profile` row** (may be absent before first save):
```
SELECT * FROM trip_profile WHERE session_id = session_id
→ origin, travelers, travel_when, duration, budget,
   vacation_type[], likes[], avoid[]
```
Reconstruct `TripProfile`. Field mapping: DB `travel_when` → Python `TripProfile.when`. If no row exists, return an empty `TripProfile`.

**Step 3 — `candidates`:**
```
SELECT * FROM candidates WHERE session_id = session_id
```
Reconstruct each row as a `DestinationCandidate`. All columns map directly; no field renaming.

**Step 4 — `comparison_matrix` reconstruction:**
```
SELECT * FROM comparison_criteria WHERE session_id = session_id
```
Reconstruct as `Optional[List[dict]]` — the in-memory format used by the orchestrator and frontend.

- Build a dict keyed by `criterion_name`.
- For each row, include only candidates whose `status == 'shortlisted'` (case-insensitive `lower(candidate_name)` match against the shortlisted set derived from Step 3).
- Each dict entry: `{"criterion": criterion_name, "CandidateName": value, ...}`.
- `None` values for a cell: omit the key (missing cells are populated by the comparison agent on the next turn).
- If no rows remain after filtering, set `comparison_matrix = None`.

**Step 5 — `conversation_history`:**
```
SELECT message FROM conversation_history
WHERE session_id = session_id
ORDER BY position ASC
```
Return `[row['message'] for row in result]` — the raw Groq API message dicts, in order.

**Return:** `Session(id=session_id, history=history, plan=VacationPlan(...))`

#### 4.2.4 `save_session(session: Session)`

Writes all five tables. Full write on every call — no partial/targeted writes in this sprint.

**Table 1 — `sessions` (upsert):**
```
UPSERT {id, mode, selected_winner}
ON CONFLICT (id) DO UPDATE
```

**Table 2 — `trip_profile` (upsert):**
```
UPSERT {session_id, origin, travelers, travel_when, duration, budget,
        vacation_type, likes, avoid}
ON CONFLICT (session_id) DO UPDATE
```
Field mapping: Python `plan.trip_profile.when` → DB `travel_when`.  
Array fields (`vacation_type`, `likes`, `avoid`) are Python lists; supabase-py serialises them to PostgreSQL arrays automatically.

**Table 3 — `candidates` (DB-sync: fetch, then insert/update/delete as needed):**
```
SELECT id, name FROM candidates WHERE session_id = session_id
→ build dict: {lower(name) → id}   (db_candidates)

FOR each candidate in plan.candidates:
  IF lower(candidate.name) in db_candidates:
    UPDATE candidates SET ... WHERE id = db_candidates[lower(name)]
  ELSE:
    INSERT INTO candidates (session_id, name, ...) VALUES (...)

FOR each name in db_candidates NOT in {lower(c.name) for c in plan.candidates}:
  DELETE FROM candidates WHERE id = db_candidates[name]
```

The goal is to make the DB exactly reflect `plan.candidates` — no more, no less.

**Why not delete-and-reinsert?** Nuke-and-rebuild is destructive by default: if the INSERT step fails partway through, the DB is left in an empty or partial state. Sprint 14's `/generate/candidates` endpoint will also write candidates directly to the DB; if `save_session` then deletes everything before reinserting from in-memory state, those DB-direct writes are silently wiped.

**Why not "never delete"?** Candidates can and do disappear from `plan.candidates` in the existing Python code — specifically when a user un-rejects a destination, `main.py` removes it from the plan so the agent can re-suggest it fresh. If we never delete from the DB, that candidate would survive to the next `get_session` and reappear as if it was never removed. That is a bug, not a feature.

**Why the sync approach is correct:** It faithfully persists the Python state without destroying data unnecessarily. Sprint 14's generation-endpoint candidates survive because `get_session` loads them into `plan.candidates` first; the sync then sees them as present and updates rather than deletes them.

**Table 4 — `comparison_criteria` (upsert, never delete):**
```
FOR each row in plan.comparison_matrix:
  criterion = row['criterion']
  FOR each key/value where key != 'criterion':
    UPSERT {session_id, criterion_name=criterion, candidate_name=key, value=value}
    ON CONFLICT (session_id, criterion_name, candidate_name) DO UPDATE SET value = EXCLUDED.value
```
Rows the LLM omits in a given turn are left untouched in the DB. This is already an improvement on today's in-memory behaviour where omitted rows disappear entirely.  
If `plan.comparison_matrix` is `None` or `[]`, skip this step.

**Table 5 — `conversation_history` (insert, conflict = ignore):**
```
FOR i, message in enumerate(session.history):
  INSERT {session_id, position=i, message=message}
  ON CONFLICT (session_id, position) DO NOTHING
```
Using `ignore_duplicates=True` on the upsert. Conversations are append-only; previously written turns are safe to re-send (they silently no-op). Only new tail messages get inserted.

Note on history pruning: `_prune_history` in the orchestrator produces a temporary local list used only for the LLM call — it never modifies `session.history` itself. The full, growing history is always what `save_session` receives, so DB positions are always a stable 0-indexed sequence of the complete conversation. Pruning affects what the model sees on each turn; it has no effect on what is stored.

---

### 4.3 `services/api/main.py`

**Change 1 — swap the session manager singleton:**

```python
# Remove:
from agent.session import session_manager, prototype_session_manager

# Replace session_manager only:
from agent.session import SupabaseSessionManager, prototype_session_manager
session_manager = SupabaseSessionManager()
```

`prototype_session_manager` import and usage is unchanged.

**Change 2 — add `POST /sessions` endpoint:**

```python
class SessionCreateResponse(BaseModel):
    session_id: str

@app.post("/sessions", response_model=SessionCreateResponse)
async def create_session():
    try:
        session_id = session_manager.create_session()
        return SessionCreateResponse(session_id=session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

This is the only endpoint the frontend calls to initiate a session. The `POST /chat` endpoint is unchanged — it continues to call `session_manager.get_session(request.session_id)` and `session_manager.save_session(session)`.

---

## 5. Frontend changes

### 5.1 `apps/web/src/hooks/useAgent.ts`

**Change 1 — session ID state:**

Remove the client-side random ID:
```typescript
// Remove:
const [sessionId] = useState(() => Math.random().toString(36).substring(7));

// Replace with:
const [sessionId, setSessionId] = useState<string | null>(null);
```

**Change 2 — expose `createSession()`:**

Add a new async function to the hook and include it in the return value:

```typescript
const createSession = async (): Promise<void> => {
    const res = await fetch('http://localhost:8000/sessions', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to create session');
    const data = await res.json();
    setSessionId(data.session_id);
};
```

Return it alongside the existing exports:
```typescript
return { messages, plan, isLoading, sessionId, uiState, updateUiState, sendMessage, createSession };
```

**Change 3 — `sendMessage` uses `sessionId` directly (no lazy guard):**

`sessionId` will always be set before `sendMessage` is called (see `App.tsx` change below). Replace the existing `sessionId` reference in the `POST /chat` body with `sessionId` — no guard needed. If `sessionId` is somehow null, the request will fail visibly rather than silently creating a second session.

**Why not lazy-init inside `sendMessage`?** The planning doc's reason for the `POST /sessions` endpoint was: "future endpoints can reference the session ID without a chat turn having happened first." Sprint 15 will add generation endpoints (candidate refresh, comparison) triggered directly from the visual space — before any chat message may have been sent. Lazy init inside `sendMessage` means `sessionId` is null until the user types a message, which breaks that assumption. Explicit creation at intent-time (the "Let's get going!" click) means `sessionId` is available from that moment forward, for any caller.

---

### 5.2 `apps/web/src/App.tsx`

**One targeted change** — make `handleStartSession` async and call `createSession()` before `sendMessage`:

```typescript
// Destructure createSession from the hook:
const { messages, plan, isLoading, uiState, updateUiState, sendMessage, createSession } = useAgent();

// Update handleStartSession:
const handleStartSession = async (_path: 'inspire' | 'destinations') => {
    await createSession();
    const initialMessage = sessionStorage.getItem('initialMessage') || 'Tell me about vacation options.';
    const onboardingRaw = sessionStorage.getItem('onboardingProfile');
    const onboardingProfile = onboardingRaw ? JSON.parse(onboardingRaw) : undefined;
    sessionStorage.removeItem('initialMessage');
    sessionStorage.removeItem('onboardingProfile');
    sendMessage(initialMessage, undefined, rejectedCandidates, onboardingProfile);
};
```

No other changes to `App.tsx`.

---

## 6. Data mapping reference

### 6.1 `TripProfile` field mapping

| Python field | DB column | Notes |
|---|---|---|
| `origin` | `origin` | nullable TEXT |
| `travelers` | `travelers` | nullable TEXT |
| `when` | `travel_when` | renamed — `WHEN` is reserved SQL |
| `duration` | `duration` | nullable TEXT |
| `budget` | `budget` | nullable TEXT |
| `vacation_type` | `vacation_type` | `TEXT[] NOT NULL DEFAULT '{}'` |
| `likes` | `likes` | `TEXT[] NOT NULL DEFAULT '{}'` |
| `avoid` | `avoid` | `TEXT[] NOT NULL DEFAULT '{}'` |

### 6.2 Comparison matrix: in-memory ↔ DB

**In-memory (`plan.comparison_matrix`):**
```python
[
    {"criterion": "Best time to go", "Santorini": "May–Oct", "Amalfi Coast": "Apr–Jun"},
    {"criterion": "Getting around",  "Santorini": "ATV / bus", "Amalfi Coast": "Ferry / scooter"},
]
```

**In DB (`comparison_criteria`):**
```
session_id | criterion_name      | candidate_name | value
---------- | ------------------- | -------------- | -----------
<uuid>     | Best time to go     | Santorini      | May–Oct
<uuid>     | Best time to go     | Amalfi Coast   | Apr–Jun
<uuid>     | Getting around      | Santorini      | ATV / bus
<uuid>     | Getting around      | Amalfi Coast   | Ferry / scooter
```

**Write:** each `(criterion, candidate, value)` triple from the in-memory dict becomes one row.  
**Read:** rows grouped by `criterion_name`, filtered to shortlisted candidates, then reassembled to the in-memory dict format.

### 6.3 Conversation history: message formats stored

The JSONB blob for each position is one of these Groq API message dicts:

```python
# User message
{"role": "user", "content": "..."}

# Assistant message with tool calls (Call 1)
{"role": "assistant", "content": "...", "tool_calls": [{"id": "...", "type": "function", "function": {...}}]}

# Tool result
{"role": "tool", "tool_call_id": "...", "content": "{\"status\": \"success\", \"result\": \"...\"}"}

# Plain assistant text reply (Call 2 / no-tool path)
{"role": "assistant", "content": "..."}
```

The full structure — including `tool_calls` arrays and `tool_call_id` — is stored verbatim and returned intact to `run_turn` via `_filter_history` / `_prune_history`.

---

## 7. Session lifecycle: before vs after

### Before (Sprint 12 and earlier)

```
1. LandingScreen "Let's get going!" click
   → App.tsx handleStartSession() reads sessionStorage
   → sendMessage() called
      → sessionId already set (random string, e.g. "a7x3kq")
      → POST /chat {session_id: "a7x3kq", message: "..."}
         → session_manager.get_session("a7x3kq") creates in-memory Session if new
         → agent runs, plan mutated
         → session_manager.save_session(session) updates in-memory dict
         → response returned
```

### After (Sprint 13)

```
1. LandingScreen "Let's get going!" click
   → App.tsx handleStartSession() calls createSession()
      → POST /sessions
         → SupabaseSessionManager.create_session()
            → INSERT INTO sessions DEFAULT VALUES
            → returns UUID (e.g. "f47ac10b-58cc-4372-...")
      → setSessionId(uuid)
   → handleStartSession() reads sessionStorage, calls sendMessage()
      → POST /chat {session_id: "<uuid>", message: "..."}
         → session_manager.get_session("<uuid>") reads from Supabase
         → agent runs, plan mutated
         → session_manager.save_session(session) syncs all 5 Supabase tables
         → response returned
```

---

## 8. End-to-end test checklist

After implementation, verify the following in sequence. Check the Supabase Table Editor after each step.

**Phase A — Session creation**

- [ ] Click "Let's get going!" on the landing screen
- [ ] In Supabase → `sessions` table: one new row with `mode = 'explore'`
- [ ] `selected_winner` is NULL; `created_at` and `updated_at` are set

**Phase B — First chat turn (explore mode)**

- [ ] Send initial message (e.g. "I want to go somewhere warm in September")
- [ ] `trip_profile` row written: `travel_when = 'September'`; other fields as extracted
- [ ] `candidates` rows written: 3 rows, all `status = 'suggested'`; each has `name`, `region`, `vibe`, `photo_url`
- [ ] `conversation_history` rows written: user message at position 0; tool-call assistant at position 1; tool result(s) at subsequent positions; final text reply at last position
- [ ] App UI unchanged from pre-sprint behaviour

**Phase C — Shortlist and candidate update**

- [ ] Add trip profile details manually (UI action)
- [ ] Ask agent to generate new candidates (in chat - it's needed to send the UI changes from manual user edits) (Check for trip profile and candidates updates in Supabase)
- [ ] Shortlist one candidate (UI action)
- [ ] Send a chat message to trigger a new turn
- [ ] `candidates` table: shortlisted candidate has `status = 'shortlisted'`; others remain `'suggested'`

**Phase D — Compare mode**

- [ ] Reject 2 candidates. Remove them from rejected (should disappear from DB on next turn)
- [ ] Shortlist 2–3 candidates; click "Compare shortlist"
- [ ] `sessions` row: `mode` updated to `'compare'`
- [ ] `comparison_criteria` rows written: one row per (criterion × candidate) pair; values populated
- [ ] `candidates` rows: shortlisted candidates have `trip_feel` and `seasonal_note` populated

**Phase E — Comparison criteria upsert (never delete)**

- [ ] Send a follow-up chat in compare mode that prompts adding a new criterion
- [ ] `comparison_criteria`: new criterion rows appended; existing rows unchanged (values not reset)

**Phase F — Decision mode**

- [ ] Click "Choose [destination]"
- [ ] `sessions` row: `mode = 'decision'`, `selected_winner = '<name>'`

**Phase G — Prototype endpoint unaffected**

- [ ] Navigate to `/prototype` (port 5174) and run a chat turn — confirms in-memory prototype session is unaffected

**Phase H — Data persistence (manual)**

- [ ] After a full session, note the session UUID from browser DevTools (Network tab → POST /sessions response)
- [ ] All five tables in Supabase contain correct data for that UUID
- [ ] (Future sprint) Session resume will use this data

---

## 9. Constraints carried forward

All constraints from Sprints 1–12 are preserved. New constraints added this sprint:

1. **`SupabaseSessionManager` uses the service role key** — bypasses RLS. No auth layer is added this sprint.
2. **`save_session` syncs all tables on every call** — no partial or targeted writes. Candidates are synced to match `plan.candidates` exactly (insert new, update changed, delete removed). Comparison criteria are upsert-only (never deleted). Targeted writes — where an endpoint touches only one table — are introduced naturally in Sprint 14 via the generation endpoints.
3. **Comparison criteria: upsert-never-delete** — rows the LLM omits in a turn are left in the DB. A cell value may still be overwritten if the LLM regenerates the matrix. Cell locking (preventing overwrite of populated cells) is a Sprint 14 concern.
4. **Session ID is not persisted to `localStorage`** — a browser refresh still loses the session from the frontend's perspective. Session resume is a future sprint. The DB data persists correctly.
5. **`PrototypeSessionManager` stays in-memory** — the `/chat/prototype` endpoint and `prototype_session_manager` are unchanged.
