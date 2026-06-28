# Sprint 14 Implementation Spec: Generation Endpoints

**Status**: Draft — awaiting PM review
**Sprint Goal**: `POST /generate/candidates` and `POST /generate/comparison` exist, are callable, and write correctly to their respective DB tables. Comparison matrix UI bug fixed. Ready for Sprint 15 to wire the frontend.

---

## 1. Scope

### What changes

| Layer | File | Change |
|---|---|---|
| Frontend | `apps/web/src/hooks/useAgent.ts` | Merge incoming comparison criteria into display state; never replace |
| Backend | `services/api/main.py` | Add `POST /generate/candidates` and `POST /generate/comparison` endpoints |
| Backend | `services/api/agent/generation.py` | New module: `CandidateGenerator` and `ComparisonGenerator` classes |
| Backend | `services/api/agent/utils.py` | New module: shared utility functions (history pruning extracted from orchestrator) |

### What does NOT change

- The `/chat` endpoint interface and orchestrator logic — unchanged
- Agent prompts (`prompt.py`) — unchanged
- `SupabaseSessionManager` methods — unchanged
- All frontend components and UX — no visible behaviour change this sprint
- The new endpoints are not wired to any UI trigger — Sprint 15 handles that
- All constraints from prior sprints (listed in Section 9)

### How a generation endpoint works

The generation endpoints are a different kind of LLM call from `/chat`.

`/chat` runs a multi-turn conversational agent. It maintains history, makes two LLM calls per turn (reason then respond), and the agent simultaneously handles conversation, profile extraction, and content generation.

Each generation endpoint is different in kind. It makes **one focused LLM call** with a purpose-built system prompt, a single forced tool, and no conversational back-and-forth. The LLM does one job and returns a structured result via the tool call.

Every LLM call has two parts that work together:

1. **System prompt** — written instructions to the LLM. Defines its role, what to generate, quality expectations, and field-level guidance. Built dynamically from session data at call time. This is the equivalent of the prompts in `prompt.py` for the conversational agents.

2. **Tool definition** — the schema the LLM must use to return its output. The description field instructs the LLM on what to put in each field. The LLM is forced to call this tool (no free-text response).

Both are specified in detail in Sections 3 and 4. The implementer must write both — they are not optional.

Each generator class follows this pattern:
1. Read required data from DB
2. Build system prompt from session data
3. Call LLM: system prompt + tool definition + forced tool call
4. Parse tool result
5. Write to DB
6. Return updated state

---

## 2. Comparison matrix UI bug fix

**Bug**: The frontend replaces the displayed comparison matrix wholesale with whatever the LLM returns each `/chat` turn. If the LLM returns fewer criteria than previously, those rows disappear from view — even though they exist in the DB.

**Root cause**: `plan.comparison_matrix` is set directly from the API response, replacing prior state.

**Fix**: Merge incoming criteria into the existing displayed state. Existing criteria are never dropped. New criteria are added. A short LLM response never removes rows from the display.

**Where**: `apps/web/src/hooks/useAgent.ts`, in the `/chat` response handler where `comparison_matrix` is applied to state.

**Algorithm**:

```typescript
const mergeComparisonMatrix = (
  existing: ComparisonRow[] | null,
  incoming: ComparisonRow[] | null
): ComparisonRow[] | null => {
  if (!incoming) return existing;
  if (!existing) return incoming;

  const merged = new Map(existing.map(row => [row.criterion, { ...row }]));

  for (const row of incoming) {
    const existingRow = merged.get(row.criterion);
    if (existingRow) {
      merged.set(row.criterion, { ...existingRow, ...row });
    } else {
      merged.set(row.criterion, row);
    }
  }

  return Array.from(merged.values());
};
```

Applied when `plan.comparison_matrix` is updated from a `/chat` response. Not called on initial load.

**Sprint 15 note**: When the comparison display is driven by `/generate/comparison` directly rather than `/chat` responses, this logic is no longer on the `/chat` code path. It is deleted in Sprint 15 — not left as dead code.

---

## 3. `POST /generate/candidates`

### 3.1 Request

```json
{ "session_id": "uuid" }
```

### 3.2 Backend flow

