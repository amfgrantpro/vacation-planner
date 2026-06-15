# Sprint 10 Implementation Spec: Explore & Comparison Agent Prompt Rewrites

**Status**: Draft — awaiting PM review. Not approved for implementation.

## 1. Executive Alignment

Sprint 10 implements the two phases agreed in `docs/sprint-10-planning.md` §5:

1. **Phase 1 — Explore agent**: a sequenced bugfix (additive merge for `vacation_type`/`likes`/`avoid`, plus the related `profile_override` empty-list fix), then a content rewrite of `MODE_INSTRUCTIONS["explore"]` (no redundant profile update on turn 1, an "I already have destinations" branch, and a new early-turn "ask about a past trip" item) and a `SHARED_GUIDELINES` mirroring-reduction edit.
2. **Phase 2 — Comparison agent**: a holistic rewrite of `MODE_INSTRUCTIONS["compare"]` around a unifying mission (discover what matters, use the matrix to show it — not generate the matrix as the goal), explicit per-tool call conditions, a `vibe`/`best_for` content redefinition (tool-schema description edits, no field rename), the same mirroring-reduction edit to `SHARED_GUIDELINES`, and a light handoff-consistency pass on `MODE_INSTRUCTIONS["decision"]`'s opening.

**No UI changes this sprint** — `apps/web` and `apps/lovable-ui` are untouched. Changes are in `services/api/agent/prompt.py`, `services/api/agent/orchestrator.py`, and one targeted fix in `services/api/main.py`.

**Architectural constraints inherited from prior sprints — must not be violated** (planning §1):
1. Client-Authoritative State Sync — frontend owns `mode`, backend owns content.
2. Conditional Dual-Call ReAct Loop preserved.
3. Flat JSON tool schemas only — no `additionalProperties` in nested Groq tool schemas.
4. Tool function names never appear in system prompt instructions (descriptive phrases like "the comparison matrix" or "the trip profile" are fine — these are state/field names already visible in `state_json`, not function names).
5. Candidate upsert by `name.lower()` — never replace the full array; shortlisted names skipped.

---

## 2. Scope & Non-Goals

### In Scope
- `services/api/agent/prompt.py` — `ExplorePrompts.MODE_INSTRUCTIONS["explore"]`, `ExplorePrompts.SHARED_GUIDELINES`, `ComparisonPrompts.MODE_INSTRUCTIONS["compare"]`, `ComparisonPrompts.MODE_INSTRUCTIONS["decision"]`, `ComparisonPrompts.SHARED_GUIDELINES`.
- `services/api/agent/orchestrator.py` — new `_merge_unique` helper; `_apply_tool_call`'s `vacation_type`/`likes`/`avoid` handling; `TOOL_UPDATE_TRIP_PROFILE` top-level and `vacation_type` field descriptions; `TOOL_SUGGEST_CANDIDATES.vibe` description; `TOOL_GENERATE_COMPARISON_MATRIX.candidates_details` field descriptions.
- `services/api/main.py` — `profile_override` empty-list handling for list fields.

### Non-Goals (this sprint)
- Any field rename (`best_for` → `trip_feel`) or FE label changes — Sprint 11 (planning §6 item 4).
- Landing page, intake form, candidate card UI, "Tell me more" — Sprint 11/12.
- Session persistence / localStorage / Chat ID / backend persistence layer — Sprint 13 / backlog.
- A new "are you ready to decide?" prompt in Decision mode — explicitly ruled out; the Decision-mode work is a handoff-consistency pass only (planning §7 decision 2).
- Any change to `apps/web`, `apps/lovable-ui`, or `services/api/agent/prototype_*.py`.

---

## 3. Phase 1: Explore Agent

### 3.1 BUG FIX (implemented first, isolated from the prompt rewrite): Additive merge for `vacation_type`/`likes`/`avoid` + `profile_override` empty-list fix

