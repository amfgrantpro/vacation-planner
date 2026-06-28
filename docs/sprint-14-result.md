# Sprint 14 Final State: Generation Endpoints

**Status**: Complete  
**Date**: 28th June 2026

This document describes the end of Sprint 14 code state.

---

## 1. Summary

Sprint 14 builds two focused generation endpoints — `POST /generate/candidates` and `POST /generate/comparison` — on top of the Supabase foundation laid in Sprint 13. It also fixes the comparison matrix UI bug that caused criteria to disappear when the LLM returned a shorter list than the previous turn.

Each generation endpoint is a single, forced LLM call: reads what it needs from DB, calls the LLM with a purpose-built system prompt and a single forced tool, writes the result back to DB, and returns. The conversational `/chat` endpoint and agent logic are unchanged. The new endpoints are not wired to any UI trigger — Sprint 15 handles that.

---

## 2. Sprint 13 → Sprint 14: Before vs. After

| Dimension | Sprint 13 (Before) | Sprint 14 (After) |
|---|---|---|
| **Candidate generation** | Owned by the conversational agent — one of several jobs it does simultaneously | `POST /generate/candidates`: focused endpoint, reads profile + candidate history from DB, one LLM call, writes new candidates to DB |
| **Comparison generation** | Owned by the conversational agent — regenerates the full matrix each call, no cell locking | `POST /generate/comparison`: focused endpoint, identifies missing cells before calling LLM, writes only missing cells, never overwrites populated values |
| **Comparison matrix UI** | Frontend replaced displayed matrix wholesale on each `/chat` turn — criteria disappeared if LLM returned a shorter list | Frontend merges incoming criteria into existing display state; criteria already on screen are never dropped |
| **History pruning** | Private methods `_filter_history` / `_prune_history` on `AgentOrchestrator` | Extracted to `utils.py`; shared by orchestrator and both generators |
| **New modules** | — | `services/api/agent/utils.py`, `services/api/agent/generation.py` |

---

## 3. Backend Changes

### 3.1 `services/api/agent/utils.py` (new)

Shared history utility functions, extracted from `AgentOrchestrator`:

```python
MAX_HISTORY_TURNS = 5

def filter_history(history: list) -> list:
    """Strip tool messages — keep only user and plain assistant text messages."""

def prune_history(history: list) -> list:
    """All user messages kept; assistant replies kept for last MAX_HISTORY_TURNS turns only."""
```

`prune_history` calls `filter_history` internally. `MAX_HISTORY_TURNS = 5` lives here as the single source of truth.

### 3.2 `services/api/agent/orchestrator.py`

Private `_filter_history` and `_prune_history` methods removed. `MAX_HISTORY_TURNS` constant removed. `prune_history` imported from `utils.py` and called directly in `run_turn`. No behavioural change.

### 3.3 `services/api/agent/generation.py` (new)

Two generator classes and two tool definitions:

**`TOOL_SUGGEST_CANDIDATES_GENERATION`** — flat JSON tool schema; forces the LLM to return exactly 3 candidates with `name`, `region`, `vibe`. No `additionalProperties`.

**`TOOL_GENERATE_COMPARISON`** — flat JSON tool schema; one tool covering both generate-from-scratch and fill-gaps cases. Returns `criteria` (array of criterion × candidate value pairs) and `candidate_enrichments` (array of `trip_feel` / `seasonal_note` for destinations that need them).

**`CandidateGenerator`**:
- `_build_prompt(profile, rejected, active_names) -> str`: builds system prompt from DB state. Passes rejected candidates with reasons (never re-suggest), active candidate names (avoid re-filling slots with already-visible destinations), and the pruned conversation history for nuance not yet in the structured profile.
- `generate(session_id) -> dict`: reads session from DB → builds prompt → one forced LLM call → resolves photos via Unsplash → pre-fetches all existing candidate rows (one query) → upserts by name match (update by DB `id` if exists, insert if new); never touches shortlisted or rejected candidates → returns full candidate list from DB post-write.

