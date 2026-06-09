# **Sprint 7 Planning (WIP)**

## **1\. Executive Alignment**

**Purpose**: To unify the frontend stack so Lovable designs can be incorporated cleanly in future sprints, and implement direct Trip Profile inline editing using the Lovable design already in the repo.

**Context**: Sprint 6 is complete. Session reliability is fixed, token usage is under control, and prompt-level bugs are resolved. Two items were explicitly deferred from Sprint 6 into Sprint 7: direct profile editing, and the un-reject bug. Additionally, the design→code workflow has surfaced a structural problem: the web app runs Tailwind v3 while Lovable outputs Tailwind v4, causing CSS class incompatibilities that force manual translation work and create opportunities for coding agent errors. We want to fix this now — before adding more Lovable-designed features — to prevent this ongoing tension.

**Sprint Goal**: Eliminate the Tailwind version gap so Lovable components port with minimal translation; fix the un-reject bug; implement full Trip Profile inline editing (scalar and array fields) using the Lovable design.

**The Meta-Goal**: Test "Real-World AI Engineering". The product should be designed by copying existing solutions from real B2C products (e.g. Mindtrip, Layla). It's a product-copying project, not a meta-coding or meta-product project.

**Design reference**: `apps/lovable-ui/src/components/TripProfile.tsx` is the authoritative UI reference for Phase 3\. Do not deviate from it. See `docs/sprint-7-designbrief.md` for UX intent.

\[\!IMPORTANT\] **Architectural constraints to preserve (from prior sprints)**:

1. Keep the **Client-Authoritative State Sync** (frontend owns `mode`, backend owns content).  
2. Preserve the **Conditional Dual-Call ReAct Loop** in the backend orchestrator.  
3. Use **flat JSON tool schemas only** — no Pydantic schema generation for Groq tools; `additionalProperties` not used (Groq silently drops tools that include it in nested schemas).  
4. The agent fails every time you give it a tool name in the system prompt. Do not re-insert tool names into instructions.  
5. Candidate upsert is by `name.lower()` — never replace the full array; shortlisted names are skipped.

\[\!IMPORTANT\] **Lovable is a visual reference, not a working application.** When porting a Lovable component, copy its CSS classes and layout. Never adopt its prop types or data model — those use hardcoded demo data. The web app's existing prop interfaces are authoritative.

---

## **2\. Issues to address**

### UI stack mismatch causes recurring translation errors

Lovable runs Tailwind v4 (`@import "tailwindcss"` with `@theme inline`). The web app runs Tailwind v3 (`@tailwind base/components/utilities` with `tailwind.config.js`). The CSS token values are identical across both, but Tailwind v4's opacity modifier syntax (`bg-ocean/10`, `bg-muted/50`) does not work in Tailwind v3, which requires pre-baked alpha tokens (`bg-ocean-bg`, `bg-muted-soft`). Every time a Lovable component is ported, the coding agent must manually translate these — and has made mistakes doing so in previous sprints.

Additionally, Lovable generates shadcn-style UI primitives in `components/ui/` (e.g. `popover.tsx`). The web app currently imports Radix primitives directly, so import paths differ. This is a smaller issue but adds to the translation surface.

### Un-reject immediately restores candidate to the grid (Bug)

When a user un-rejects a candidate, the backend restores it to `suggested` status, causing it to reappear in the candidate grid immediately — without the agent having decided it belongs there. The intended behaviour is that un-rejecting (from the rejected list dock) makes a destination *eligible* for future suggestion only. Fix: on un-reject, remove the candidate from `session.plan.candidates` entirely rather than flipping its status to `suggested`. It can only return to the grid if the agent actively re-suggests it.

### Trip Profile fields are not directly editable

