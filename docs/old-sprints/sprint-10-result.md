# Sprint 10 Final State: Explore & Comparison Agent Prompt Rewrites

**Status**: Complete
**Date**: 16th June 2026

This document describes the end of Sprint 10 code state.

---

## 1. Summary

Sprint 10 implements both phases from `docs/sprint-10-spec.md`, plus three post-testing tweaks agreed with the PM after a live test session. Phase 1 fixes a server-side data-loss bug in trip-profile array fields and rewrites the Explore agent's mode instructions with a cleaner first-turn, an "already have destinations" branch, and an early past-trip question. Phase 2 rewrites the Comparison agent around a unified mission sentence, sharpens its opening-turn behaviour, and adds explicit per-tool call conditions. Post-testing tweaks restore a human transition sentence to both agents' shared guidelines, extend the "already have destinations" branch so the user's named destinations are added as candidates on the very next turn, and add CSS paragraph spacing to the chat message renderer.

---

## 2. Sprint 9 → Sprint 10: Before vs. After

| Dimension | Sprint 9 (Before) | Sprint 10 (After) |
|---|---|---|
| **`vacation_type`/`likes`/`avoid` update behaviour** | Wholesale replace — model sending a shorter list silently drops previously recorded items | Server-side union merge via `_merge_unique` — existing items always kept; new items appended; removal is UI-only |
| **`profile_override` empty-list handling** | `if len(value) > 0` guard — removing the last chip from any list field via the UI never reached `session.plan.trip_profile` | Guard removed — empty lists now sync; last-item removal via the Trip Profile panel correctly clears the field |
| **`TOOL_UPDATE_TRIP_PROFILE` description** | Instructed model to "always send the COMPLETE current list" for array fields | Updated to reflect additive-merge semantics — model sends current items plus newly mentioned ones; server handles deduplication |
| **`TOOL_SUGGEST_CANDIDATES.vibe` description** | "1-sentence vibe statement explaining why this fits this specific user profile" | "1-sentence description of what this destination is actually like — its character and atmosphere" (destination-descriptive, not profile-match) |
| **`TOOL_GENERATE_COMPARISON_MATRIX.best_for` description** | No description | Personalised "trip feel" — given the traveler's profile, what would THEIR trip here actually be like; explicitly distinguished from `vibe` |
| **`TOOL_GENERATE_COMPARISON_MATRIX.seasonal_note` description** | No description | What the destination is like during the time of year this traveler is planning to visit |
| **Explore: first-turn instruction** | Re-asked intake fields implicitly; no branch for "already have destinations" path | Explicitly tells the model not to re-record intake data; "already have destinations" branch asks the user to name them instead of describing the 3 shown |
| **Explore: "already have destinations" — turn 2** | No instruction; model filled candidates with its own picks, ignoring user-named destinations | Extended instruction: include user-named destinations first in the very next `suggest_candidates` call; fill remaining slots with related alternatives |
| **Explore: past-trip question** | No guidance | New item 3: ask about a past trip that went particularly well within the first few replies (around turns 2-3) as a reference point |
| **Explore: mode items** | 4 items (First Turn, Ongoing, Trade-off Questions, No Hard Sell) | 5 items — new item 3 inserted; old 3/4 renumbered to 4/5 |
| **Compare: mission/framing** | "Analytical Consultant — create a detailed side-by-side comparison" — task-list framing, no unifying goal sentence | "Decision Facilitator" — unifying mission: uncover what matters most to this person and keep the matrix lined up against that |
| **Compare: opening turn** | "Immediately populate `best_for`, `seasonal_note`, and matrix rows" — no guidance on chat tone | Generate matrix immediately; don't restate vibes or narrate findings in chat; ask what matters most to them in choosing |
| **Compare: per-tool call conditions** | "If user reveals new preferences, MUST update profile AND regenerate matrix" — both tools always called together | Explicit conditions: call profile update when something new is worth recording; call matrix only when it doesn't yet exist or a new criterion needs adding |
| **Compare: `best_for` content** | "What this destination is better for, compared to the other options" — general, not personalised | "This traveler's personalised trip feel — what would THEIR trip here actually be like?" |
| **Decision: opening** | "Celebrate: congratulate them warmly" — generic | "Open With Why It Won: 1-2 specific reasons from the comparison matrix and trip profile — a natural continuation of Compare, not a generic congratulations" |
| **Both agents: SHARED_GUIDELINES item 1** | "Concise but warm" (Sprint 9) → "Concise and direct" (Sprint 10 Phase 1/2 build) | "Concise and natural — one brief transition sentence before your question" — restores human quality without generic warmth framing |
| **Both agents: SHARED_GUIDELINES item 4** | "Don't Narrate Your Writes" — covered tool-output narration only | "Don't Narrate" — extended to also cover paraphrasing or validating what the user just said before responding |
| **Chat message rendering** | Single `<p className="whitespace-pre-wrap">` — `\n` rendered as a tight line break with no visual weight | Split on `\n`, blank lines filtered, each segment rendered as its own `<p>` with `mt-2` spacing |