1. Read from DB via `session_manager.get_session()`:
   - Trip profile
   - All candidates — build two sets:
     - **Rejected**: `{name, rejection_reason}` pairs — never re-suggest
     - **Active names**: names of all `suggested` and `shortlisted` candidates — avoid duplicating
2. Read and prune conversation history using `filter_history` + `prune_history` from `utils.py` (see Section 5)
3. Build system prompt from session data (see 3.3)
4. Call LLM: system prompt + pruned history as messages + `suggest_candidates` tool, forced (see 3.4 and 3.5)
5. Parse tool result: list of `{name, region, vibe}`
6. For each returned candidate: resolve photo via Unsplash (same logic as current orchestrator); fall back to placeholder on failure
7. Write to DB: upsert each candidate by `(session_id, lower(name))`; write `name`, `region`, `vibe`, `photo_url`, `status = 'suggested'`; never touch candidates with `status = 'shortlisted'` or `'rejected'`
8. Return full candidate list from DB post-write (see 3.6)

### 3.3 System prompt

Built at call time by `CandidateGenerator._build_prompt(profile, rejected, active_names)`. The template below uses `{placeholders}` for dynamic values injected from session data.

```
You are an expert travel consultant. Given a traveler's profile and planning session,
your job is to suggest the 3 best-matching destination candidates they have not yet seen.

## Traveler Profile
Origin: {origin or "not specified"}
Travelers: {travelers or "not specified"}
When: {when or "not specified"}
Duration: {duration or "not specified"}
Budget: {budget or "not specified"}
Vacation type: {vacation_type as comma-separated list, or "not specified"}
Likes: {likes as comma-separated list, or "none recorded"}
Avoid: {avoid as comma-separated list, or "none recorded"}

## Already Visible Destinations
The traveler can already see these destinations on screen — do not suggest them: {active_candidate_names as a bullet list; "None yet" if empty}

## Rejected Destinations
The traveler has explicitly removed these — do not suggest them under any circumstances: {rejected candidates as bullet list: "- {name}: {rejection_reason}"; "None" if empty}

## Your Task
Suggest the 3 best-matching destination candidates this traveler has not yet seen.

Selection rules:
- Budget and timing are constraints, not loose suggestions.
- Respect the hard profile constraints. e.g. A traveler flying from {origin} for {duration} should not receive long-haul destinations that are not realistic given the time available.
- Choose destinations that fit the full profile — not just vacation type and likes, but all of it together.
- If the recent conversation contains preferences or constraints not yet captured in the profile fields above, factor them in alongside the existing profile fields.
- Do not suggest any destination that appears in the "Already Visible" or "Rejected" lists above.

For each destination, provide:
- name: the destination name only (city, region, or country — whichever level is most meaningful for the traveler)
- region: if a city or area, use its country (e.g. "Spain" for Basque Country, "Italy" for Amalfi Coast). If a country, use a broader geographic grouping (e.g. "Mediterranean" for Malta, "South Asia" for Sri Lanka).
- vibe: 1-sentence description of what this destination is like and famous for — its character and atmosphere (e.g. 'a laid-back island with whitewashed villages and volcanic beaches').
```

**Conversation history**: The pruned history is passed as the message array following the system prompt — user and assistant messages only, tool messages stripped (same as the current orchestrator). The LLM sees recent conversation as context for nuance not yet extracted into the structured profile. Its only output is the tool call.

### 3.4 Tool definition

```python
TOOL_SUGGEST_CANDIDATES_GENERATION = {
    "type": "function",
    "function": {
        "name": "suggest_candidates",
        "description": (
            "Suggest exactly 3 new destination candidates the traveler has not yet seen. "
            "Choose the best matches for this specific traveler given their full profile "
            "and the constraints listed. Each candidate must have a name, region, and a "
            "vibe."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "candidates": {
                    "type": "array",
                    "minItems": 3,
                    "maxItems": 3,
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {
                                "type": "string",
                                "description": "Destination name only — no country suffix.",
                            },
                            "region": {
                                "type": "string",
                                "description": (
                                    "If a city or area, use its country "
                                    "(e.g. 'Spain' for Basque Country). "
                                    "If a country, use a broader geographic grouping "
                                    "(e.g. 'Mediterranean' for Malta)."
                                ),
                            },
                            "vibe": {
                                "type": "string",
                                "description": (
                                    "1-sentence description of what this destination is like and famous for — its character and atmosphere."
                                ),
                            },
                        },
                        "required": ["name", "region", "vibe"],
                    },
                }
            },
            "required": ["candidates"],
        },
    },
}
```