Per planning §5 Phase 1 item 5 and §7 decisions 6 & 9, extended to `vacation_type` for consistency — it's the same `List[str]` field on the same `_apply_tool_call` code path as `likes`/`avoid`, so the same fix and unified tool-description rule apply to all three. Two related fixes, both backend-only:

**(a) Server-side union merge for `vacation_type`/`likes`/`avoid`.** Today, `_apply_tool_call` replaces these fields wholesale with whatever the model sends (`orchestrator.py:286-291`). Sprint 9 live-testing observed this for `likes`/`avoid` — the model sent a shorter list than the existing state, silently dropping previously recorded items. `vacation_type` is the same `List[str]` shape on the same code path, so the same fix applies. Fix: merge additively — existing items are kept, new items from the model are appended, nothing is ever dropped by this path.

**(b) `profile_override` empty-list fix.** `main.py:65-72` currently skips syncing a list field when the incoming value is `[]` (`if len(value) > 0`). This means removing the *last* chip from any list field (`vacation_type`, `likes`, or `avoid`) via the Trip Profile panel UI never reaches `session.plan.trip_profile` — the field stays stuck at its last non-empty value. Fix: always sync list fields from `profile_override`, including empty lists.

**Why both together**: (a) makes `update_trip_profile` additive-only for `vacation_type`/`likes`/`avoid` — the model can no longer cause an item to disappear. The only remaining removal path is the UI chip-remove → `profile_override`. (b) is what makes that path actually work when removing the *last* item. Fixing (a) without (b) would leave last-item removal silently broken; the planning doc bundles them for this reason.

#### [MODIFY] `services/api/agent/orchestrator.py` — new module-level helper (placed above `class AgentOrchestrator`)

```python
def _merge_unique(existing: list[str], incoming: list[str]) -> list[str]:
    """Union-merge two string lists, case-insensitively, preserving order.

    Existing items are kept in their current order; incoming items not already
    present (by case-insensitive match) are appended. Makes trip-profile list
    fields (vacation_type/likes/avoid) additive-only — protects against the
    model sending a shorter list and silently dropping previously recorded
    items. Deliberate removal is a UI-only action (TripProfileComponent chip
    removal -> profile_override).
    """
    seen = {item.lower() for item in existing}
    merged = list(existing)
    for item in incoming:
        if item.lower() not in seen:
            merged.append(item)
            seen.add(item.lower())
    return merged
```

#### [MODIFY] `services/api/agent/orchestrator.py` — `_apply_tool_call` (currently lines 286-291)

```python
            if "vacation_type" in args:
                plan.trip_profile.vacation_type = _merge_unique(plan.trip_profile.vacation_type, args["vacation_type"])
            if "likes" in args:
                plan.trip_profile.likes = _merge_unique(plan.trip_profile.likes, args["likes"])
            if "avoid" in args:
                plan.trip_profile.avoid = _merge_unique(plan.trip_profile.avoid, args["avoid"])
```

#### [MODIFY] `services/api/agent/orchestrator.py` — `TOOL_UPDATE_TRIP_PROFILE` description (currently line 20)

```python
        "description": (
            "Update the traveler's trip profile based on conversation extraction. "
            "For 'vacation_type', 'likes', and 'avoid', send the current items plus "
            "anything newly mentioned — the server merges these additively, so "
            "existing items are never dropped even if you omit them. Removing an "
            "item from any of these lists is a UI-only action, not done via this tool."
        ),
```

#### [MODIFY] `services/api/agent/orchestrator.py` — `TOOL_UPDATE_TRIP_PROFILE.vacation_type` field description (currently line 29)

```python
                "vacation_type": {"type": ["array", "null"], "items": {"type": "string"}, "description": "List of vacation style descriptors (e.g. ['beach', 'adventure', 'city break'])."},
```

(Drops "Always send the COMPLETE current list including existing values" — superseded by the unified additive-merge rule above.)