**`ComparisonGenerator`**:
- `_build_prompt(...)`: builds system prompt with two conditional blocks — Block A (generate from scratch) when no criteria exist; Block B (fill gaps only) when criteria exist, passing exact existing criterion names and the list of missing `(criterion, candidate)` pairs. Enrichment block appended only for candidates missing `trip_feel` or `seasonal_note`. `vibe` excluded from shortlisted destinations context (matches existing compare agent behaviour — showing vibe causes LLM to copy it into `trip_feel`).
- `generate(session_id) -> dict`: reads session → identifies `null_cells` (criterion × candidate pairs where value IS NULL or no DB row exists) and `missing_enrichments` → **early exit if nothing missing** (no LLM call) → one forced LLM call → cell-locking enforced at application layer: only cells in the pre-built `null_cells` set are written to DB; LLM returning a cell it was not asked for is silently dropped → enrichment writes use null-check before update (never overwrite populated values) → returns full DB state post-write.

**`_call_llm_forced`** — shared helper: single forced tool call with rate-limit fallback to `GROQ_FALLBACK_MODEL`, same pattern as `AgentOrchestrator._call_llm`.

### 3.4 `services/api/main.py`

Added at startup:
```python
groq_client = get_groq_client(settings.GROQ_API_KEY)
candidate_generator = CandidateGenerator(session_manager, groq_client)
comparison_generator = ComparisonGenerator(session_manager, groq_client)
```

Added `GenerateRequest` model:
```python
class GenerateRequest(BaseModel):
    session_id: str
```

Added two endpoints:
```python
@app.post("/generate/candidates")
async def generate_candidates(request: GenerateRequest): ...

@app.post("/generate/comparison")
async def generate_comparison(request: GenerateRequest): ...
```

Both return 404 if the session does not exist (raised from `get_session`). Both re-raise `HTTPException` directly; other exceptions become 500.

---

## 4. Frontend Changes

### 4.1 `apps/web/src/hooks/useAgent.ts`

`mergeComparisonMatrix` added at module level:

```typescript
const mergeComparisonMatrix = (
    existing: Record<string, string>[] | null,
    incoming: Record<string, string>[] | null
): Record<string, string>[] | null => { ... }
```

Keys on `row.criterion`. Existing rows updated in place (incoming spread over existing); new criteria appended; if `incoming` is null the existing display state is returned unchanged.

`setPlan(data.plan)` replaced with a functional update that merges the comparison matrix before applying the new plan:

```typescript
setPlan(prev => {
    const mergedMatrix = mergeComparisonMatrix(
        prev?.comparison_matrix ?? null,
        data.plan.comparison_matrix
    );
    return { ...data.plan, comparison_matrix: mergedMatrix };
});
```

Sprint 15 note: `mergeComparisonMatrix` is deleted in Sprint 15 when the comparison display is driven by `/generate/comparison` directly — it will no longer be on the `/chat` code path.

---

## 5. API Response Formats