---

## 3. Phase 1: Explore Agent

### 3.1 Bug Fixes (`orchestrator.py`, `main.py`)

**Server-side union merge for `vacation_type`/`likes`/`avoid`**: A new module-level `_merge_unique(existing, incoming)` helper performs a case-insensitive union merge of two string lists — existing items are kept in order, incoming items not already present are appended. `_apply_tool_call`'s handling of all three list fields now calls `_merge_unique` instead of replacing wholesale. `TOOL_UPDATE_TRIP_PROFILE`'s top-level description is rewritten to reflect the new additive-merge semantics; the `vacation_type` field description drops the "always send the COMPLETE current list" instruction that is now superseded by the server-side behaviour.

**`profile_override` empty-list fix**: The `if len(value) > 0` guard in `main.py`'s `profile_override` handling is removed. List fields — including empty lists — now always sync to `session.plan.trip_profile`. This is the complementary fix: the merge makes `update_trip_profile` additive-only (no item can be dropped by the model), and the override fix ensures the UI's chip-remove action — the only remaining removal path — actually reaches state, including when removing the last item.

### 3.2 Prompt Rewrite (`prompt.py` — `ExplorePrompts`)

**`MODE_INSTRUCTIONS["explore"]` item 1 — First Turn**: Rewritten to explicitly tell the model not to re-record intake fields already in state. Adds a conditional branch: if the traveler indicated they already have destinations in mind, the chat message asks them to name those destinations rather than describing the 3 candidates shown; when they name destinations in response, the model is instructed to include those exact names first in its very next `suggest_candidates` call, filling remaining slots with related alternatives. The previous item 1 had no "already have destinations" branch and no explicit guard against redundant intake re-recording.

**`MODE_INSTRUCTIONS["explore"]` item 2 — Ongoing**: Trimmed of content that duplicated `TEMPLATE` and `SHARED_GUIDELINES` item 5 (the "keep it full" panel rules). Now reads as a concise action instruction: record new profile details immediately and refresh candidates the same turn if the best matches change.

**`MODE_INSTRUCTIONS["explore"]` item 3 — Ask About a Past Trip, Early** (new): Instructs the model to ask about a past trip that went particularly well within its first few replies (around turns 2-3), as a reference point for the current search. Information stays in conversation context — no new state field.

**Items 3/4 renumbered to 4/5**: "Ask Trade-off Questions" and "No Hard Sell" are unchanged in content; renumbered to make room for the new item 3.

**`SHARED_GUIDELINES` items 1 & 4**: Item 1 changes from "Concise but warm" to "Concise and natural — one brief transition sentence before your question." Item 4 ("Don't Narrate") extended to explicitly cover paraphrasing or validating what the user just said, not only tool-output narration.

---

## 4. Phase 2: Comparison Agent

### 4.1 Holistic Rewrite (`prompt.py` — `ComparisonPrompts.MODE_INSTRUCTIONS["compare"]`)

The Sprint 9 Compare instructions were a task list written in one pass and never iterated. The full rewrite gives the agent a unifying mission sentence: find out what matters most to this person and keep the matrix lined up against that — the matrix is the tool, not the goal. This mission sentence sits above the item list and all instructions serve it.

**Opening turn**: generate the matrix for all shortlisted destinations immediately with a sensible starting set of criteria; do not restate vibes or narrate findings in chat (the matrix and cards carry those); ask what matters most to the traveler in choosing.

**`best_for` and `vibe` content split** embedded in item 2: `best_for` is the traveler's personalised "trip feel" — what would THEIR trip here actually feel like, given what the agent knows about them. `vibe` (set in Explore) already covers the place itself; the model is explicitly told not to repeat it. `seasonal_note` is what the destination is like during the time of year they're planning to visit. A "Best Suited For" matrix row is suggested as a commonly useful criterion.

**Per-tool call conditions** in item 3: call the profile update when the traveler mentions something new worth recording; call the matrix only when it doesn't yet exist or a new criterion needs adding. If nothing new came up, leave both as they are. This replaces the Sprint 9 instruction that both tools should always be called together whenever new preferences appear.

**Old items removed or collapsed**: the "Highlight Differences" prose-summary item and the "Keep it Concise / single driving question" item are dropped — the former because the matrix carries comparisons and the latter because `SHARED_GUIDELINES` item 2 already covers it for both agents.