#### [MODIFY] `services/api/main.py` — `profile_override` handling (currently lines 65-72)

```python
        if request.profile_override:
            incoming = request.profile_override.model_dump(exclude_none=True)
            for field, value in incoming.items():
                if isinstance(value, list):
                    setattr(session.plan.trip_profile, field, value)
                elif value not in (None, ""):
                    setattr(session.plan.trip_profile, field, value)
```

(Removes the `if len(value) > 0` guard — the only change.)

**Resulting behavior change** (documented for clarity, not a new decision — this is what planning §7 decision 6 already specifies for `likes`/`avoid`, extended here to `vacation_type` for consistency): conversational removal of a `vacation_type`/`likes`/`avoid` item (e.g. "I don't mind crowds anymore", or "actually, scrap the beach idea") no longer takes effect via `update_trip_profile` — the server merge would just re-add it if it's still in the model's view of "current items". Removal only happens via the Trip Profile panel's chip-remove UI, which now correctly reaches `session.plan.trip_profile` (including down to an empty list) thanks to (b), so the *next* turn's state JSON — and therefore the merge baseline — reflects the removal.

---

### 3.2 First-Turn Rewrite: skip redundant profile update + "I already have destinations" branch

Per planning §5 Phase 1 items 1 & 2, §7 decisions 4 & 6.1.

#### [MODIFY] `services/api/agent/prompt.py` — `ExplorePrompts.MODE_INSTRUCTIONS["explore"]`, item 1 (currently line 77)

```
1. **First Turn**: The traveler's core trip details (origin, traveler type, timing, duration, budget, and vacation type) are already filled in the state above. Do NOT restate or re-record them. Suggest 3 destinations that fit what's known so far.
   - If the traveler said they already have destinations in mind, use your chat message to ask which destination(s) they're considering, instead of describing the 3 you suggested.
   - Otherwise, use your chat message to start surfacing what onboarding can't capture: likes, things to avoid, and deeper motivations.
```

Named destinations the user mentions in response are added as candidates via the normal `suggest_candidates` upsert on a later turn — no special-casing needed beyond this instruction, since the upsert already merges by `name.lower()`.

---

### 3.3 New Item: Ask About a Past Trip, Early

Per planning §5 Phase 1 item 3, §7 decision 5. Inserted as a new item 3, renumbering the current items 3 ("Ask Trade-off Questions") and 4 ("No Hard Sell") to 4 and 5.

#### [MODIFY] `services/api/agent/prompt.py` — `ExplorePrompts.MODE_INSTRUCTIONS["explore"]`, new item 3

```
3. **Ask About a Past Trip, Early**: Within your first few replies (around your 2nd or 3rd), ask about a trip they've taken that went particularly well — as a reference point for this one. Let the answer shape your reasoning and candidate choices going forward.
```

**Resulting `MODE_INSTRUCTIONS["explore"]`** (item 1 from §3.2 + item 3 above, plus two dedup trims — the mission line's second sentence and item 2's panel-mechanics restatement are dropped as duplicates of `TEMPLATE` / `SHARED_GUIDELINES` item 5):

