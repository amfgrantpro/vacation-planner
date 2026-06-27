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

### What does NOT change

- The `/chat` endpoint interface and orchestrator logic — unchanged
- Agent prompts (`prompt.py`) — unchanged
- `SupabaseSessionManager` methods — unchanged
- All frontend components and UX — no visible behaviour change this sprint
- The new endpoints are not wired to any UI trigger — Sprint 15 handles that
- All constraints from prior sprints (listed in Section 9)

---

## 2. Comparison matrix UI bug fix

**Bug**: The frontend replaces the displayed comparison matrix wholesale with whatever the LLM returns each `/chat` turn. If the LLM returns fewer criteria than it returned previously, those rows disappear from the user's view — even though the rows exist correctly in the DB.

**Root cause**: `plan.comparison_matrix` is set directly from the API response, replacing prior state.

**Fix**: Merge incoming criteria into the existing displayed state. Existing displayed criteria are never dropped. New criteria from the response are added. No criteria are removed from view by a short LLM response.

**Where**: `apps/web/src/hooks/useAgent.ts`, in the `/chat` response handler where `comparison_matrix` is applied to state.

**Algorithm**:

```typescript
// On receiving new plan from /chat response:
const mergeComparisonMatrix = (
  existing: ComparisonRow[] | null,
  incoming: ComparisonRow[] | null
): ComparisonRow[] | null => {
  if (!incoming) return existing;
  if (!existing) return incoming;

  // Build a map from criterion name to row
  const merged = new Map(existing.map(row => [row.criterion, { ...row }]));

  for (const row of incoming) {
    const existing_row = merged.get(row.criterion);
    if (existing_row) {
      // Update the existing row: add or update destination columns
      merged.set(row.criterion, { ...existing_row, ...row });
    } else {
      // Add new criterion row
      merged.set(row.criterion, row);
    }
  }

  return Array.from(merged.values());
};
```

The merge is applied when `plan.comparison_matrix` is updated from a `/chat` response. The function is not called on initial load (when there is no existing state).

**Sprint 15 note**: When comparison display is driven by `GET /generate/comparison` directly rather than by `/chat` responses, this accumulation logic is no longer on the `/chat` code path and can be removed — it should not be left as dead code.

---

## 3. `POST /generate/candidates`

### 3.1 Request

```json
{ "session_id": "uuid" }
```

### 3.2 Backend flow

1. Read from DB via `session_manager.get_session()` (or targeted reads — see note below):
   - Trip profile
   - All candidates: build three sets —
     - Rejected: `{name, rejection_reason}` pairs → never re-suggest
     - Active names: names of all `suggested` and `shortlisted` candidates → avoid duplicating
2. Read conversation history, pruned using `_prune_history` logic (see implementation note below)
3. Call LLM with focused prompt and single tool schema (see 3.4 and 3.5)
4. Parse tool call result: list of `{name, region, vibe}`
5. For each new candidate, fetch photo from Unsplash (same logic as current agent); fall back to placeholder on failure
6. Write to DB:
   - For each returned candidate: upsert by `(session_id, lower(name))`
   - Status: `suggested`
   - Fields written: `name`, `region`, `vibe`, `photo_url`
   - Candidates with `status = 'shortlisted'` or `'rejected'` are never touched
7. Return response (see 3.6)

**Implementation note on reads**: This endpoint may call `session_manager.get_session()` to reuse existing read logic, or implement targeted reads. Either approach is valid — correctness and simplicity take priority.

**Implementation note on pruning**: `_prune_history` is currently a private method on the orchestrator class. `generation.py` should not import the full orchestrator to call one utility function. The pruning logic should be extracted to `services/api/agent/utils.py` (new file) as a standalone function, and both `orchestrator.py` and `generation.py` import from there. This is a small, contained refactor with no behavioural change.

### 3.3 Prompt design

The prompt focuses on one job only — destination suggestion. It receives:

- The trip profile in structured form (origin, travelers, when, duration, budget, vacation_type, likes, avoid)
- Rejected candidates and their rejection reasons — framed as "do not suggest any of these destinations again, for these reasons"
- Names of all currently suggested and shortlisted candidates — framed as "these destinations are already visible to the user; suggest only new ones"
- Pruned conversation history — preserves nuance not yet formally captured in the profile

It does **not** receive: comparison matrix, mode field, session envelope, or any comparison-related data. These are irrelevant to the candidate suggestion job.

**Candidate count**: Suggest the same default count as the current agent (check current orchestrator/prompt for the target number; preserve it here).

### 3.4 Tool schema

Single tool — the LLM must call it:

```json
{
  "name": "suggest_candidates",
  "description": "Suggest new vacation destination candidates based on the trip profile.",
  "parameters": {
    "type": "object",
    "properties": {
      "candidates": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name":   { "type": "string" },
            "region": { "type": "string" },
            "vibe":   { "type": "string" }
          },
          "required": ["name", "region", "vibe"]
        }
      }
    },
    "required": ["candidates"]
  }
}
```

Flat JSON only — no nested schemas, no `additionalProperties` (Groq drops tools that include it).

### 3.5 LLM call parameters

- Model: same as current orchestrator (check `orchestrator.py`)
- Temperature: appropriate for a creative/generative task — recommendation is to match or slightly raise vs. orchestrator default
- Tool choice: force the LLM to call `suggest_candidates` (Groq: `tool_choice: {"type": "function", "function": {"name": "suggest_candidates"}}`)
- No system prompt tool-name mention (existing constraint: agent fails when given tool names in system prompt)

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

Returns the **full candidate list** from DB post-write (all candidates for this session, not just the newly added ones). This is the format the frontend will need in Sprint 15 — returning it now avoids rework.

> **Decision**: Both endpoints return the full updated state in the format the frontend already uses. Sprint 15 will be complex; the API should be complete and testable before that sprint begins. A `{success: true}` stub would shift real design work into an already-heavy sprint.

---

## 4. `POST /generate/comparison`

### 4.1 Request

```json
{ "session_id": "uuid" }
```

### 4.2 Backend flow

1. Read from DB:
   - Trip profile (for LLM context)
   - Shortlisted candidates: `name`, `vibe`, `region`, `trip_feel`, `seasonal_note`
   - All `comparison_criteria` rows for this session: `criterion_name`, `candidate_name`, `value`
2. Determine what is missing:
   - If no `comparison_criteria` rows exist → **Mode A** (generate from scratch)
   - Otherwise → **Mode B** (fill gaps only)
   - For Mode B: build list of `(criterion_name, candidate_name)` pairs where `value IS NULL`
   - Separately: build list of shortlisted candidates where `trip_feel IS NULL` or `seasonal_note IS NULL`
3. If nothing is missing (all cells populated, all trip_feel/seasonal_note set) → return current state immediately, no LLM call
4. Call LLM with appropriate prompt and tool schema (see 4.4 and 4.5)
5. Write to DB:
   - Upsert returned criteria cells (only cells the LLM returned; populated cells untouched)
   - Update `trip_feel` and `seasonal_note` on `candidates` table where currently null (never overwrite)
6. Return response (see 4.6)

### 4.3 Modes

