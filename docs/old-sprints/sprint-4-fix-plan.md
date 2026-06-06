# Sprint 4 Fix Plan: Complete the User-Driven Decision Workspace

**Status**: Engineering fix plan (post first-pass build)  
**Authority**: `docs/sprint-4-planning.md`, `docs/sprint-4-spec.md`, `docs/sprint-4-designbrief.md`, `docs/sprint-4-implementationplan.md`, Sprint 3 guardrails in `docs/sprint-3-result.md`  
**Signals only**: `docs/sprint-4-build-changes.md` (PM QA notes — not architecture source of truth)

---

## Executive summary

Sprint 4’s first pass implemented the right *shape* (mode-gated backend, `ui_state` sync, three candidate-area states, prototype fork intent) but violated the product’s control model and several non-negotiable guardrails. The highest-severity defects are:

1. **UI mode is driven by backend `plan.mode`, not client `uiState.mode`** — compare/decision views wait on the agent instead of switching on click.
2. **Images use a brittle manual dict + LLM-supplied `photo_url`** — opposite of a scalable resolver strategy.
3. **Sprint 3 prototype preservation is broken** — shared `VacationPlan` schema no longer matches `prototype_orchestrator.py`.
4. **Compare UX still thinks in Sprint 3 MCDM terms** — matrix semantics and chat dumping instead of shortlist-card rows as the primary artifact.
5. **Fallback model is `llama-3.1-8b-instant`** — unsuitable for multi-tool ReAct turns.

This plan completes Sprint 4 as specced: user-driven transitions, agent-populated artifacts, card-first comparison, server-resolved images, preserved ReAct loop and flat tool schemas.

---

## 1. Gap analysis (spec/design vs current code)

### 1.1 Backend — agent & state