Flat JSON only — no `additionalProperties`.

### 3.5 LLM call

```python
messages = [{"role": "system", "content": system_prompt}] + pruned_history

response = client.chat.completions.create(
    model=settings.GROQ_PRIMARY_MODEL,
    messages=messages,
    tools=[TOOL_SUGGEST_CANDIDATES_GENERATION],
    tool_choice={"type": "function", "function": {"name": "suggest_candidates"}},
)
```

Rate limit fallback: catch 429, retry on `settings.GROQ_FALLBACK_MODEL` (same pattern as `_call_llm` in orchestrator).

Tool names must not appear in the system prompt text (existing constraint: agent fails when given tool names in instructions).

### 3.6 Response

```json
{
  "candidates": [
    {
      "name": "string",
      "region": "string",
      "vibe": "string",
      "photo_url": "string",
      "status": "suggested",
      "trip_feel": null,
      "seasonal_note": null,
      "rejection_reason": null
    }
  ]
}
```

Returns the **full candidate list from DB** post-write — all candidates for this session, not just newly added ones. This is the format Sprint 15 needs; returning it now avoids rework.

---

## 4. `POST /generate/comparison`

### 4.1 Request

```json
{ "session_id": "uuid" }
```

### 4.2 Backend flow

1. Read from DB:
   - Trip profile
   - Shortlisted candidates: `name`, `vibe`, `region` (LLM context); `trip_feel`, `seasonal_note` (to identify what needs generating)
   - All `comparison_criteria` rows for this session: `criterion_name`, `candidate_name`, `value`
   - Conversation history, pruned using `filter_history` + `prune_history` from `utils.py`
2. Determine what is missing:
   - **Missing cells**: `(criterion_name, candidate_name)` pairs where `value IS NULL`
   - **Missing enrichments**: shortlisted candidates where `trip_feel IS NULL` or `seasonal_note IS NULL`
   - **Existing criterion names**: distinct `criterion_name` values across all rows (passed to LLM for naming consistency when filling gaps)
3. If nothing is missing — all cells populated, all enrichments set — return current state immediately with no LLM call
4. Build system prompt from session data (see 4.3)
5. Call LLM: system prompt + `generate_comparison` tool, forced (see 4.4 and 4.5)
6. Write to DB (see 4.6)
7. Return response (see 4.7)

### 4.3 System prompt

Built at call time by `ComparisonGenerator._build_prompt(...)`. The prompt has one conditional block that adapts based on whether criteria already exist. Everything else is fixed.