**Mode A — No criteria yet (first call for this session's comparison)**

- Condition: `comparison_criteria` table has zero rows for this session
- LLM task: generate appropriate criteria for comparing travel destinations, AND fill all cell values for all shortlisted candidates. Also generate `trip_feel` and `seasonal_note` for each shortlisted candidate.
- LLM receives: trip profile + shortlisted candidates (name, vibe, region)

**Mode B — Criteria exist; fill gaps**

- Condition: at least one `comparison_criteria` row exists for this session
- LLM task: fill only the specified missing cells using the existing criterion names (for consistency). Also generate missing `trip_feel` / `seasonal_note` where flagged.
- LLM receives: trip profile + shortlisted candidates (name, vibe, region) + list of existing criterion names + targeted list of `(criterion_name, candidate_name)` pairs with null values
- The LLM does **not** see already-populated cell values. It only knows what is missing. Complexity sits in the DB read and list-construction logic, not in the prompt.

**Why two modes**: on first call, the LLM must decide which criteria to use (no existing criteria to reference). On subsequent calls, the LLM must use the same criterion names for consistency — otherwise it would generate the same concept under a different label, creating duplicate criteria rows.

### 4.4 Tool schemas

**Mode A** — single tool `generate_comparison`:

```json
{
  "name": "generate_comparison",
  "description": "Generate comparison criteria and fill all values for the shortlisted candidates.",
  "parameters": {
    "type": "object",
    "properties": {
      "criteria": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "criterion_name": { "type": "string" },
            "values": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "candidate_name": { "type": "string" },
                  "value":          { "type": "string" }
                },
                "required": ["candidate_name", "value"]
              }
            }
          },
          "required": ["criterion_name", "values"]
        }
      },
      "candidate_enrichments": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "candidate_name":  { "type": "string" },
            "trip_feel":       { "type": "string" },
            "seasonal_note":   { "type": "string" }
          },
          "required": ["candidate_name", "trip_feel", "seasonal_note"]
        }
      }
    },
    "required": ["criteria", "candidate_enrichments"]
  }
}
```

**Mode B** — single tool `fill_comparison_gaps`:

```json
{
  "name": "fill_comparison_gaps",
  "description": "Fill in missing comparison values and any missing candidate enrichments.",
  "parameters": {
    "type": "object",
    "properties": {
      "cells": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "criterion_name":  { "type": "string" },
            "candidate_name":  { "type": "string" },
            "value":           { "type": "string" }
          },
          "required": ["criterion_name", "candidate_name", "value"]
        }
      },
      "candidate_enrichments": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "candidate_name":  { "type": "string" },
            "trip_feel":       { "type": "string" },
            "seasonal_note":   { "type": "string" }
          },
          "required": ["candidate_name", "trip_feel", "seasonal_note"]
        }
      }
    },
    "required": ["cells", "candidate_enrichments"]
  }
}
```

Flat JSON only — no `additionalProperties`.

### 4.5 Write behavior (cell-locking enforcement)

**`comparison_criteria`**: Cell-locking is enforced at the application layer, not solely at the SQL layer.

Before writing, filter the LLM's returned cells against the null-cell set that was passed to the LLM:

```python
# null_cells = set of (criterion_name, candidate_name) pairs identified as null in step 2
# Only write cells that were in the null set — drop anything else the LLM returned
cells_to_write = [
    cell for cell in llm_returned_cells
    if (cell["criterion_name"], cell["candidate_name"]) in null_cells
]
```

Then upsert only those filtered cells:
```
UPSERT {session_id, criterion_name, candidate_name, value}
ON CONFLICT (session_id, criterion_name, candidate_name) DO UPDATE SET value = EXCLUDED.value
```

This makes cell-locking a hard guarantee regardless of LLM behaviour. If the LLM returns a cell it wasn't asked about (hallucination or off-script response), that cell is silently dropped before it reaches the DB — it never gets the chance to overwrite a populated value. The planning doc states "existing populated values are never overwritten" as a hard guarantee; this enforces it.

Note: The SQL `WHERE comparison_criteria.value IS NULL` predicate on the conflict action would achieve the same thing at the DB layer, but `supabase-py`'s upsert method does not expose that condition through its PostgREST interface. Application-layer filtering is the practical equivalent.

**`candidates` — `trip_feel` / `seasonal_note`**: Update only where the field is currently null:
```
UPDATE candidates
SET trip_feel = :value
WHERE session_id = :session_id
  AND lower(name) = lower(:candidate_name)
  AND trip_feel IS NULL
```
Same pattern for `seasonal_note`. Never overwrite an already-populated value.

**Known carry-forward**: After Sprint 14, `save_session` still upserts to `comparison_criteria` whenever the conversational agent fires `TOOL_GENERATE_COMPARISON_MATRIX` via chat. This can overwrite a cell value that `/generate/comparison` already filled. It cannot delete rows (upsert-never-delete is enforced). The full resolution — removing the tool from the compare agent, or replacing it with a call to `/generate/comparison` — is Sprint 16. This is a known, accepted constraint.

### 4.6 Response

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

`comparison_matrix` is the full matrix from DB post-write, shortlisted candidates only, in the in-memory format the frontend already expects. `candidates` contains only shortlisted candidates, with `trip_feel` and `seasonal_note` populated.

> **Decision**: Same as above — return the full matrix and enriched candidates now. See Q1 decision.

---

## 5. New module: `services/api/agent/generation.py`

Both generator classes live here — separate from `session.py` (state management) and `orchestrator.py` (conversational loop). This keeps the responsibilities distinct:

| Module | Responsibility |
|---|---|
| `session.py` | DB reads and writes (session state) |
| `orchestrator.py` | Conversational ReAct loop |
| `generation.py` | Focused, stateless LLM generation calls |

**`CandidateGenerator`**: wraps the `/generate/candidates` flow. Constructor takes a `SupabaseSessionManager` and Groq client. Single public method: `generate(session_id: str) -> list[dict]`.

**`ComparisonGenerator`**: wraps the `/generate/comparison` flow. Same constructor pattern. Single public method: `generate(session_id: str) -> dict`.

Both classes are instantiated once at startup in `main.py`, alongside `session_manager`.

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
        result = candidate_generator.generate(request.session_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate/comparison")
async def generate_comparison(request: GenerateRequest):
    try:
        result = comparison_generator.generate(request.session_id)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Both endpoints return a 404 if the session does not exist (raised from within the generator when `get_session` raises).

---

## 7. Data reference

### 7.1 Comparison matrix: in-memory format ↔ DB ↔ API response

**In-memory / API response format** (unchanged from Sprint 13):
```python
[
    {"criterion": "Best time to go", "Santorini": "May–Oct", "Amalfi Coast": "Apr–Jun"},
    {"criterion": "Getting around",  "Santorini": "ATV / bus", "Amalfi Coast": "Ferry / scooter"},
]
```

**In DB** (`comparison_criteria`):
```
session_id | criterion_name   | candidate_name | value
---------- | ---------------- | -------------- | -----------
<uuid>     | Best time to go  | Santorini      | May–Oct
<uuid>     | Best time to go  | Amalfi Coast   | Apr–Jun
<uuid>     | Getting around   | Santorini      | ATV / bus
<uuid>     | Getting around   | Amalfi Coast   | Ferry / scooter
```

**Read for LLM context (Mode B)**: rows with `value IS NULL` produce the targeted missing-cells list. The full set of criterion names (from all rows, regardless of null) gives the LLM the vocabulary for consistent naming.

### 7.2 `trip_feel` and `seasonal_note` — where they live

Both fields live on the `candidates` table (not in `comparison_criteria`). They are generated by `/generate/comparison`, not by `/generate/candidates`, because:
- Only 2–4 of up to 15 suggested candidates typically get shortlisted
- Generating them at candidate-suggestion time would produce content for destinations the user never compares

---

## 8. End-to-end verification checklist

After implementation, verify the following using the running app + Supabase Table Editor.

**Phase A — Comparison matrix UI fix**

- [ ] Run a compare-mode session (via `/chat`) that generates 4+ criteria
- [ ] Send a follow-up turn that returns only 2 criteria in the response
- [ ] Verify: all 4+ criteria remain visible in the UI — none disappear
- [ ] Verify: the 2 returned criteria rows are updated if their values changed; the other 2 are preserved unchanged

**Phase B — `/generate/candidates` (first call)**

- [ ] Use Postman / curl: `POST /generate/candidates {"session_id": "<uuid>"}`
- [ ] Verify: HTTP 200 response; `candidates` array contains new destinations
- [ ] Verify: Supabase `candidates` table — new rows inserted with `status = 'suggested'`; existing shortlisted/rejected rows untouched
- [ ] Verify: `photo_url` populated (or fallback placeholder) for each new candidate
- [ ] Verify: previously shortlisted or rejected candidates are not present in the response as new suggestions

**Phase C — `/generate/candidates` (repeat call)**

- [ ] Call the endpoint a second time on the same session
- [ ] Verify: no duplicates created; existing suggested candidates updated in place or new ones added
- [ ] Verify: shortlisted candidates remain untouched in DB

**Phase D — `/generate/comparison` (Mode A — first call)**

- [ ] Start a session with 2–3 shortlisted candidates; no prior comparison_criteria rows
- [ ] `POST /generate/comparison {"session_id": "<uuid>"}`
- [ ] Verify: HTTP 200; `comparison_matrix` array in response
- [ ] Verify: `comparison_criteria` rows written — one per (criterion × candidate) pair, all values populated
- [ ] Verify: shortlisted candidates in `candidates` table now have `trip_feel` and `seasonal_note` populated

**Phase E — `/generate/comparison` (Mode B — fill gaps)**

- [ ] Add a new shortlisted candidate (via chat); it has no comparison_criteria rows and no trip_feel/seasonal_note
- [ ] `POST /generate/comparison {"session_id": "<uuid>"}`
- [ ] Verify: only the new candidate's cells are written; existing cells for other candidates are untouched
- [ ] Verify: new candidate's `trip_feel` and `seasonal_note` are set; others unchanged

**Phase F — Cell-locking: populated values not overwritten**

- [ ] Note the value of one populated cell (e.g. "Best time to go" / "Santorini") in Supabase
- [ ] Call `/generate/comparison` again
- [ ] Verify: that cell's value is unchanged in DB

**Phase G — Nothing missing: no LLM call**

- [ ] Verify that calling `/generate/comparison` on a fully-populated session returns current state immediately (can be observed via response speed; no Groq call in logs)

---

## 9. Constraints carried forward

All constraints from Sprints 1–13 are preserved. New constraints added this sprint:

1. **`/generate/candidates` and `/generate/comparison` are not wired to any UI trigger** — endpoints exist and are verified; Sprint 15 connects them to the frontend.
2. **Cell-locking under `/chat` is not enforced** — `save_session` can still overwrite `comparison_criteria` values when the conversational agent fires `TOOL_GENERATE_COMPARISON_MATRIX`. This is a known, accepted constraint until Sprint 16.
3. **`/generate/comparison` Mode A generates criteria from scratch** — on first call with no existing rows, the LLM defines the criteria. In Mode B, existing criterion names are passed to the LLM to enforce naming consistency.
4. **Comparison matrix UI merge is temporary** — the `mergeComparisonMatrix` logic added in Section 2 is dead code from Sprint 15 onward (when the display is driven by `/generate/comparison` instead of `/chat` responses). It is removed in Sprint 15, not left in place.