```
## Mode: EXPLORE — Diagnostic Profiler & Matchmaker
Your job here has two equal halves: build genuine understanding of the traveler — their preferences, constraints, and deeper motivations — through conversation, and constantly surface the 3 best-matching destination candidates for that understanding.

What to Do:
1. **First Turn**: The traveler's core trip details (origin, traveler type, timing, duration, budget, and vacation type) are already filled in the state above. Do NOT restate or re-record them. Suggest 3 destinations that fit what's known so far.
   - If the traveler said they already have destinations in mind, use your chat message to ask which destination(s) they're considering, instead of describing the 3 you suggested.
   - Otherwise, use your chat message to start surfacing what onboarding can't capture: likes, things to avoid, and deeper motivations.
2. **Ongoing**: As new profile details emerge, record them immediately — and if that changes who the best 3 matches are, refresh the candidate panel the same turn (see Shared Guidelines for panel rules).
3. **Ask About a Past Trip, Early**: Within your first few replies (around your 2nd or 3rd), ask about a trip they've taken that went particularly well — as a reference point for this one. Let the answer shape your reasoning and candidate choices going forward.
4. **Ask Trade-off Questions, Not Menu Questions**: Avoid questions that list several good options and invite a "yes to all" (e.g. "Do you like mountains, forests, or coastlines?") — they don't narrow anything down. Instead, frame questions as genuine trade-offs between two competing values, where the answer changes what you'd recommend — e.g. "Would you rather somewhere peaceful and remote, or somewhere with good infrastructure and restaurants nearby?" or "Is it more important that this trip feels relaxing, or that it feels like an adventure?" A good question narrows the field toward a recommendation; a menu question doesn't.
5. **No Hard Sell**: The candidates appear on the right. Let them speak for themselves. You focus on understanding the traveler, not telling them about the destinations you added as candidates.

Available Tools: Profile updates and candidate suggestions (system handles automatically—don't mention them).
```

---

### 3.4 Shared Guidelines: Reduce Mirroring

Per planning §5 Phase 1 item 4, ideation §3 "Mirroring".

#### [MODIFY] `services/api/agent/prompt.py` — `ExplorePrompts.SHARED_GUIDELINES`, item 1 (currently line 88)

```
1. **Concise & Human**: Be concise and direct. You are a travel consultant, not a form. Max 3 sentences per response unless presenting structured output.
```

(Drops "but warm" — tone should come from the quality of recommendations, not persona framing.)

#### [MODIFY] `services/api/agent/prompt.py` — `ExplorePrompts.SHARED_GUIDELINES`, item 4 (currently line 91)

```
4. **Don't Narrate**: When you update the profile or candidates, do not list or recite what you just recorded ("I've noted you like X, Y, Z" / "I've added A, B, C to your options") — the user can already see these changes reflected on screen. Do not paraphrase or validate what the user just told you before responding — act on it instead. The candidate panel updating IS the acknowledgment.
```

---

## 4. Phase 2: Comparison Agent

### 4.1 Holistic Rewrite: Unified Mission & Tool-Call Discipline

Per planning §5 Phase 2 items 1 & 2, §7 decision 3. This replaces `MODE_INSTRUCTIONS["compare"]` (currently `prompt.py:112-126`) entirely — content extraction was Sprint 9's job; this is the first real iteration.

#### [MODIFY] `services/api/agent/prompt.py` — `ComparisonPrompts.MODE_INSTRUCTIONS["compare"]`

```
## Mode: COMPARE — Decision Facilitator
You're helping this traveler choose a vacation between their shortlisted destinations. Find out what matters most to them for this trip, and keep the comparison matrix lined up against that — so they can see, side by side, how their options stack up on the things they actually care about.

What to Do:
1. **First-turn**: As soon as destinations are compared, generate the matrix for all of them with a sensible starting set of criteria (e.g. 'Weather', 'Getting Around', 'Top attractions') — don't restate vibes or narrate findings in chat, the matrix and cards do that. Then ask what matters most to them in choosing their next vacation.
2. **Make the Cards Personal**: `best_for` is this traveler's personalised "trip feel" — given what you know about them, what would THEIR trip here actually be like? (`vibe` already covers the place itself — don't repeat it.) `seasonal_note` is what the destination is like during the time of year they're planning to travel.
   `matrix_rows`: a flat array of objects — a 'criterion' key (e.g. 'Weather', 'Getting Around', 'Top attractions') plus one key per shortlisted destination with a short descriptive string. E.g. [{'criterion': 'Weather', 'Santorini': 'Sunny, 25C', 'Amalfi Coast': 'Warm, 23C'}]. No nested 'header'/'rows' wrapper. A 'Best Suited For' row (honeymoons, families, foodies, etc.) is often a good matrix row.
3. **Track What Matters as It Comes Up**: When the traveler mentions a new must-have, deal-breaker, or worry, add it to the profile AND as a matrix row. If nothing new came up, leave the matrix as it is.
4. **No Markdown Tables**: **NEVER** print tables, matrices, or tabular structures in `text_reply` — the right-hand panel handles all of that.

Available Tools: Profile updates and comparison generation (system handles automatically—don't mention them).
```