### 4.2 Tool-Schema Description Edits (`orchestrator.py`)

`TOOL_SUGGEST_CANDIDATES.candidates.vibe`: changed from a profile-match framing ("why this fits this specific user profile") to destination-descriptive ("what this destination is actually like — its character and atmosphere"). This aligns `vibe` content with what the Explore card displays as "Destination Vibe" and sets up the `vibe`/`best_for` content split ahead of the Sprint 11 label rename.

`TOOL_GENERATE_COMPARISON_MATRIX.candidates_details.best_for` and `.seasonal_note`: both now have explicit `description` fields (previously had none). `best_for` is defined as the traveler's personalised trip feel, explicitly distinguished from `vibe`. `seasonal_note` is defined as what the destination is like during the traveler's planned travel time.

### 4.3 Shared Guidelines & Decision Mode (`prompt.py` — `ComparisonPrompts`)

`SHARED_GUIDELINES` items 1 & 4: same changes as Explore (§3.2 above) — "Concise & Natural" with a permitted transition sentence; "Don't Narrate" extended to cover echoing user input.

`MODE_INSTRUCTIONS["decision"]` item 1: "Celebrate — congratulate them warmly" replaced with "Open With Why It Won" — ground the opening in 1-2 specific reasons from the comparison matrix and trip profile, reading as a natural continuation of Compare rather than a generic congratulations. Items 2 ("Pivot to Action") and 3 ("Warm Consultant Tone") unchanged.

---

## 5. Post-Testing Tweaks

Three small adjustments made after the PM's live test session:

1. **"Concise & Natural" — both agents** (`prompt.py`): The Sprint 10 build initially set `SHARED_GUIDELINES` item 1 to "Concise and direct." Live testing showed the model interpreted "direct" as permission to open every response with a cold question, producing an interrogation-like cadence. Changed to "Concise and natural — one brief transition sentence before your question." This restores a human quality without the persona-loading of "warm."

2. **"Already have destinations" — turn 2 instruction** (`prompt.py`): Live testing showed the model correctly asked the user to name their destinations on turn 1, but on turn 2 filled `suggest_candidates` with its own picks (related alternatives) rather than the user-named destinations. The instruction is extended: when the user names specific destinations, include those exact names first in the very next candidates call, with related alternatives filling remaining slots.

3. **Chat message paragraph spacing** (`ChatInterface.tsx`): The model occasionally puts a line break between a transition sentence and its question. The previous `<p className="whitespace-pre-wrap">` rendered any `\n` as a tight same-line-height break with no visual separation. The renderer now splits message content on `\n`, filters blank lines, and renders each segment as its own `<p>` with `mt-2` top margin — covering both `\n` and `\n\n` output from the model.

---

## 6. Constraints Carried Forward

