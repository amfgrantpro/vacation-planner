# Sprint 13 Final State: Session Persistence Migration

**Status**: Complete  
**Date**: 26th June 2026

This document describes the end of Sprint 13 code state.

---

## 1. Summary

Sprint 13 migrates all session state from server-side Python memory to Supabase. The `SessionManager` is replaced by `SupabaseSessionManager`, which reads and writes across all five tables (sessions, trip_profile, candidates, comparison_criteria, conversation_history) on every turn. A new `POST /sessions` endpoint creates the session row at the moment of user intent ("Let's get going!"), returning a UUID that the frontend stores and passes in all subsequent requests. The `/chat` endpoint behaviour is unchanged from the user's perspective.

Three bugs were found and fixed during live testing: a React state-timing issue causing 422 errors on the first chat turn; a double session creation from rapid button interaction; and a UX regression where un-rejecting a candidate caused it to immediately reappear in the visible candidate grid.

---

## 2. Sprint 12 → Sprint 13: Before vs. After

| Dimension | Sprint 12 (Before) | Sprint 13 (After) |
|---|---|---|
| **Session storage** | Server-side Python dict (`SessionManager`) | Supabase — five tables read/written on every turn |
| **Session ID** | Client-side random string (`Math.random().toString(36).substring(7)`) | UUID from Supabase (`gen_random_uuid()`) via `POST /sessions` |
| **Session creation** | Lazy — `get_session` created an in-memory Session on first `/chat` call | Explicit — `POST /sessions` called at "Let's get going!" click, before first `/chat` |
| **`VacationPlan.notes`** | Dead field present in `models.py` and `types.ts`, never written to | Removed from both |
| **`supabase-py`** | Not installed | `supabase>=2.0.0` added to `requirements.txt` |
| **Supabase env vars** | Present in `.env`, absent from `Settings` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` added to `config.py` |
| **Un-reject UX** | Clicking ↺ kept the candidate hidden — relied on a message having been sent after rejection (which set `status = 'rejected'` on the backend; the status check then excluded the candidate even after un-reject) | Clicking ↺ keeps the candidate hidden unconditionally via `hiddenAfterUnreject` — no longer dependent on whether a message was sent after rejection |
| **Data persistence** | Browser refresh kills session entirely | All session data persists in Supabase; session resume is a future sprint |

---

## 3. Backend Changes

### 3.1 `requirements.txt`

Added:
```
supabase>=2.0.0
```

### 3.2 `services/api/core/config.py`

Added three fields to `Settings`:
```python
SUPABASE_URL: str = ""
SUPABASE_ANON_KEY: str = ""
SUPABASE_SERVICE_ROLE_KEY: str = ""
```

`SupabaseSessionManager` uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely.

### 3.3 `services/api/agent/models.py`

Removed dead field from `VacationPlan`:
```python
notes: str = ""   # removed — never written to, absent from schema.sql
```

### 3.4 `services/api/agent/session.py`

Complete rewrite. `SessionManager` removed. `SupabaseSessionManager` added. `PrototypeSessionManager` kept unchanged.

**`SupabaseSessionManager`** — three public methods:

**`create_session() → str`**: Inserts a bare row into `sessions` (all defaults). Returns the UUID.

**`get_session(session_id) → Session`**: Reads all five tables and reconstructs a `Session`. Raises `HTTPException(404)` if the sessions row does not exist. Field mapping: DB `travel_when` → Python `TripProfile.when`. Comparison matrix is reconstructed from `comparison_criteria` rows filtered to currently-shortlisted candidates only; non-shortlisted candidates' values are preserved in DB but excluded from the reconstructed matrix.

**`save_session(session)`**: Full write on every call.
- `sessions`: upsert on `id`
- `trip_profile`: upsert on `session_id`; Python `plan.trip_profile.when` → DB `travel_when`
- `candidates`: DB-sync — fetch existing `(id, name)` pairs, then insert new, update changed, delete removed. Preserves DB-direct writes from future generation endpoints.
- `comparison_criteria`: upsert on `(session_id, criterion_name, candidate_name)`, never delete. Rows the LLM omits in a turn are left untouched.
- `conversation_history`: upsert with `ignore_duplicates=True` on `(session_id, position)`. Append-only; previously written turns silently no-op.

### 3.5 `services/api/main.py`

**Change 1** — swap the session manager singleton:
```python
from agent.session import SupabaseSessionManager, prototype_session_manager
session_manager = SupabaseSessionManager()
```

**Change 2** — add `POST /sessions` endpoint:
```python
@app.post("/sessions", response_model=SessionCreateResponse)
async def create_session():
    session_id = session_manager.create_session()
    return SessionCreateResponse(session_id=session_id)