Users cannot correct a profile field (e.g. "Budget: Mid-range" should be "Luxury") without typing a chat message and waiting for an agent turn. The Lovable reference design (`apps/lovable-ui/src/components/TripProfile.tsx`) implements click-to-edit popovers for all fields — both scalar (Origin, Travelers, When, Duration, Budget) and array chips (Vacation type & vibe, Things we like, Let's avoid).

### Agent reads stale shortlist when shortlist changes just before a message is sent

Observed during Sprint 6 testing: user had Kerry and Icefields Parkway shortlisted in Compare mode. Navigated back to Explore, removed Kerry, added Westfjords. Navigated forward with the pre-formed message "I'd like to compare my shortlist now." The agent responded as if Kerry was still on the shortlist and failed to produce information for Westfjords. On the next message (a re-prompt), the agent correctly saw the updated shortlist (Icefields Parkway \+ Westfjords) and fixed its response.

Implication: The agent was one message behind — it acted on the shortlist state from the previous turn rather than the current one. Root cause not yet confirmed.

This is worth bearing in mind for the profile editing work in Phase 3: if the same timing issue applies, user edits to the Trip Profile may not be seen by the agent until the message *after* the one sent immediately following an edit. The coding agent should be aware of this risk and consider how profile edit state is captured and passed in the POST payload.

### `vacation_type` is a scalar field; the Lovable design treats it as a chip array

The backend `TripProfile` model and frontend `types.ts` both define `vacation_type` as an `Optional[str]` / `string | null` scalar. The Lovable design renders it as a chip array (same pattern as `likes` and `avoid`). This field needs to be migrated to a list type across the full stack: `models.py`, `types.ts`, the `update_trip_profile` tool schema, and `prompt.py`.

The field name stays `vacation_type` — do not rename it. The Lovable component (`apps/lovable-ui/src/components/TripProfile.tsx`) internally uses `opts.vibe` as the prop name and `"vibe"` as the `TripField` key for this field. This is a Lovable naming error. When porting the component, rename these to `opts.vacation_type` and key `"vacation_type"` respectively. Note: `vibe` is already a field on `DestinationCandidate` (a prose description of a destination's character) and must not be reused for a trip profile field.

---

## **3\. Ideation**

### Problem: Tailwind v3 vs v4 mismatch

* **Option A — Migrate `apps/web` to Tailwind v4**: Change `@tailwind` directives to `@import "tailwindcss"`, move `tailwind.config.js` theme colours into `@theme inline` in `index.css`, remove the config file. After this, Lovable's opacity modifier classes (`bg-ocean/10` etc.) work directly. The colour token values are already identical, so this is largely a structural change. Pre-baked alpha tokens in `tailwind.config.js` (e.g. `bg-ocean-bg`) can remain as aliases for backward compatibility, but will no longer be required.  
* **Option B — Keep Tailwind v3, extend config with more pre-baked tokens**: Add every opacity variant Lovable uses to `tailwind.config.js`. Lower disruption but perpetuates the translation problem indefinitely.  
* **Recommendation**: Option A. The token values are already in sync; the migration is mechanical. Every future sprint benefits.  
* **PM Response**: Option A is the obvious choice and it should ALWAYS have been implemented this way. Note that when I say “match the UI in the folder” I mean it with 100% clarity. It should not have taken 3 sprints to fix this issue \- patching on top of shitty implementation pisses me off.

### Problem: `components/ui/` path mismatch

* Copy the required ui primitives from `apps/lovable-ui/src/components/ui/` into `apps/web/src/components/ui/`. Update all existing components in `apps/web` that currently import Radix primitives directly (e.g. `CandidateCard.tsx`) to use the `@/components/ui/` wrappers instead. One pattern across the whole codebase.

### Problem: Un-reject bug

* On un-reject, delete the candidate from `session.plan.candidates` rather than setting its status to `suggested`. This is a single-line change in the un-reject handler.

### Problem: Trip Profile not directly editable

* Port `apps/lovable-ui/src/components/TripProfile.tsx` to replace `apps/web/src/components/TripProfileComponent.tsx`. The Lovable component is the complete implementation — do not rewrite or simplify it. After the Tailwind v4 migration, the only changes needed are: (1) align prop/field names to `types.ts`, (2) ensure the popover import resolves via `@/components/ui/popover`.  
* User edits update local React state immediately. The updated profile is included in the next `POST /chat` payload — no separate endpoint, no auto-trigger.

---

## **4\. The Strategy: Unify, fix, then build**

Three threads run in sequence (Phase 1 is a prerequisite for Phase 3):

**Phase 1 — Stack unification**: Migrate `apps/web` from Tailwind v3 to Tailwind v4. Copy the required `components/ui/` primitives from `lovable-ui`. Verify existing components render correctly after migration. This is a prerequisite for Phase 3\.

**Phase 2 — Un-reject bug fix**: Change the un-reject handler to remove the candidate from `session.plan.candidates` entirely. Backend-only change; no frontend work required.

**Phase 3 — Trip Profile inline editing**: Port the Lovable `TripProfile.tsx` to the web app as a replacement for `TripProfileComponent.tsx`. Migrate the `vacation_type` scalar field to a list type across the full stack. Wire the edited profile values into the existing `POST /chat` payload. Before wiring up the payload, investigate and resolve the state timing issue described in section 2 — the profile edit mechanism must not reproduce the same one-turn lag observed with the shortlist.

---

## **5\. Items selected for Sprint 7**

### Sprint 7: Stack unification, bug fix, and Trip Profile editing

*Focus: Fix the structural UI friction, close a known bug, and deliver direct profile control.*

**Phase 1: Stack Unification (prerequisite — do this first)**

* **Tailwind v4 migration**: In `apps/web`, replace `@tailwind base/components/utilities` with `@import "tailwindcss"`. Mirror the `@theme inline` block and CSS custom properties from `apps/lovable-ui/src/styles.css` exactly into `apps/web/src/index.css`. Delete `tailwind.config.js` and all pre-baked alpha tokens (`bg-ocean-bg`, `bg-muted-soft`, `bg-destructive-bg`, etc.) — they were v3 workarounds and must not survive the migration. After migration, verify all views render correctly before proceeding.
* **Copy `components/ui/` primitives**: Copy all primitives from `apps/lovable-ui/src/components/ui/` into `apps/web/src/components/ui/`. This replaces any existing Radix direct imports. One import pattern across the codebase.
* **Replace all web components with Lovable equivalents**: Every component in `apps/web` that has a counterpart in `apps/lovable-ui/src/components/` must be replaced with the Lovable version. This includes `CandidateCard.tsx`, `ShortlistCard.tsx` (which replaces the current shortlist/compare card regardless of what it is currently named), `ChatPanel.tsx`, and any others present in `apps/lovable-ui`. The current web implementations are incorrect builds of the intended design. The Lovable files are the authoritative source; do not preserve or merge with the existing web versions.

**Phase 2: Bug Fixes**

* **Un-reject removes candidate**: In the un-reject handler, delete the candidate from `session.plan.candidates` rather than setting its status to `suggested`. The candidate becomes eligible for future agent suggestion only.  
* **Stale state on send**: When the user modifies UI state (shortlist, profile) and immediately sends a message (most likely when using buttons tied to pre-formed messages), the agent receives the previous turn's state rather than the current one. Investigate how `uiState` is captured at send time in `useAgent.ts`, identify why stale values are being sent, and fix it so the payload always reflects the state at the moment the user hits send.

**Phase 3: Trip Profile Inline Editing**

* **Migrate `vacation_type` to a list field**: Change the type of `vacation_type` from `Optional[str]` / `string | null` to `List[str]` / `string[]` across `models.py`, `types.ts`, the `update_trip_profile` tool schema, and `prompt.py`. The field name `vacation_type` does not change. Update all references in `TripProfileComponent.tsx`, `LandingScreen.tsx`, and `useAgent.ts`. When porting the Lovable component, rename its internal `opts.vibe` prop and `"vibe"` key to `opts.vacation_type` and `"vacation_type"` — the Lovable naming is incorrect and must not be carried over.  
* **Port Lovable `TripProfile.tsx`**: Replace `apps/web/src/components/TripProfileComponent.tsx` with the Lovable component. Align prop names to match the updated `types.ts`. The component's public interface and internal logic must not be simplified — it is the reference implementation.  
* **Wire profile edits into chat payload**: The stale state bug is fixed in Phase 2. Profile edits must use the same corrected mechanism — edited values must be included in the `POST /chat` request body and reflect the state at the moment the user hits send. The vehicle is a `profile_override` field in the POST body, applied to `session.plan.trip_profile` before the orchestrator runs — the same pattern as `onboarding_profile` from Sprint 6.

---

## **6\. Proposed Roadmap for upcoming sprints (Sprints 8-10)**

### Sprint 8: Multi-agent & context sharding

*Focus: Create a second Agent to share the load and improve task execution.*

* **Simple Multi-Agent Architecture**: Split the Discovery Agent from the Comparison Agent to reduce the token count per agent configuration.  
* **Parallel API Keys**: Allow setting secondary keys or separating agent contexts.

### Sprint 9: Chat ID Continuation

*Focus: Implement session saving/continuation, persistent storage.*

* **ChatID to continue later**: Store the Trip Profile, Rejected Candidates, Shortlisted Candidates to allow users to return to their planning session later. Support random Chat ID generation and an input widget on the Landing Screen.  
* **Serialization & Persistence**: Decide whether to store state in cookies / browser local storage (lightweight continuation) or migrate to SQLite / Redis database storage.

### Sprint 10: Improve Agent performance for how people want to plan trips

*Focus: Improve conversation robustness and developer observability.*

* **Better entry for "I already have destinations"**: Pre-populate candidates from the user's opening message, skip broad exploration, move directly into profile-building alongside the known candidates.  
* **Improve solutions for Region- and Suburb-Level Analysis**: Implement the ability to narrow and compare at different levels of granularity (e.g., Country → Region → City → Suburb/Base).  
* **Developer Debug Panel**: Wire `DebugPanel.tsx` behind a visible toggle and extend it to display the pruned messages array and approximate token count alongside the existing plan JSON view. Investigate surfacing tool call failure logs from the orchestrator.

### Backlog of items not yet selected for any Sprint

* **Mobile UX**: Rethink the artifact UX — move candidates inline like ChatGPT/Claude and think about how mobile interactions work to build and evaluate a trip.  
* **Shareable / Exportable Trip Brief**: Generate a formatted PDF or Markdown document summarising the Trip Profile, the Comparison matrix (why this destination won), and the draft itinerary.  
* **Real-World Travel API Integration**: Learn about the various Travel APIs out there. Potential: Integrate mock flight duration, weather history, and cost indices to ground the candidate details in realistic travel metrics.  
* **Custom Comparison Criteria**: Allow users to inject custom comparison rows (e.g., "Add a row for kid-friendliness" or "Compare them on vegetarian food options"). The agent dynamically updates the matrix criteria.  
* **Itinerary Builder**: Once a destination is decided (Decision state), transition the Candidate Area to a structured 3-day or 7-day daily timeline draft with activity recommendations.  
* **Interactive Map Component**: Add a map overlay/view in the Candidate Area showing pins for current candidate destinations and rough routes.

---

## **7\. Next steps**

**Current status**:

1. Planning is in progress (WIP). Awaiting PM review and approval.  
2. Once approved, the `Sprint 7 Spec` will be written.  
3. The sprint is not yet ready for implementation.

**Decisions aligned between PM & Code-Agent**:

1. **Pre-baked alpha tokens**: Remove immediately after Tailwind v4 migration. They were a v3 workaround only. `apps/lovable-ui/src/styles.css` is the source of truth for all styling; the v4 opacity modifier syntax (`bg-ocean/10`, `bg-muted/50` etc.) is used throughout. No aliases to maintain.

2. **Lovable components are the authoritative UI**: There is no reason to keep the incorrect web UI. All existing web components that have a Lovable equivalent must be replaced with the Lovable version, not patched or translated. The Tailwind v4 migration in Phase 1 is the prerequisite that makes this clean porting possible.

3. **Profile edit UX affordance**: No indicator needed. Profile edits queue silently in local state and are applied on the next user-triggered send. No auto-trigger; no "pending changes" message.

4. **Profile edit mechanism to backend**: `profile_override` field in the POST body, applied to `session.plan.trip_profile` before the orchestrator runs. Same pattern as `onboarding_profile` from Sprint 6. Guarantees the agent always sees the user's current intent on the next send.

5. **`vacation_type` on the landing screen**: Single-entry input unchanged. On submit it sends a single-item array. The field supports multiple values when the user edits mid-session via the Trip Profile editor.

6. **Stale state root cause**: Investigated during spec writing. The spec must document the confirmed root cause and the fix — not defer to implementation.

7. **All Lovable components are in scope for Phase 1**: Every component in `apps/lovable-ui` that corresponds to an existing web app component must be replaced with the Lovable version in Phase 1 — `CandidateCard.tsx`, `ShortlistCard.tsx`, `ChatPanel.tsx`, and any others. The current web app implementations are incorrect builds of the intended design. The Lovable files are the authoritative source; nothing in the current web components takes precedence. `ShortlistCard.tsx` in particular replaces whatever the current shortlist/compare card is called in the web app; its detail rows are dynamically populated by the LLM via the comparison matrix tool — there is no fixed row schema.

**Decisions still open between PM & Code-Agent**:

* None