1. Flat JSON tool schemas only — no Pydantic schema generation for Groq tools; `additionalProperties` not used in nested schemas (the top-level `matrix_rows` item's `additionalProperties: {"type": "string"}` is unchanged).
2. Dual-call conditional ReAct loop preserved, per agent.
3. Client owns `uiState.mode` — server responses must not override it.
4. Candidate upsert by `name.lower()` — never replace the full array; shortlisted names skipped; un-rejected candidates deleted from `session.plan.candidates`.
5. State JSON to LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`), shared by both agents.
6. Tool function names never appear in system prompt instructions.
7. `TOOL_FORMAT_NUDGE` remains Call-1-only, never persisted to `session.history`.
8. One `AgentOrchestrator` class, parameterised by `AgentConfig` — not separate subclasses per agent.
9. No handoff marker in shared history — two-pass pruned history is the sole handoff mechanism between agents on a mode change.
10. `MAX_HISTORY_TURNS = 5`; `_prune_history` runs after `_filter_history`.
11. `GROQ_API_KEY_2` provisioned and in use — both agents have independent rate-limit pools.
12. **New this sprint**: `vacation_type`/`likes`/`avoid` updates via the profile-update tool are additive-only (server-side union merge); removal is a UI-only action via the Trip Profile panel.
13. **New this sprint**: `vibe` (Explore) is destination-descriptive ("about this place"); `best_for` (Compare) is personalised "trip feel" ("what THEIR trip here would actually feel like"). Same field names and schema structure — content only. FE label alignment and possible `best_for` → `trip_feel` rename deferred to Sprint 11.

---

## 7. Directory Map (Post-Sprint 10)

```
vacation-planner/
├── docs/
│   ├── sprint-10-planning.md
│   ├── sprint-10-spec.md
│   └── sprint-10-result.md              ← THIS FILE
│
├── apps/web/src/components/
│   └── ChatInterface.tsx                Split-on-\n paragraph rendering for chat messages
│
└── services/api/
    ├── agent/
    │   ├── orchestrator.py             _merge_unique helper; _apply_tool_call additive merge
    │   │                                for vacation_type/likes/avoid; TOOL_UPDATE_TRIP_PROFILE
    │   │                                description rewrite; TOOL_SUGGEST_CANDIDATES.vibe
    │   │                                description; TOOL_GENERATE_COMPARISON_MATRIX.best_for
    │   │                                and .seasonal_note descriptions
    │   └── prompt.py                   ExplorePrompts.MODE_INSTRUCTIONS["explore"] — first-turn
    │                                    rewrite, "already have destinations" branch + turn-2
    │                                    instruction, new item 3 (past trip), items renumbered;
    │                                    ExplorePrompts.SHARED_GUIDELINES items 1 & 4;
    │                                    ComparisonPrompts.MODE_INSTRUCTIONS["compare"] — full
    │                                    holistic rewrite; ComparisonPrompts.MODE_INSTRUCTIONS
    │                                    ["decision"] item 1; ComparisonPrompts.SHARED_GUIDELINES
    │                                    items 1 & 4
    └── main.py                          profile_override: len(value) > 0 guard removed for list
                                          fields
```

---

## 8. Testing Results

**Additive merge and UI removal confirmed working**: across multiple turns in both test sessions, `vacation_type`/`likes`/`avoid` items accumulated correctly and were not silently dropped when a later tool call sent a shorter list. Removing the last chip from a list field via the Trip Profile panel correctly cleared the field in the next turn's state.

**"Already have destinations" — turn 1 correct, turn 2 initially missed**: the first-turn branch correctly asked the user to name their destinations rather than describing the 3 shown. On turn 2, the model initially filled `suggest_candidates` with its own related picks rather than the user-named destinations — addressed in post-testing tweak 2 (§5).

**Past-trip question arrived at turn 7** in the tested session rather than the instructed turns 2-3. PM judged this acceptable — the question was asked, and the answer informed subsequent reasoning. No change made.

**Mirroring/interrogation**: the anti-mirroring changes reduced paraphrasing, but "direct" in item 1 produced a cold, question-only cadence without connective tissue. Addressed in post-testing tweak 1 (§5).

**Compare opening and matrix generation**: matrix generated immediately on entering Compare with a good initial set of criteria. The agent did not restate destination vibes in chat. First question oriented the user toward what matters most. Compare agent continued to call both tools on some turns where only one was warranted — PM reviewed the tool call content, found it genuinely useful (the profile updates captured new preferences correctly), and accepted this behaviour for now.

**`vibe` vs. `best_for` content distinction**: destination vibe reads as "about this place" as intended. `best_for` showed improvement but is still partially mixed with general destination descriptions — expected, as the field name `best_for` does not yet signal "trip feel" to the model. Sprint 11's label rename (`best_for` → `trip_feel`) is expected to close this gap.

**Decision handoff**: opening correctly referenced specific reasons from the comparison rather than a generic congratulations. Not a focal concern this sprint.

**Mode switching**: Explore → Compare → Decision and back all routed correctly. Returning to Compare after re-exploring preserved the matrix criteria from the prior Compare session.

**One text-embedded tool call** observed in one session during Explore on an early turn — the model emitted a `<function=suggest_candidates>{...}</function>` call inside its `content` field rather than as a structured tool call. This is a different failure mode from the `tool_use_failed` 400 error: no `BadRequestError` is raised, so the Sprint 8 retry-with-nudge mechanism did not fire. The raw function syntax was visible in the chat bubble and candidates were not updated that turn. Subsequent turns worked correctly.

---

## 9. Known Gaps — Sprint 11 Planning Input

1. **`vibe` / `best_for` FE label alignment**: `vibe` content is now destination-descriptive but the card label in Explore still reads "Destination Vibe" and in Compare "Vacation Vibe." `best_for` content is now personalised trip feel but the card label reads "Best For." Both labels should be aligned to reflect the Sprint 10 content redefinition; `best_for` → `trip_feel` field rename should be considered at the same time. Already scoped in Sprint 11 (Sprint 10 planning §6 item 4) .
2. **Landing page, intake form, and first-impression improvements**: not touched this sprint — scoped for Sprint 11 (Sprint 10 planning §6 items 1-3).
3. **"Already have destinations" path — turn 2 robustness**: the post-testing tweak (§5 item 2) adds the instruction but has not been re-tested. Worth a verification check at the start of the next test session.