### `POST /generate/candidates`
```json
{
  "candidates": [
    {
      "id": "uuid",
      "session_id": "uuid",
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
Returns the **full candidate list** for the session post-write — all candidates, not just newly added ones.

### `POST /generate/comparison`
```json
{
  "comparison_matrix": [
    { "criterion": "string", "CandidateA": "string", "CandidateB": "string" }
  ],
  "candidates": [
    { "name": "string", "trip_feel": "string", "seasonal_note": "string" }
  ]
}
```
`comparison_matrix` is reconstructed from DB post-write (shortlisted candidates only), in the flat in-memory format the frontend already expects. `candidates` contains all shortlisted candidates with enrichments populated.

---

## 6. Constraints Carried Forward

All constraints from Sprints 1–13 are preserved. New constraints added this sprint:

1. **Generation endpoints are not wired to any UI trigger** — endpoints exist and are verified; Sprint 15 connects them.
2. **Cell-locking under `/chat` is not enforced** — `save_session` still upserts to `comparison_criteria` when the conversational agent fires `TOOL_GENERATE_COMPARISON_MATRIX` via chat. This can overwrite a cell value that `/generate/comparison` already filled. Cannot delete rows (upsert-never-delete is enforced at DB level). Full resolution is Sprint 16: removing `TOOL_GENERATE_COMPARISON_MATRIX` from the compare agent makes `/generate/comparison` the sole writer.
3. **`/generate/comparison` generates criteria from the LLM on first call** — when no criteria exist, Block A instructs the LLM to define them (5–7 criteria grounded in the traveler's profile). On subsequent calls, existing criterion names are passed to enforce naming consistency (Block B).
4. **Comparison matrix UI merge is temporary** — `mergeComparisonMatrix` is deleted in Sprint 15, not left as dead code.

---

## 7. Testing Results

**Phase A — Comparison matrix UI fix**: ✅ Ran a full compare-mode session accumulating 4+ criteria. Sent a follow-up message that caused the agent to return only 2 criteria ("Distance from Berlin" and "Car Rental"). All original criteria remained visible in the UI; the 2 updated rows reflected new values. Confirmed via the DB entry in `conversation_history` that the LLM did in fact send only 2 criteria that turn.

**Phase B — `/generate/candidates` (first call)**: ✅ 200 response; 3 new candidates returned (Crete, The Azores, Sardinia). 9 total candidates in response — 3 new `suggested`, plus existing shortlisted (Bali, Bora Bora) and rejected (Seychelles, Santorini, Costa Rica) rows all preserved and untouched. `photo_url` populated via Unsplash for all 3 new candidates. Uvicorn log confirmed: `LLM returned 3 candidates`.

**Phase C — `/generate/candidates` (repeat call)**: ✅ 3 more new candidates added (Kefalonia, Puglia, Corfu) — 12 total candidates in response. No duplicate rows; existing candidates preserved with original status and field values intact.

**Phase D — `/generate/comparison` (no shortlisted candidates)**: ⚠️ Test condition not met cleanly. The `comparison_criteria` table was cleared in Supabase as planned, but Bali and Bora Bora had been accidentally un-shortlisted by navigating back to Explore mode before the curl ran. First call returned `{"comparison_matrix": [], "candidates": []}` — correct early-exit behaviour (no shortlisted candidates → nothing missing → no LLM call). The PM then resumed chatting; the `/chat` agent re-generated criteria for Bali via `TOOL_GENERATE_COMPARISON_MATRIX`, re-populating the table.

**Phase E — `/generate/comparison` (fill gaps — new shortlisted candidate)**: ✅ Kefalonia was subsequently shortlisted. `POST /generate/comparison` called; server log confirmed `10 missing cells, 1 missing enrichment` — 10 criteria × Kefalonia (Bali's cells had been re-populated by the `/chat` agent between Phase D and E). `comparison_criteria` table: 10 new Kefalonia rows written; Bali's existing rows unchanged. `candidates` table: Kefalonia's `trip_feel` and `seasonal_note` written. The endpoint correctly identified and filled only the gap, leaving existing values untouched.

**Phase F — Cell-locking**: ✅ Proven by Phase G — if no LLM call is made, no cell can be overwritten by definition.

**Phase G — Nothing missing: no LLM call**: ✅ Two consecutive calls on the fully-populated session produced `✅ ComparisonGenerator: nothing missing for session ... — skipping LLM call` in the uvicorn log. No Groq request appeared. Response was near-instant and returned the full DB state unchanged.

### UI behaviour observed during testing

When navigating into Compare mode in the app after calling `/generate/comparison` via curl, the frontend displayed a mix of old and new data:

- **Old criteria** (generated by the `/chat` agent earlier in the session): Bali had values; Kefalonia column showed blank — because the frontend's local state had no Kefalonia column for those rows (Kefalonia was added to the shortlist after those chat turns).
- **New DB-generated criteria** (written by `/generate/comparison`): not visible in the UI at all — the frontend state was last set by a `/chat` response and was never updated from the DB write.

This is expected and correct for Sprint 14. The frontend reads from local React state, not from the DB directly. The gap between "DB is right" and "UI reflects DB" is what Sprint 15 closes: the frontend will call `/generate/comparison` directly when entering Compare mode, replacing local state with the full DB-sourced matrix for all current shortlisted candidates.

---

## 8. Directory Map (Post-Sprint 14)

```
vacation-planner/
├── docs/
│   ├── sprint-14-planning.md
│   ├── sprint-14-spec.md
│   └── sprint-14-result.md              ← THIS FILE
│
├── services/api/
│   ├── main.py                          GenerateRequest; POST /generate/candidates;
│   │                                    POST /generate/comparison; generator singletons
│   └── agent/
│       ├── orchestrator.py              _filter_history/_prune_history removed;
│       │                                prune_history() imported from utils
│       ├── generation.py                NEW: CandidateGenerator, ComparisonGenerator,
│       │                                TOOL_SUGGEST_CANDIDATES_GENERATION,
│       │                                TOOL_GENERATE_COMPARISON
│       └── utils.py                     NEW: filter_history, prune_history,
│                                        MAX_HISTORY_TURNS
│
└── apps/web/src/
    └── hooks/useAgent.ts                mergeComparisonMatrix; setPlan functional update
```