```

`prototype_session_manager` import and usage unchanged.

---

## 4. Frontend Changes

### 4.1 `apps/web/src/types.ts`

Removed `notes: string` from `VacationPlan` interface.

### 4.2 `apps/web/src/hooks/useAgent.ts`

- `sessionId` state changed from `useState(() => Math.random()...)` to `useState<string | null>(null)`
- Added `sessionIdRef = useRef<string | null>(null)` — written immediately in `createSession` so `sendMessage` reads the correct UUID before React re-renders
- Added `createSession()`: calls `POST /sessions`, writes UUID to ref and state
- `sendMessage` reads `sessionIdRef.current` (not `sessionId` state) for the request body
- `createSession` included in hook return value

### 4.3 `apps/web/src/App.tsx`

- `createSession` destructured from `useAgent`
- `handleStartSession` made `async`; `await createSession()` called before `sendMessage`
- `sessionStarting` guard added to prevent double session creation on rapid button clicks
- `hiddenAfterUnreject` state added — a client-side name set. Clicking ↺ adds the candidate to this set, removing it from both the Removed tray and the visible grid. The candidate can only reappear if the agent re-suggests it in a future turn, at which point the set entry is cleared by a `useEffect` on `plan`
- `notes: ''` removed from `defaultPlan`
- `useEffect` import added

---

## 5. Known Gaps

1. **BUG — Comparison matrix UI shows LLM output, not DB state**: The goal of this sprint was for UI components to reflect DB values. This is not achieved for the comparison matrix. `plan.comparison_matrix` is replaced wholesale by whatever the LLM sends each turn, and the API response returns that value directly. The DB is correctly append-only, but since the frontend reads from the API response rather than the DB, a partial LLM send overwrites what the user sees — dropping rows that exist in the DB. The in-memory matrix must be merged (not replaced) from LLM output to match DB behaviour. Needs to be fixed in a future sprint before the comparison matrix can be considered correctly migrated.

2. **Session resume not implemented**: The DB preserves all session data correctly across turns, but a browser refresh still loses the session from the frontend's perspective (`sessionId` state is cleared). Session resume (load a prior session by UUID on page load) is deferred to a future sprint.

3. **Prototype frontend non-functional**: `apps/prototype-web` fails to start under Node v24 due to a Vite version incompatibility. This is a pre-existing issue unrelated to Sprint 13. Phase G of the test checklist was skipped. The `/chat/prototype` backend endpoint and `PrototypeSessionManager` are unchanged.

---

## 6. Constraints Carried Forward

All constraints from Sprints 1–12 are preserved. New constraints added this sprint:

1. **`SupabaseSessionManager` uses the service role key** — bypasses RLS. No auth layer added.
2. **`save_session` syncs all tables on every call** — no partial writes. Targeted writes are introduced naturally in Sprint 14 via generation endpoints.
3. **Comparison criteria: upsert-never-delete** — rows the LLM omits are left in DB. Cell values may still be overwritten if the LLM regenerates the matrix. Cell locking is Sprint 14.
4. **Session ID not persisted to `localStorage`** — browser refresh loses the session from the frontend. DB data persists correctly.
5. **`PrototypeSessionManager` stays in-memory** — the `/chat/prototype` endpoint is unchanged.
6. **`hiddenAfterUnreject` is frontend-only** — no backend changes to rejection tracking. The set clears when a candidate leaves `plan.candidates`; the agent remains free to re-suggest un-rejected candidates.

---

## 7. Testing Results

**Phase A — Session creation**: ✅ `POST /sessions` returns UUID; `sessions` row written with `mode = 'explore'`.

**Phase B — First chat turn**: ✅ `trip_profile`, `candidates` (3 rows, all `suggested`), and `conversation_history` (all turns including tool call messages) written correctly. App UI unchanged. 
* PM note: Because Unsplash failed for 2 locations, their image URL is the same generic one.
* PM note: Error logging, as implemented in Sprint 8, was observed for the first time. A first-turn tool-call failed, was re-prompted, and worked successfully.

**Phase C — Shortlist and candidate update**: ✅ Shortlisted candidate shows `status = 'shortlisted'` in DB. New agent suggestions inserted as new rows; existing rows updated in place. Rejected candidates saved as `status = 'rejected'`. Un-rejected candidates deleted from DB on next save. Candidate DB-sync confirmed working across multiple turns with growing candidate set. 
* PM note: The agent suggested a full 3 new candidates each time, but the UI only displays 6 of them. So 9 suggested by agent: 1 is shortlisted, 6 "suggested" show, 2 "suggested" are hidden. Tested: I rejected 2 candidates and the 2 hidden ones appeared without a turn. Success! 

**Phase D — Compare mode**: ✅ `sessions.mode` updated to `'compare'`. `comparison_criteria` rows written (one per criterion × candidate pair). `trip_feel` and `seasonal_note` populated on shortlisted candidates in `candidates` table.

**Phase E — Comparison criteria upsert**: ✅ New criteria appended across two turns (3 → 4 → 7 criteria). Existing rows confirmed present with original values. Verified via conversation_history JSONB that the LLM sent full cumulative sets on all three turns (no partial send in this test run - cannot verify persistence).

**Phase F — Decision mode**: ✅ `sessions.mode = 'decision'`, `selected_winner = 'Prague'`.

**Phase G — Prototype endpoint**: ⏭ Skipped. `apps/prototype-web` non-functional under Node v24 (pre-existing). Backend endpoint and `PrototypeSessionManager` code unchanged.

**Phase H — Data persistence**: ✅ All five tables contain correct data for session UUID `049e6229-a36b-43ad-b760-3fd1c0f98e4b` as verified throughout testing.

---

## 8. Directory Map (Post-Sprint 13)

```
vacation-planner/
├── docs/
│   ├── sprint-13-planning.md
│   ├── sprint-13-spec.md
│   └── sprint-13-result.md              ← THIS FILE
│
├── requirements.txt                      supabase>=2.0.0 added
│
├── services/api/
│   ├── core/config.py                   SUPABASE_URL, SUPABASE_ANON_KEY,
│   │                                    SUPABASE_SERVICE_ROLE_KEY added
│   ├── main.py                          POST /sessions endpoint added;
│   │                                    SupabaseSessionManager instantiated
│   └── agent/
│       ├── models.py                    VacationPlan.notes removed
│       └── session.py                   SessionManager removed;
│                                        SupabaseSessionManager added;
│                                        PrototypeSessionManager unchanged
│
└── apps/web/src/
    ├── types.ts                         VacationPlan.notes removed
    ├── hooks/useAgent.ts                createSession(); sessionIdRef;
    │                                    sessionId: string | null
    └── App.tsx                          handleStartSession async;
                                         createSession() at click;
                                         sessionStarting guard;
                                         hiddenAfterUnreject;
                                         notes removed from defaultPlan
```