```
You are an expert travel consultant helping a traveler decide between their shortlisted destinations. Your job is to populate a comparison table using what matters most to the user — so they can see, side by side, how their options stack up on the things they actually care about.

## Traveler Profile
Origin: {origin or "not specified"}
Travelers: {travelers or "not specified"}
When: {when or "not specified"}
Duration: {duration or "not specified"}
Budget: {budget or "not specified"}
Vacation type: {vacation_type as comma-separated list, or "not specified"}
Likes: {likes as comma-separated list, or "none recorded"}
Avoid: {avoid as comma-separated list, or "none recorded"}

## Shortlisted Destinations
{for each shortlisted candidate:}
- {name} ({region})

## Comparison Table

{--- BLOCK A: rendered when comparison_criteria table has zero rows for this session ---}
No criteria exist yet. Generate a comparison table from scratch.

Choose 5–7 criteria that are genuinely useful for THIS traveler's decision. Ground them in the profile above — the best criteria reflect what this traveler actually cares about. A "Best suited for" row (e.g. "Couples seeking culture and food", "Active families") is a strong opening criterion. "Weather" and "Getting Around" are acceptable starting points, but at least half the criteria should be specific to this trip and this profile.

For each criterion, provide a short value for every shortlisted destination — 1–2 sentences at most, at a consistent level of detail between all destinations.
{--- END BLOCK A ---}

{--- BLOCK B: rendered when at least one comparison_criteria row exists ---}
The comparison table already uses these criteria. Use the EXACT same names — do not rename, rephrase, or introduce new criteria:
{existing_criterion_names as a numbered list}

Fill values only for the following missing cells:
{missing cells listed as: "- {criterion_name} / {candidate_name}"}

Use the same level of detail and tone as the values already in the table — 1–2 sentences at most, at a consistent level of detail between all destinations.
{--- END BLOCK B ---}

{--- ENRICHMENT BLOCK: rendered only when at least one shortlisted candidate has trip_feel IS NULL or seasonal_note IS NULL ---}
## Destination Enrichments

For each destination listed below, provide trip_feel and seasonal_note. Only destinations in this list need enrichment — do not provide these fields for destinations not listed here.

{shortlisted candidates where trip_feel IS NULL or seasonal_note IS NULL, listed as: "- {name}"}

For each listed destination:
- trip_feel: What would THIS traveler's experience here actually feel like, given their
  specific profile and how they think about vacations? Think about their travel style, companions, budget, and what they have said they value. This is personal — it is not a general description of the destination. Do not repeat or paraphrase the vibe.
- seasonal_note: What is this destination like during {when}? Focus on what is relevant to a traveler — weather, crowd levels, local events, anything time-specific.
{--- END ENRICHMENT BLOCK ---}

{--- NO-ENRICHMENT LINE: rendered only when no candidates need enrichment ---}
No destination enrichments are needed this call — return an empty candidate_enrichments array.
{--- END NO-ENRICHMENT LINE ---}
```

**`vibe` is intentionally excluded from the Shortlisted Destinations section.** The existing compare agent strips `vibe` from candidates before passing them to the LLM (`_clean_candidates_for_prompt` in `prompt.py`, compare/decision mode). The same reasoning applies here: showing `vibe` to the LLM when it needs to write `trip_feel` causes it to anchor on the vibe text and produce a near-copy. `name` and `region` are sufficient for the LLM to reason about the destination for both criteria generation and enrichment. Do not add `vibe` back.

**Conversation history** is passed as the message array following the system prompt — same pruning as the candidates endpoint (user and plain assistant messages only, tool messages stripped). Profile extraction is imperfect; a user who said "my partner has dietary restrictions" or "I need somewhere with good infrastructure" three turns ago deserves to have that influence the criteria the endpoint generates.

### 4.4 Tool definition

One tool covers both cases — generate from scratch and fill gaps. The prompt controls what the LLM generates; the application layer controls what gets written to DB.

```python
TOOL_GENERATE_COMPARISON = {
    "type": "function",
    "function": {
        "name": "generate_comparison",
        "description": (
            "Populate the comparison table and destination enrichments as instructed. "
            "If generating criteria from scratch, choose criteria grounded in this "
            "specific traveler's profile. If filling gaps, use the exact criterion "
            "names provided — do not rename or add new ones. "
            "Provide trip_feel and seasonal_note only for destinations listed in the "
            "enrichment section."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "criteria": {
                    "type": "array",
                    "description": (
                        "Comparison criteria with values for each destination. "
                        "Each criterion has a name and one value per shortlisted candidate."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "criterion_name": {
                                "type": "string",
                                "description": "The criterion label (e.g. 'Best time to go'). Must match existing names exactly when filling gaps.",
                            },
                            "values": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "candidate_name": {"type": "string"},
                                        "value": {
                                            "type": "string",
                                            "description": "Short, comparable value — 1–2 sentences, consistent detail level across all destinations.",
                                        },
                                    },
                                    "required": ["candidate_name", "value"],
                                },
                            },
                        },
                        "required": ["criterion_name", "values"],
                    },
                },
                "candidate_enrichments": {
                    "type": "array",
                    "description": "trip_feel and seasonal_note for destinations that need them. Only include destinations listed in the enrichment section of the prompt.",
                    "items": {
                        "type": "object",
                        "properties": {
                            "candidate_name": {"type": "string"},
                            "trip_feel": {
                                "type": "string",
                                "description": "How THIS traveler is expected to experience this destination. It is NOT not a description of the location - it is a description of the kind of trip that this user would have in this location.",
                            },
                            "seasonal_note": {
                                "type": "string",
                                "description": "What this destination is like during the traveler's planned travel period.",
                            },
                        },
                        "required": ["candidate_name", "trip_feel", "seasonal_note"],
                    },
                },
            },
            "required": ["criteria", "candidate_enrichments"],
        },
    },
}
```