**Notes**: old item 6 is dropped (redundant with `SHARED_GUIDELINES`'s "ALWAYS end with ONE focused question"); old items 3+4 merge into item 3 here — "ask, and update the matrix only if something new came up" is one instruction, not two.

---

### 4.2 `vibe` / `best_for` Content Redefinition (tool-schema description edits only)

Per planning §5 Phase 2 item 3, §7 decision 1. **No field rename, no state/FE change** — `vibe` and `best_for` keep their names and structure; only the tool-schema *descriptions* that shape what the model writes into them change. `vibe` is written by the Explore agent's `suggest_candidates` tool (`TOOL_SUGGEST_CANDIDATES`); `best_for` is written by the Comparison agent's `generate_comparison_matrix` tool (`TOOL_GENERATE_COMPARISON_MATRIX`). Both schemas live in `orchestrator.py` as shared tool definitions — this item touches both, even though it's listed under "Comparison agent" in planning (that's where the `best_for` redefinition lives; `vibe`'s redefinition is the other half of the same content split).

#### [MODIFY] `services/api/agent/orchestrator.py` — `TOOL_SUGGEST_CANDIDATES.candidates.items.properties.vibe` (currently line 52)

```python
                            "vibe": {
                                "type": "string",
                                "description": (
                                    "1-sentence description of what this destination is actually like — its character and atmosphere (e.g. 'a laid-back island with whitewashed villages and volcanic beaches')."
                                ),
                            },
```

#### [MODIFY] `services/api/agent/orchestrator.py` — `TOOL_GENERATE_COMPARISON_MATRIX.candidates_details.items.properties` (currently lines 86-90)

```python
                        "properties": {
                            "name": {"type": "string"},
                            "best_for": {
                                "type": "string",
                                "description": (
                                    "This traveler's personalised 'trip feel' for this "
                                    "destination — given their profile, what would THEIR trip here actually be like? Not a general description of the place — that's `vibe`."
                                ),
                            },
                            "seasonal_note": {
                                "type": "string",
                                "description": (
                                    "What this destination is like during the time of year this traveler is planning to visit."
                                ),
                            },
                        },
```

The Comparison-agent prompt changes for this item are already covered by §4.1's item 2 ("Populate the Cards") above — no separate prompt edit needed beyond the rewrite.

---

### 4.3 Shared Guidelines: Reduce Mirroring

Per planning §5 Phase 2 item 4 — same edits as §3.4, retargeted to this agent's tools/surfaces.

#### [MODIFY] `services/api/agent/prompt.py` — `ComparisonPrompts.SHARED_GUIDELINES`, item 1 (currently line 143)

```
1. **Concise & Human**: Be concise and direct. You are a travel consultant, not a form. Max 3 sentences per response unless presenting structured output.
```

#### [MODIFY] `services/api/agent/prompt.py` — `ComparisonPrompts.SHARED_GUIDELINES`, item 4 (currently line 146)

```
4. **Don't Narrate**: When you update the profile or comparison matrix, do not list or recite what you just recorded ("I've noted you like X, Y, Z" / "I've added a row for..."). Do not paraphrase or validate what the user just told you before responding — act on it instead. The matrix updating IS the acknowledgment.
```

---

### 4.4 Decision-Mode Handoff Pass

Per planning §5 Phase 2 item 5, §7 decision 2: "a light consistency pass on `MODE_INSTRUCTIONS["decision"]` so its opening connects naturally to how Compare concludes — a handoff-smoothing pass, not a new 'ready to decide?' prompt." Scoped to item 1's opening only; items 2-3 and the mode's job sentence are unchanged.

#### [MODIFY] `services/api/agent/prompt.py` — `ComparisonPrompts.MODE_INSTRUCTIONS["decision"]`, item 1 (currently line 133)

```
1. **Open With Why It Won**: Ground your opening in 1-2 specific reasons this destination stood out — pull from the comparison matrix and trip profile (the criteria that mattered most during Compare). This should read as a natural continuation of the comparison, not a generic congratulations.
```

Items 2 ("Pivot to Action") and 3 ("Warm Consultant Tone") are unchanged verbatim.

---

## 5. Task Breakdown

### Phase 1: Explore Agent (bugfix first, isolated from prompt-rewrite items)
- [ ] **1.1** — `orchestrator.py`: add module-level `_merge_unique` helper (§3.1).
- [ ] **1.2** — `orchestrator.py`: `_apply_tool_call` — `vacation_type`/`likes`/`avoid` use `_merge_unique` instead of wholesale replace (§3.1).
- [ ] **1.3** — `orchestrator.py`: rewrite `TOOL_UPDATE_TRIP_PROFILE` top-level description and `vacation_type` field description for the unified additive-merge semantics (§3.1).
- [ ] **1.4** — `main.py`: `profile_override` — drop the `len(value) > 0` guard so empty lists sync (§3.1).
- [ ] **1.5** — `prompt.py`: `ExplorePrompts.MODE_INSTRUCTIONS["explore"]` item 1 rewrite — skip profile update on turn 1, "already have destinations" branch (§3.2).
- [ ] **1.6** — `prompt.py`: `ExplorePrompts.MODE_INSTRUCTIONS["explore"]` — insert new item 3 ("Ask About a Past Trip, Early"), renumber old 3→4, 4→5 (§3.3).
- [ ] **1.7** — `prompt.py`: `ExplorePrompts.SHARED_GUIDELINES` items 1 & 4 — mirroring reduction (§3.4).

### Phase 2: Comparison Agent
- [ ] **2.1** — `prompt.py`: `ComparisonPrompts.MODE_INSTRUCTIONS["compare"]` — full rewrite around the unified mission, opening-turn behaviour, and per-tool call conditions (§4.1).
- [ ] **2.2** — `orchestrator.py`: `TOOL_SUGGEST_CANDIDATES.candidates.items.properties.vibe` — destination-descriptive description (§4.2).
- [ ] **2.3** — `orchestrator.py`: `TOOL_GENERATE_COMPARISON_MATRIX.candidates_details.items.properties.best_for` / `.seasonal_note` — add "trip feel" / seasonal descriptions (§4.2).
- [ ] **2.4** — `prompt.py`: `ComparisonPrompts.SHARED_GUIDELINES` items 1 & 4 — mirroring reduction (§4.3).
- [ ] **2.5** — `prompt.py`: `ComparisonPrompts.MODE_INSTRUCTIONS["decision"]` item 1 — handoff-consistency rewrite (§4.4).

---

## 6. Live-Testing Verification Scenarios

Per planning §7 decision 8, this is a short list of scenarios to walk through during live testing — not formal test scripts.

1. **First turn, normal path**: fresh session via "Inspire me where to go". Confirm the agent does *not* call the profile-update tool on turn 1, suggests 3 candidates, and its chat message moves straight to likes/motivations rather than restating onboarding fields.
2. **First turn, "already have destinations" path**: fresh session via "I already have destinations in mind". Confirm 3 best-guess candidates still populate the panel, and the chat message asks the user to name their destination(s) rather than describing the 3 shown. Follow up by naming a destination and confirm it's added as a candidate on the next turn.
3. **Past-trip question**: continue the conversation for 2-3 turns. Confirm the agent asks about a past trip that went well/badly within turns 2-3, without crowding out the trade-off-question guidance entirely.
4. **Mirroring check**: across several turns in both Explore and Compare, confirm the agent doesn't open replies by paraphrasing/validating what the user just said (e.g. "Avoiding crowds will definitely help with that relaxed feel...").
5. **Trip-profile additive merge + UI removal**: add several `vacation_type`/`likes`/`avoid` items across turns and confirm none silently disappear even if a later tool call sends a shorter list. Then remove the last chip from one of these fields via the Trip Profile panel and confirm it's actually gone from `session.plan.trip_profile` on the next turn (not silently re-added by the merge).
6. **Compare opening turn**: shortlist 2-3 candidates and switch to Compare. Confirm the matrix generates immediately for the shortlisted destinations, the chat doesn't restate vibes or narrate findings, and the message orients the user and asks what matters most.
7. **Compare tool discipline**: continue in Compare for a couple of turns without revealing new preferences. Confirm the agent doesn't reflexively regenerate the matrix or call the profile update when there's nothing new.
8. **Vibe vs. trip-feel distinction**: inspect a shortlisted candidate's `vibe` (set in Explore) and `best_for` (set in Compare) side by side — confirm `vibe` reads as "about this place" and `best_for` reads as "what this trip would feel like for you".
9. **Decision handoff**: progress to Decision mode. Confirm the opening message references specific reasons (from the matrix/profile) the chosen destination won, rather than a generic congratulations.

---

## 7. Constraints Carried Forward

1. Flat JSON tool schemas only — no Pydantic schema generation for Groq tools; `additionalProperties` not used in nested schemas.
2. Dual-call conditional ReAct loop preserved, per agent.
3. Client owns `uiState.mode` — server responses must not override it.
4. Candidate upsert by `name.lower()` — never replace the full array; shortlisted names skipped; un-rejected candidates deleted from `session.plan.candidates`.
5. State JSON to LLM strips backend-only candidate fields (`_clean_candidates_for_prompt`), shared by both agents.
6. Tool function names never appear in system prompt instructions.
7. `TOOL_FORMAT_NUDGE` remains Call-1-only, never persisted to `session.history`.
8. Learning notebooks are not part of the build process.
9. One `AgentOrchestrator` class, parameterised by `AgentConfig` — not separate orchestrator subclasses per agent.
10. No handoff marker in shared history — two-pass pruned history is the sole handoff mechanism between agents on a mode change.
11. `MAX_HISTORY_TURNS = 5`; `_prune_history` runs after `_filter_history`.
12. `GROQ_API_KEY_2` provisioned and in use — both agents have independent rate-limit pools.
13. **New this sprint**: `vacation_type`/`likes`/`avoid` updates via the profile-update tool are additive-only (server-side union merge); removal is a UI-only action via the Trip Profile panel (§3.1).
14. **New this sprint**: `vibe` (Explore) is destination-descriptive ("about this place"); `best_for` (Compare) is personalised "trip feel" ("why this fits/feels right for you"). Same field names and schema structure — content only (§4.2).

---

## 8. Resolved Decisions

- "Single driving question" sentence dropped from `MODE_INSTRUCTIONS["compare"]` (§4.1, old item 6) — `SHARED_GUIDELINES` item 2 already covers it for both agents.
- "Best Suited For" matrix-row suggestion (§4.1, item 3) confirmed as drafted, alongside the personalised `best_for` card field.
- "Ask About a Past Trip, Early" (§3.3) and "already have destinations" branch (§3.2) are first-draft wording — to be reviewed for clarity and meaning as part of the full read-through, ahead of live-testing.
- `_merge_unique`'s exact-match case-insensitive dedup (§3.1) is sufficient — no fuzzy dedup needed this sprint.

This draft is otherwise unreviewed — over to the PM for the full read-through. Per `agents.md`, nothing in this document is final until the PM approves it.