| Area | Spec / design intent | Current implementation | Severity |
|------|----------------------|------------------------|----------|
| Image pipeline | Destination **names** from agent; **server** resolves photos (Unsplash API + stable fallback); no LLM production URLs; no giant manual catalog as core system | `PHOTO_URLS` dict (~17 keys) in `orchestrator.py`; `suggest_candidates` **requires** `photo_url` from LLM; handler prefers LLM URL over lookup (`item.get("photo_url", get_photo_url(...))`) | **Critical** |
| Fallback LLM | Tool-capable Groq fallback (planned: `mixtral-8x7b-32768`; PM build note: `qwen/qwen3-32b`) | Hardcoded `llama-3.1-8b-instant` in `orchestrator.py` `_call_llm`; `core/config.py` ignores `PRIMARY_MODEL` / `FALLBACK_MODEL` from `.env.example` | **Critical** |
| `ui_state` reconciliation | Backend syncs mode, shortlist, winner **before** agent loop | Implemented in `main.py` (lines 57–76) | OK |
| Mode-gated tools | explore: profile + suggest; compare: profile + matrix; decision: none | `_get_tools_for_mode` matches | OK |
| Conditional dual-call ReAct | Second call when tools used; `tool_choice="none"` on call 2 | Preserved in `run_turn` | OK |
| Flat hand-written tool schemas | No Pydantic `$ref` generation | Hand-written in `orchestrator.py` | OK |
| Candidate upsert | By `name.lower()`; no full-array wipe | Implemented | Partial — **bug**: `suggest_candidates` always sets `status="suggested"`, can demote shortlisted rows |
| Compare tool contract | Matrix rows populate **shortlist cards**; single-turn full population (planning decision #6) | `generate_comparison_matrix` stores `comparison_matrix` + `best_for` / `seasonal_note`; prompt still says “comparison table/matrix” | **High** |
| Matrix row shape | Rows like `{ "criterion": "Weather", "Mallorca": "…" }` | Tool schema allows `additionalProperties` but frontend uses `Object.keys(row)[0]` in `CandidateArea.tsx` | **High** |
| Prototype isolation | Locked Sprint 3 orchestrator + **compatible** Sprint 3 state | `prototype_orchestrator.py` expects `Phase.INTAKE`, `plan.phase`, `trip_shape`, `mental_model`; `models.py` replaced schema and stubbed `Phase` with `EARLY/MID/DECISION` only | **Critical** |
| Session model | Sprint 4 `VacationPlan` for `/chat` | Single `Session.plan: VacationPlan` used for **both** endpoints | **Critical** (prototype) |

**Evidence — image dict and LLM URL precedence:**

```8:38:services/api/agent/orchestrator.py
PHOTO_URLS = {
    "lisbon": "https://images.unsplash.com/photo-1585822345340-672baf14b271?w=800",
    ...
}
...
photo_url = item.get("photo_url", get_photo_url(item["name"]))
```

**Evidence — wrong fallback model:**

```151:152:services/api/agent/orchestrator.py
        primary_model = "llama-3.3-70b-versatile"
        fallback_model = "llama-3.1-8b-instant"
```

### 1.2 Backend — API contract

| Area | Spec | Current | Gap |
|------|------|---------|-----|
| Request | `{ message, session_id, ui_state }` | Matches `ChatRequest` | OK |
| Response | `text_reply`, `comparison_matrix`; frontend needs profile + candidates | Also returns `plan`, `trip_profile`, `candidates` | OK (superset) |
| Image resolution | Not exposed as LLM field | `photo_url` on every candidate from agent/handler | Remove from tool; resolve server-side |
| CORS | 5173 + 5174 | Configured | OK |
| `/chat/prototype` | Sprint 3 behavior | Routes to broken orchestrator vs schema | **Broken** |

### 1.3 Frontend — control boundary & layout

| Area | Spec / design brief | Current | Gap |
|------|---------------------|---------|-----|
| Who owns UI mode | **Frontend** `uiState.mode`; agent enriches content only | `CandidateArea` receives `mode={currentPlan.mode}` from API plan (`App.tsx` line 119) | **Critical** |
| Compare transition | Click “Compare shortlist” → **immediate** comparison layout; agent fills cards async | Mode flips only when `plan.mode` updates after POST completes | **Critical** |
| Explore card layout | 3-across (`grid-cols-3 gap-5`, Lovable `early.tsx`) | `grid-cols-1` in `CandidateArea.tsx` line 47 | **High** |
| Compare card layout | 2–3 tall cards side-by-side (`shortlist-a.tsx`: `grid-cols-2`) | `grid-cols-1` line 93 | **High** |
| Compare artifact | Rows on **shortlist cards**; chat is conversational only | Matrix attached to `ChatMessage` type; prompt encourages tabular chat; `ComparisonMatrix.tsx` still in tree (unused in chat — good) but compare cards use broken row key | **High** |
| Split panel | ~35% chat / ~65% living document | `flex-[1]` / `flex-[1.8]` (~36/64) | Low |
| Landing screen | Two-column: sentence builder + **empty** Trip Profile + ghost candidate placeholders | Partial landing; weak right-panel parity vs Lovable `index.tsx` | Medium |
| Design system | Fraunces + full vacation palette (Lovable `styles.css`) | Georgia + subset of colors in `tailwind.config.js`; minimal `index.css` | Medium |
| Shortlist sync | Client owns shortlist until next message | `useAgent` overwrites `uiState` from response after every turn (lines 50–56) — can fight intentional local state during loading | Medium |
| API base URL | Configurable | Hardcoded `http://localhost:8000/chat` in `useAgent.ts` | Low |

**Evidence — UI gated on backend plan mode:**

```117:120:apps/web/src/App.tsx
          <CandidateArea
            mode={currentPlan.mode}
            candidates={currentPlan.candidates}
```

### 1.4 Prompts

| Area | Spec | Current | Gap |
|------|------|---------|-----|
| Explore: profile-first, no shortlist interrogation | Enforced | `SHARED_GUIDELINES` + explore block | OK |
| Compare: analytical consultant, card enrichment | Populate shortlist card rows; trade-offs in chat prose | Mode text says “Build the Comparison” / “comparison table/matrix” | **High** |
| Compare: no matrix dump in chat | Structured data → right panel only | No explicit “do not print markdown tables” rule | **High** |
| Tool names in chat | Outcome-focused, no tool names | Fixed in Sprint 4 rewrite | OK |
| Decision mode | Celebrator, logistics pivot | Present | Untested in QA |

### 1.5 Ops / docs / repo hygiene

| Item | Spec / PM | Current | Action |
|------|-----------|---------|--------|
| `.env.example` | PM: delete unless one-line README justification | Created with misleading `FALLBACK_MODEL=llama-3.1-8b-instant`; vars not wired to `config.py` | **Delete**; README: `GROQ_API_KEY` only (+ optional `UNSPLASH_ACCESS_KEY` once image resolver exists) |
| README | Dual frontend + backend | Updated for 5173/5174 | OK; remove `.env.example` reference |
| Prototype copy | `apps/prototype-web` | Exists but **nested duplicate** `apps/prototype-web/web/` | Remove duplicate tree in cleanup phase |
| Backup files | — | `orchestrator_backup.py`, `prompt_backup.py` | Delete or gitignore (not product) |
| `sprint-4-implementationplan-v2.md` | — | Alternate plan doc | Do not merge; this fix plan supersedes for execution |

### 1.6 Issues not in PM notes (still in scope)

- **Prototype session corruption**: New sessions default to Sprint 4 `VacationPlan`; prototype tools write invalid fields (`trip_shape` on wrong model).
- **`suggest_candidates` status regression**: Re-suggesting overwrites `shortlisted` → `suggested`.
- **Matrix row rendering bug**: `Object.keys(row)[0]` ≠ `row.criterion`.
- **Duplicate `bali` key** in `PHOTO_URLS` (Python dict — last wins).
- **Decision flow untested**: `handleSelectWinner` message is generic (`I want to go to there!`) without destination name — weak agent context.
- **No `onError` image fallback** on `<img>` tags — broken URLs show empty boxes.

---

## 2. Root causes

| Failure | Root cause |
|---------|------------|
| Images broken / wrong | Agent asked to produce URLs; tiny static dict as “resolution”; no Unsplash Search API; LLM URLs take precedence when present. Wrong **artifact boundary** (generation vs presentation). |
| Fallback model wrong | Implementation treated “fallback” as “smaller/faster” after Mixtral decommission, not “equally capable for tools.” Env template copied the mistake. |
| Compare UI waits on agent | **Single source of truth confusion**: spec says frontend owns mode, code binds view to `plan.mode` returned after POST. Classic control-boundary inversion. |
| Matrix in chat / wrong compare UX | Sprint 3 muscle memory: MCDM as chat-inline artifact (`ComparisonMatrix.tsx`, `generate_mcdm_matrix` naming). Sprint 4 spec moved matrix data to **card rows** but tool/prompt/UI were not fully retargeted. |
| Stacked single-column cards | Agent optimized for “make it work” with simplest Tailwind (`grid-cols-1`) without porting Lovable layout classes. |
| Prototype broken | “Copy orchestrator” without **copying models** or separate session type — shared `models.py` rewrite invalidated locked prototype code. |
| `.env.example` | Template-driven habit; not integrated with `Settings`; duplicates README and risks false confidence in model config. |

---

## 3. Fix plan (phased, dependency-ordered)

### Phase 0 — Prototype integrity (blocking)

**Goal**: `/chat/prototype` + port 5174 demo matches Sprint 3 end state again.

| File | Change |
|------|--------|
| **NEW** `services/api/agent/prototype_models.py` | Restore Sprint 3 models verbatim: `Phase` enum (`intake`…`compare`), `TripShape`, `MentalModel`, `DestinationCandidate` (Sprint 3 fields), `VacationPlan`, `VacationPlanPatch`. Source: `docs/sprint-3-result.md` §4.4 or `orchestrator_backup.py` era git. |
| **MODIFY** `services/api/agent/prototype_orchestrator.py` | Import from `prototype_models` instead of `models`. |
| **MODIFY** `services/api/agent/prototype_prompt.py` | Ensure `SystemPrompts.get_prompt` (Sprint 3) is restored — copy from git Sprint 3 `prompt.py` if current `prompt.py` is Sprint-4-only. |
| **MODIFY** `services/api/agent/session.py` | Either: (A) `PrototypeSession` with `plan: PrototypeVacationPlan` + separate manager key prefix, or (B) store `plan` as `dict` with type field. **Recommended (A)**: `get_prototype_session(session_id)` returning Sprint 3 plan shape. |
| **MODIFY** `services/api/main.py` | `/chat/prototype` uses prototype session manager + `PrototypeResponse` mapping Sprint 3 fields (`response`, `comparison_matrix`). |
| **MODIFY** `services/api/agent/models.py` | Remove incorrect `Phase` / `VacationPlanPatch` stubs that pretend to support prototype. |
| **DELETE** (optional) `apps/prototype-web/web/` | Remove accidental nested duplicate app. |

**Acceptance criteria**

- [ ] `POST /chat/prototype` completes a turn without `AttributeError` on `plan.phase`.
- [ ] Prototype UI on :5174 shows phase breadcrumb, cart, inline comparison matrix as before Sprint 4.
- [ ] Sprint 4 `/chat` still uses `models.py` Sprint 4 schema only.

---

### Phase 1 — Backend: images, LLM config, tool schema hygiene

**Goal**: Server-owned images; tool-capable fallback; LLM never owns production image URLs.

| File | Change |
|------|--------|
| **NEW** `services/api/core/image_resolver.py` | `resolve_destination_photo(name: str, region: str \| None) -> str`: call Unsplash Search API (`/search/photos?query={name}+{region}&per_page=1`) with `UNSPLASH_ACCESS_KEY` from settings; in-memory TTL cache (dict, per-process); return `GENERIC_TRAVEL_PHOTO` constant (verified Unsplash ID, same pattern as Lovable `photos.ts` builder) on miss/error/timeout. **No** per-destination static catalog. |
| **MODIFY** `services/api/core/config.py` | Add optional `UNSPLASH_ACCESS_KEY: str = ""`; `GROQ_PRIMARY_MODEL`, `GROQ_FALLBACK_MODEL` with defaults `llama-3.3-70b-versatile` and `qwen/qwen3-32b` (verify on Groq at implementation time; must support `tools` in smoke test). |
| **MODIFY** `services/api/agent/orchestrator.py` | Remove `PHOTO_URLS` / `get_photo_url`. Remove `photo_url` from `TOOL_SUGGEST_CANDIDATES` properties and `required`. In `_apply_tool_call` for `suggest_candidates`: set `photo_url = resolve_destination_photo(name, region)` for each item. Preserve existing `status` when upserting (do not reset `shortlisted` → `suggested`). |
| **MODIFY** `services/api/agent/prompt.py` | State that destination photos are system-provided; agent supplies **name, region, vibe** only. |
| **MODIFY** `requirements.txt` | Add `httpx` (or use existing HTTP client) if not present for Unsplash. |
| **DELETE** `.env.example` | Remove file. |
| **MODIFY** `README.md` | One line: copy `.env` with `GROQ_API_KEY=...`; optional `UNSPLASH_ACCESS_KEY=...` for destination photos. Document verified fallback model slug. |

**Acceptance criteria**

- [ ] `suggest_candidates` tool schema has no `photo_url` parameter.
- [ ] Candidates for “Reykjavik”, “Tbilisi”, etc. get non-generic URLs when Unsplash key set; generic fallback when unset or API fails.
- [ ] No `PHOTO_URLS` dict in orchestrator.
- [ ] Rate-limit on primary triggers fallback; fallback completes a 2-tool turn in manual test.
- [ ] `.env.example` absent; README documents env vars.

---

### Phase 2 — Backend: compare artifact model & prompts

**Goal**: Comparison data feeds shortlist cards; chat stays conversational; matrix not the UX centerpiece.

| File | Change |
|------|--------|
| **MODIFY** `services/api/agent/orchestrator.py` | In `generate_comparison_matrix` handler: validate each row has explicit `criterion` key; normalize rows to `{ "criterion": str, "<DestinationName>": str, ... }`. Optionally add `comparison_rows: List[dict]` on `DestinationCandidate` in `models.py` (per-card slice) **or** keep global `comparison_matrix` but document contract. |
| **MODIFY** `services/api/agent/prompt.py` | Compare mode: (1) populate `best_for`, `seasonal_note`, and matrix rows in **one turn** when user enters compare; (2) **Never** output markdown tables or wide matrices in `text_reply`; (3) chat summarizes trade-offs in ≤3 sentences + one question. |
| **MODIFY** `services/api/agent/models.py` | (Optional) `comparison_rows: Optional[List[dict]]` per shortlisted candidate if denormalizing simplifies UI — only if it reduces frontend complexity. |

**Acceptance criteria**

- [ ] After compare trigger message, API returns `comparison_matrix` with `criterion` keys and `candidates_details` populated.
- [ ] Assistant `text_reply` for compare turn contains no markdown table (manual check).
- [ ] ReAct: tool turn still performs Call 2 when tools fire.

---

### Phase 3 — Frontend: control boundary & card-first compare

**Goal**: User click changes view immediately; agent enriches in background.

| File | Change |
|------|--------|
| **MODIFY** `apps/web/src/App.tsx` | Pass `mode={uiState.mode}` to `CandidateArea` (not `currentPlan.mode`). On `handleCompareShortlist` / `handleSelectWinner` / `handleFindOthers` / `handleBackToShortlist`: call `updateUiState` **first**; view re-renders before `sendMessage` returns. |
| **MODIFY** `apps/web/src/hooks/useAgent.ts` | Do not overwrite `uiState.mode` or `uiState.shortlist` from response when user has pending local transition (or: only sync `shortlist`/`mode` from server when not `isLoading` and no override in flight). Minimal rule: **never set `mode` from `data.plan.mode` on response** — client remains authoritative for mode. |
| **MODIFY** `apps/web/src/components/CandidateArea.tsx` | Explore: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5`. Compare: `grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6` capped at shortlist length. Fix row render: `const criterion = row.criterion ?? row['criterion']`. Compare mode: show card shell immediately with `exploring...` for empty `best_for` / rows while `isLoading` (pass `isEnriching` prop from App). |
| **MODIFY** `apps/web/src/components/CandidateArea.tsx` | Add `onError` on `<img>` → swap to `GENERIC_FALLBACK_URL` constant (shared with backend URL or duplicated constant). |
| **MODIFY** `apps/web/src/App.tsx` | `handleSelectWinner`: send `I've chosen ${destination} as my destination` (or spec-aligned pre-formed message). |
| **DELETE or ignore** `apps/web/src/components/ComparisonMatrix.tsx` | Remove dead code if unused; ensures no regression to chat matrix. |
| **MODIFY** `apps/web/src/types.ts` | Drop `comparison_matrix` from `ChatMessage` if unused. |

**Acceptance criteria**

- [ ] Click “Compare shortlist” → comparison layout visible **before** agent response finishes.
- [ ] Shortlist cards visible with photos/vibe; rows fill when response arrives.
- [ ] Chat does not render comparison matrix component.
- [ ] Explore shows 3 cards in a row at 1440px width.

---

### Phase 4 — Frontend: design brief parity (Lovable port)

**Goal**: Match `apps/lovable-ui` layout and visual language without TanStack Router.

| File | Change |
|------|--------|
| **MODIFY** `apps/web/tailwind.config.js` + `index.css` | Port tokens from `apps/lovable-ui/src/styles.css`: `ocean`, `sun`, `coral`, `sage`, `sand`, Fraunces via Google Fonts, `shadow-card` / `shadow-soft`. |
| **MODIFY** `apps/web/src/components/LandingScreen.tsx` | Right column: `TripProfile` empty state + ghost 3-card outlines per `lovable-ui/src/routes/index.tsx`. Pill selected state: teal fill. CTA icons (MapPin / Lightbulb). |
| **MODIFY** `apps/web/src/components/TripProfileComponent.tsx` | Match `TripProfile.tsx` spacing, icons, `not set` styling. |
| **REFACTOR** `CandidateArea.tsx` | Extract `CandidateCard` / `ShortlistCard` components aligned with `lovable-ui/src/components/CandidateCard.tsx` and `ShortlistCard.tsx` (aspect ratio, vibe box, row layout `grid-cols-[150px_1fr]`). |
| **MODIFY** `apps/web/src/App.tsx` | Split: `w-[35%]` / `flex-1` or max-width container `max-w-[1320px]` per design target 1440px. |

**Acceptance criteria**

- [ ] Side-by-side visual check against Lovable screens: landing, early (explore), shortlist-a (compare), decision.
- [ ] Teal vibe boxes, warm palette, serif logotype.
- [ ] No placeholder grey boxes for images when resolver + onError work.

---

### Phase 5 — Documentation & cleanup

| File | Change |
|------|--------|
| **MODIFY** `README.md` | Env vars, fallback model name, Unsplash optional key, no `.env.example`. |
| **DELETE** | `orchestrator_backup.py`, `prompt_backup.py` if not referenced. |
| **DELETE** | `apps/prototype-web/web/` duplicate. |

**Acceptance criteria**

- [ ] New developer can run backend + both frontends from README only.
- [ ] No misleading env template in repo.

---

## 4. Out of scope (this sprint)

Explicitly **not** part of completing Sprint 4:

- Interactive maps, itinerary builder, PDF export (Sprint 6 planning).
- Real Skyscanner / weather / safety APIs (Sprint 5–6).
- “Considered & removed” eliminated-candidate panel (planning ideation, not Sprint 4 spec).
- Progressive `exploring...` row-by-row loading as a **backend** strategy (planning locked single-turn matrix; UI may show placeholders while one request runs).
- Redis / SQLite session persistence.
- `scripts/debug_harness.py` observability (Sprint 5).
- Sub-location comparison (Mallorca Sóller vs Palma) beyond agent content in same card components.
- Replacing Groq with OpenAI.
- Rewriting `docs/sprint-4-implementationplan.md` or other existing docs (this file is the execution plan).

---

## 5. Verification checklist

### Manual (primary)

1. **Landing**: Two-column layout; right panel shows empty profile + ghost cards; CTAs start session.
2. **Inspire path**: Split view; 3 explore cards across one row; trip profile fills from chat.
3. **Images**: Three destinations not in any static list show valid photos (with Unsplash key) or generic fallback (never broken img icon).
4. **Shortlist**: Add 2+; compare button enables; remove/re-add works.
5. **Compare transition**: Click compare → **immediate** compare layout (no wait for agent); cards show vibe; matrix rows appear on cards after response; **no** table in chat.
6. **Decision**: “I want to go to there!” → immediate decision view; agent celebrates in chat.
7. **Escape hatches**: “Find others” → explore + shortlist retained; “Back to my shortlist” from decision → compare.
8. **Destinations-in-mind CTA**: First agent message asks which destinations user has in mind (not generic inspire dump).
9. **Prototype**: Port 5174 full Sprint 3 funnel through compare matrix in chat sidebar flow.

### API (`curl`)

```bash
# Health
curl -s http://localhost:8000/

# Explore — no photo_url in tool args (inspect server logs); response includes candidates with photo_url set
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Couple from Berlin, one week in September, love food and coast","session_id":"fix-1","ui_state":{"mode":"explore","shortlist":[]}}'

# Compare — mode synced from client
curl -s -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"I'\''d like to compare my shortlist now","session_id":"fix-1","ui_state":{"mode":"compare","shortlist":["Lisbon","Mallorca"]}}'

# Prototype still Sprint 3
curl -s -X POST http://localhost:8000/chat/prototype \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello","session_id":"proto-fix-1"}'
```

**Pass conditions**

- Explore response: `candidates.length >= 1`, each `photo_url` is HTTPS and loads in browser.
- Compare response: `comparison_matrix` non-null; each row includes `"criterion"` key; `text_reply` length modest, no `| --- |` markdown table.
- Prototype: HTTP 200, `response` string non-empty, no 500 stack trace in server log.

### Guardrail regression checks

- [ ] Tool schemas remain flat JSON (grep no `model_json_schema` in orchestrator).
- [ ] `run_turn` still has conditional second LLM call when `message.tool_calls` non-empty.
- [ ] `suggest_candidates` does not demote `shortlisted` candidates on upsert.

---

## 6. Implementation order summary

```
Phase 0 (prototype models/session) ──► Phase 1 (images + LLM + tools)
                                           │
                                           ▼
                                    Phase 2 (compare prompts/handler)
                                           │
                                           ▼
                                    Phase 3 (frontend control + layout)
                                           │
                                           ▼
                                    Phase 4 (Lovable visual parity)
                                           │
                                           ▼
                                    Phase 5 (README, delete cruft)
```

**Estimated critical path**: Phase 0 → Phase 1 → Phase 3 (unblocks PM’s top UX complaints) → Phase 2 → Phase 4 → Phase 5.

---

*This document is the single forward-engineering plan for finishing Sprint 4. Implement against it; do not patch `sprint-4-implementationplan.md` in place.*