Flat JSON only — no `additionalProperties`.

### 4.5 LLM call

```python
messages = [{"role": "system", "content": system_prompt}] + pruned_history

response = client.chat.completions.create(
    model=settings.GROQ_PRIMARY_MODEL,
    messages=messages,
    tools=[TOOL_GENERATE_COMPARISON],
    tool_choice={"type": "function", "function": {"name": "generate_comparison"}},
)
```

Rate limit fallback: same pattern as orchestrator.

### 4.6 Write behavior (cell-locking enforcement)

**`comparison_criteria`**: Cell-locking is enforced at the application layer — not solely at the SQL layer (supabase-py's upsert does not expose a conditional `WHERE value IS NULL` on conflict).

Before writing, filter the LLM's returned cells against the null-cell set that was passed to the LLM. Only write cells that were in that set:

```python
# null_cells: set of (criterion_name, candidate_name) identified as null in step 2
cells_to_write = []
for criterion in llm_result["criteria"]:
    for cell in criterion["values"]:
        key = (criterion["criterion_name"], cell["candidate_name"])
        if key in null_cells:
            cells_to_write.append({
                "session_id": session_id,
                "criterion_name": criterion["criterion_name"],
                "candidate_name": cell["candidate_name"],
                "value": cell["value"],
            })

# Upsert only the filtered cells
supabase.table("comparison_criteria").upsert(
    cells_to_write,
    on_conflict="session_id,criterion_name,candidate_name",
).execute()
```

If the LLM returns a cell it was not asked to fill, it is silently dropped before reaching the DB. This makes cell-locking a hard guarantee regardless of LLM behaviour.

**`candidates` — `trip_feel` / `seasonal_note`**: Update only where the field is currently null. Execute one update per field per candidate:

```sql
UPDATE candidates
SET trip_feel = :value
WHERE session_id = :session_id
  AND lower(name) = lower(:candidate_name)
  AND trip_feel IS NULL
```

Same pattern for `seasonal_note`. Never overwrite an already-populated value.

**Known carry-forward**: After Sprint 14, `save_session` still writes to `comparison_criteria` when the conversational agent fires `TOOL_GENERATE_COMPARISON_MATRIX` via chat. This can overwrite a cell value that `/generate/comparison` already filled. It cannot delete rows (upsert-never-delete is enforced at the DB level). Full resolution is Sprint 16: removing the tool from the compare agent makes `/generate/comparison` the sole writer.

### 4.7 Response

```json
{
  "comparison_matrix": [
    {
      "criterion": "string",
      "CandidateA": "string",
      "CandidateB": "string"
    }
  ],
  "candidates": [
    {
      "name": "string",
      "trip_feel": "string",
      "seasonal_note": "string"
    }
  ]
}
```

`comparison_matrix` is the full matrix from DB post-write (shortlisted candidates only), reconstructed into the flat in-memory format the frontend already expects — see Section 7.1 for the conversion. `candidates` contains all shortlisted candidates with `trip_feel` and `seasonal_note` populated.

Returns the full updated state now, not a success stub — Sprint 15 wiring will be complex and the API contract should be finalized and testable before that sprint begins.

---

## 5. New modules

### `services/api/agent/generation.py`

Both generator classes live here — separate from `session.py` (state management) and `orchestrator.py` (conversational loop):

| Module | Responsibility |
|---|---|
| `session.py` | DB reads and writes |
| `orchestrator.py` | Conversational ReAct loop |
| `generation.py` | Focused, stateless LLM generation calls |

**`CandidateGenerator`**:
- Constructor: `SupabaseSessionManager`, Groq client
- `_build_prompt(profile, rejected, active_names) -> str`: builds system prompt
- `generate(session_id: str) -> dict`: full read → prompt → LLM → write → return flow

**`ComparisonGenerator`**:
- Constructor: `SupabaseSessionManager`, Groq client
- `_build_prompt(profile, shortlisted, existing_criteria, missing_cells, missing_enrichments) -> str`: builds system prompt, selecting Block A or Block B for the criteria section
- `generate(session_id: str) -> dict`: full flow

Both instantiated once at startup in `main.py`.

The tool definitions (`TOOL_SUGGEST_CANDIDATES_GENERATION`, `TOOL_GENERATE_COMPARISON`) are module-level constants in `generation.py`, following the same pattern as the tool constants in `orchestrator.py`.

### `services/api/agent/utils.py`

New module containing shared utility functions. Extracts the history-pruning logic currently private to `AgentOrchestrator`:

```python
MAX_HISTORY_TURNS = 5  # Keep in sync with orchestrator.py

def filter_history(history: list) -> list:
    """Strip tool messages — keep only user and plain assistant text messages."""
    return [
        m for m in history
        if m.get("role") != "tool" and not m.get("tool_calls")
    ]

def prune_history(history: list) -> list:
    """All user messages kept; assistant replies kept for last MAX_HISTORY_TURNS turns only."""
    filtered = filter_history(history)
    user_indices = [i for i, m in enumerate(filtered) if m.get("role") == "user"]
    if len(user_indices) <= MAX_HISTORY_TURNS:
        return filtered
    cutoff = user_indices[-MAX_HISTORY_TURNS]
    return [m for i, m in enumerate(filtered) if m.get("role") == "user" or i >= cutoff]
```

`orchestrator.py` is updated to call these functions in place of its private `_filter_history` / `_prune_history` methods. No behavioural change.

---

## 6. `services/api/main.py` additions

```python
from agent.generation import CandidateGenerator, ComparisonGenerator

candidate_generator = CandidateGenerator(session_manager, groq_client)
comparison_generator = ComparisonGenerator(session_manager, groq_client)

class GenerateRequest(BaseModel):
    session_id: str

@app.post("/generate/candidates")
async def generate_candidates(request: GenerateRequest):
    try:
        return candidate_generator.generate(request.session_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate/comparison")
async def generate_comparison(request: GenerateRequest):
    try:
        return comparison_generator.generate(request.session_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Both endpoints return 404 if the session does not exist (raised from `get_session`).

---

## 7. Data reference

### 7.1 Comparison matrix: tool output → DB → API response

**Tool output** (`generate_comparison` result):
```python
{
  "criteria": [
    {
      "criterion_name": "Best time to go",
      "values": [
        {"candidate_name": "Santorini", "value": "May–Oct"},
        {"candidate_name": "Amalfi Coast", "value": "Apr–Jun"}
      ]
    }
  ]
}
```

**In DB** (`comparison_criteria` table):
```
session_id | criterion_name   | candidate_name | value
<uuid>     | Best time to go  | Santorini      | May–Oct
<uuid>     | Best time to go  | Amalfi Coast   | Apr–Jun
```

**API response / in-memory format** (reconstructed from DB, same as current `get_session` output):
```python
[
  {"criterion": "Best time to go", "Santorini": "May–Oct", "Amalfi Coast": "Apr–Jun"}
]
```

The `get_session` method in `session.py` already performs this reconstruction. The `/generate/comparison` response reads from DB post-write and uses the same reconstruction logic.

### 7.2 `trip_feel` and `seasonal_note` — where they live

Both fields live on the `candidates` table, not in `comparison_criteria`. Generated by `/generate/comparison` because:
- Only 2–4 of up to 15 suggested candidates typically get shortlisted
- Generating them at candidate-suggestion time produces content for destinations the user never compares

---

## 8. End-to-end verification checklist

### How verification works

Phases B–G require calling the new endpoints directly — outside the app UI. The PM will do this alongside the coding agent during the verification run. The coding agent is responsible for providing exact curl commands (or Postman instructions) at the time of testing, using the real session ID from Phase A. The session ID is captured once and reused across all phases.

The coding agent should not mark implementation complete until all phases below have been verified with the PM.

### Verification tools

- **Running app**: both backend (`uvicorn`) and frontend (`npm run dev`) must be running
- **Supabase Table Editor**: used to inspect DB state after each endpoint call — open the project in the Supabase dashboard and check the relevant table directly
- **curl or Postman**: used to call the generation endpoints. The coding agent will provide the exact command at testing time.

---

**Phase A — Comparison matrix UI fix** *(use the app UI)*
- [ ] Run a full compare-mode session via the app — get to Compare phase with 4+ criteria visible
- [ ] Send a follow-up chat message that causes the agent to regenerate the matrix with fewer criteria
- [ ] Verify: all 4+ criteria remain visible in the UI — none disappear
- [ ] Verify: updated rows reflect the new values; preserved rows are unchanged
- [ ] **Copy the session ID from this session** — it will be used for Phases B–G

**Phase B — `/generate/candidates` (first call)** *(coding agent provides curl command)*
- [ ] Call `POST /generate/candidates` with the session ID from Phase A
- [ ] Verify: 200 response; `candidates` array in the response contains 3 new destinations
- [ ] Verify in Supabase `candidates` table: new rows present with `status = 'suggested'`; shortlisted/rejected rows untouched
- [ ] Verify: `photo_url` is populated (or fallback placeholder) for each new candidate

**Phase C — `/generate/candidates` (repeat call)** *(coding agent provides curl command)*
- [ ] Call the same endpoint again on the same session
- [ ] Verify in Supabase: no duplicate rows created; existing suggested candidates updated in place or new ones added
- [ ] Verify: shortlisted candidates remain untouched

**Phase D — `/generate/comparison` (no criteria yet)** *(use a fresh session or clear criteria rows; coding agent advises)*
- [ ] Ensure the session has 2–3 shortlisted candidates and no existing `comparison_criteria` rows
- [ ] Call `POST /generate/comparison` with the session ID
- [ ] Verify: 200 response; `comparison_matrix` in the response contains 5–7 criteria with values for all shortlisted candidates
- [ ] Verify in Supabase `comparison_criteria` table: one row per (criterion × candidate) pair, all values populated
- [ ] Verify in Supabase `candidates` table: shortlisted candidates now have `trip_feel` and `seasonal_note` set

**Phase E — `/generate/comparison` (fill gaps — new shortlisted candidate)** *(use the app UI, then curl)*
- [ ] Add a new candidate to the shortlist via the app; confirm in Supabase it has no `comparison_criteria` rows and no `trip_feel`/`seasonal_note`
- [ ] Call `POST /generate/comparison` again
- [ ] Verify in Supabase `comparison_criteria`: only the new candidate's cells were written; existing cells for other candidates are unchanged
- [ ] Verify in Supabase `candidates`: new candidate's `trip_feel` and `seasonal_note` are set; other candidates' values unchanged

**Phase F — Cell-locking: populated values not overwritten** *(coding agent advises)*
- [ ] Note the exact value of one populated cell in Supabase (e.g. the "Best time to go" row for one candidate)
- [ ] Call `POST /generate/comparison` again on the same session
- [ ] Verify in Supabase: that cell's value is unchanged

**Phase G — Nothing missing: no LLM call** *(coding agent advises)*
- [ ] Call `POST /generate/comparison` on the fully-populated session
- [ ] Verify: response is fast (no LLM call); no Groq request appears in the backend server logs

---

## 9. Constraints carried forward

All constraints from Sprints 1–13 are preserved. New constraints this sprint:

1. **Generation endpoints are not wired to any UI trigger** — endpoints exist and are verified; Sprint 15 connects them.
2. **Cell-locking under `/chat` is not enforced** — `save_session` can still overwrite `comparison_criteria` values when the conversational agent fires `TOOL_GENERATE_COMPARISON_MATRIX`. Known, accepted constraint until Sprint 16.
3. **`/generate/comparison` generates criteria from the LLM on first call** — when no criteria exist, the LLM defines them. On subsequent calls, existing criterion names are passed to enforce naming consistency.
4. **Comparison matrix UI merge is temporary** — `mergeComparisonMatrix` in Section 2 is deleted in Sprint 15, not left in place.
