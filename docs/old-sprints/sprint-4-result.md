# Sprint 4 Final State: The User-Driven Decision Workspace

**Status**: Complete — core mechanics working, design fidelity incomplete  
**Date**: 29th May 2026

This document describes the end of Sprint 4 code state.

---

## 1. Summary

Sprint 4 implements a user-driven workspace with a split-panel UI, persistent Trip Profile, explore-mode destination cards, a shortlist comparison view, and a decision view. The frontend now controls `mode` and the backend fills content. The implementation is functional, but the UI diverges slightly from the Lovable reference screens.

---

## 2. Sprint 3 → Sprint 4: Before vs. After

| Dimension | Sprint 3 (Before) | Sprint 4 (After) |
|---|---|---|
| **Control model** | Agent drives phase transitions via `transition_phase` tool | Frontend drives mode transitions via UI actions; agent is content-only |
| **State model** | `Phase` enum (`intake/explore/shortlist/compare`) | `mode` string (`explore/compare/decision`); synced via `ui_state` in every request |
| **Right panel** | Debug sidebar with phase breadcrumb + candidate list | Persistent Trip Profile + Candidate Area (3 modes) |
| **Candidate tracking** | Phase-gated cart managed by agent | Visual cards with shortlist bar; client owns shortlist |
| **Image sourcing** | None | Unsplash Search API (server-resolved); generic fallback when key absent |
| **Tools** | `update_plan`, `manage_candidates`, `transition_phase`, `generate_mcdm_matrix` | `update_trip_profile`, `suggest_candidates`, `generate_comparison_matrix` |
| **Compare artifact** | MCDM matrix dumped inline in chat | `generate_comparison_matrix` populates shortlist cards; no table in chat |
| **Frontend entry** | Direct to chat | Landing screen with sentence builder |
| **Prototype** | Only frontend existed | Preserved at port 5174 with isolated `/chat/prototype` endpoint |
| **Fallback model** | `llama-3.1-8b-instant` | `qwen/qwen3-32b` |

---

## 3. Current Architecture

### Frontend
- `apps/web/src/App.tsx` controls session lifecycle, renders the landing screen, chat panel, trip profile, and candidate area.
- `apps/web/src/hooks/useAgent.ts` handles backend communication, response merging, and preserves `uiState.mode` authority.
- `apps/web/src/components/CandidateArea.tsx` renders three views: `explore`, `compare`, and `decision`.
- `apps/web/src/components/CandidateCard.tsx` and `apps/web/src/components/ShortlistCard.tsx` are the primary card components.
- `uiState.mode`, `uiState.shortlist`, and `uiState.selected_winner` are client-controlled; server responses update content but do not override mode.

### Backend
- `services/api/main.py` exposes:
  - `POST /chat` for Sprint 4 agent state and interaction.
  - `POST /chat/prototype` for the preserved Sprint 3 prototype path.
- `services/api/agent/orchestrator.py` selects mode-appropriate tools and runs a dual-call ReAct loop.
- `services/api/agent/prompt.py` contains mode-specific prompts and compare-mode guardrails.
- `services/api/core/image_resolver.py` resolves destination photos via Unsplash or falls back to a generic image.
- `services/api/agent/session.py` separates Sprint 4 and Sprint 3 prototype session managers.

### Data contract
- Client request payload: `{ message, session_id, ui_state: { mode, shortlist, selected_winner } }`.
- Backend response includes: `text_reply`, `plan`, `trip_profile`, `candidates`, `comparison_matrix`.
- The backend reconciles incoming `ui_state`, preserves selected winner and shortlist state, and returns plan content updates.

---

## 4. Implementation Notes

- `CandidateArea.tsx` uses `mode={uiState.mode}` and does not rely on `plan.mode` for view rendering.
- `useAgent.ts` preserves client authority by excluding `mode` from server merges.
- Shortlist candidate matching is performed by `name.toLowerCase()`.
- `suggest_candidates` tool schema excludes `photo_url`; the backend adds `photo_url` server-side.
- `ShortlistCard.tsx` resolves comparison matrix entries using case-insensitive destination name lookup.
- `main.py` assigns `plan.mode = ui_state.mode`, preserves `selected_winner`, and maintains shortlist status on candidates.
- `orchestrator.py` uses `GROQ_PRIMARY_MODEL` and `GROQ_FALLBACK_MODEL` from `services/api/core/config.py`.
- `prototype_models.py`, `prototype_orchestrator.py`, and `prototype_prompt.py` remain isolated under `/chat/prototype`.

---

## 5. Final Technical Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  React Frontend — apps/web/src/                              │
│                                                              │
│  LandingScreen.tsx ──► handleStartSession ──► sendMessage    │
│                                                              │
│  App.tsx (session started)                                   │
│  ┌─────────────────────┐   ┌────────────────────────────┐    │
│  │ ChatInterface.tsx   │   │ TripProfileComponent.tsx   │    │
│  │ (left, 35%)         │   │ (right, top, fixed height) │    │
│  └─────────────────────┘   └────────────────────────────┘    │
│                             ┌────────────────────────────┐    │
│                             │ CandidateArea.tsx          │    │
│                             │  mode = uiState.mode       │    │
│                             │  ┌─ explore: CandidateCard │    │
│                             │  │          + ShortlistBar │    │
│                             │  ├─ compare: ShortlistCard │    │
│                             │  │          + NotQuiteRight│    │
│                             │  └─ decision: winner card  │    │
│                             └────────────────────────────┘    │
│                                                              │
│  useAgent.ts: manages messages, plan, uiState, isLoading     │
│  - Client authoritative for uiState.mode                     │
│  - Shortlist synced from server candidate statuses           │
│  - overrideUiState pattern for immediate transition sends    │
└──────────────────────────┬───────────────────────────────────┘
                           │  POST /chat
                           │  { message, session_id, ui_state: { mode, shortlist, selected_winner } }
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  FastAPI Backend — services/api/                             │
│                                                              │
│  main.py                                                     │
│  ├─ POST /chat ──► session_manager (Sprint 4 VacationPlan)   │
│  │    State reconciliation:                                  │
│  │      plan.mode = ui_state.mode                            │
│  │      candidates marked shortlisted by name match         │
│  │      plan.selected_winner = ui_state.selected_winner      │
│  │    AgentOrchestrator.run_turn()                           │
│  │    Returns: text_reply, plan, trip_profile, candidates,   │
│  │             comparison_matrix                             │
│  └─ POST /chat/prototype ──► prototype_session_manager       │
│       (PrototypeVacationPlan — Sprint 3 schema)              │
│       PrototypeAgentOrchestrator.run_turn()                  │
│                                                              │
│  agent/orchestrator.py                                       │
│    _get_tools_for_mode:                                      │
│      explore:  [update_trip_profile, suggest_candidates]     │
│      compare:  [update_trip_profile, generate_comparison_matrix]│
│      decision: []                                            │
│    _call_llm: primary=llama-3.3-70b, fallback=qwen/qwen3-32b│
│    Dual-call ReAct loop (conditional on tool use)            │
│    Image resolution: core/image_resolver.py (Unsplash API)   │
│                                                              │
│  agent/prompt.py                                             │
│    Mode-gated: EXPLORE / COMPARE / DECISION instructions     │
│    No tool names in prompts                                   │
│    Compare: explicit "No Markdown Tables" rule               │
└──────────────────────────────────────────────────────────────┘

Ports:
  :8000  FastAPI backend (both endpoints)
  :5173  Sprint 4 frontend (apps/web)
  :5174  Sprint 3 prototype (apps/prototype-web)
```

---

## 6. Known Gaps

- Session state is in-memory only and is lost on server restart.
- `DebugPanel.tsx` exists but is not wired into the live route.

---

## 7. State Schema (Final)

### Sprint 4 (`services/api/agent/models.py`)

```python
class TripProfile(BaseModel):
    origin: Optional[str] = None
    travelers: Optional[str] = None
    when: Optional[str] = None
    duration: Optional[str] = None
    budget: Optional[str] = None
    vacation_type: Optional[str] = None
    likes: List[str] = Field(default_factory=list)
    avoid: List[str] = Field(default_factory=list)

class DestinationCandidate(BaseModel):
    name: str
    region: str
    vibe: str
    photo_url: str           # Server-resolved, never from LLM
    status: str = "suggested"  # "suggested" | "shortlisted"
    best_for: Optional[str] = None
    seasonal_note: Optional[str] = None

class VacationPlan(BaseModel):
    mode: str = "explore"    # "explore" | "compare" | "decision"
    trip_profile: TripProfile = Field(default_factory=TripProfile)
    candidates: List[DestinationCandidate] = Field(default_factory=list)
    selected_winner: Optional[str] = None
    comparison_matrix: Optional[List[dict]] = None
    notes: str = ""

class UiState(BaseModel):
    mode: str = "explore"
    shortlist: List[str] = Field(default_factory=list)
    selected_winner: Optional[str] = None
```

**Candidate upsert rule**: By `name.lower()`. Existing `status`, `best_for`, and `seasonal_note` are preserved when `suggest_candidates` re-suggests an existing name.

**Comparison matrix row shape**: `{ "criterion": str, "<DestinationName>": str, ... }`. Frontend resolves value with case-insensitive name lookup.

---

## 8. Tool Definitions (Final)

Three tools, all flat JSON (no Pydantic `$ref`, no `$defs`).

```
update_trip_profile     → 8 optional scalar/array fields; no required
suggest_candidates      → candidates array (name, region, vibe only — no photo_url)
generate_comparison_matrix → matrix_rows + candidates_details (best_for, seasonal_note)
```

Tool availability per mode:
- `explore`: `update_trip_profile`, `suggest_candidates`
- `compare`: `update_trip_profile`, `generate_comparison_matrix`
- `decision`: none

**Notable**: `orchestrator.py` line 241–244 adds a dynamic system message injection when fewer than 3 `suggested` candidates exist in explore mode: `"CRITICAL: You currently have N 'suggested' candidates. You MUST suggest..."`. This is a runtime guard that was added ad-hoc and is not in the spec. It is functional but is not a clean design pattern — it mixes dynamic state-conditional text injection with the normal system prompt.

---

## 9. The Dual-Call ReAct Loop

Preserved as specified. Verified in `orchestrator.py run_turn()`:

1. LLM Call 1: `tool_choice="auto"` with mode-appropriate tools
2. If tool calls present: execute all tools → update plan → append `{"role": "tool"}` messages
3. Rebuild system prompt with updated plan state
4. LLM Call 2: `tool_choice="none"` — observes tool results and generates final reply
5. If no tool calls: use Call 1's response directly

The flat-schema and dual-call constraints from Sprint 3 are intact.

---

## 10. Agent Behavior (Prompt Summary)

**Explore mode**: "Diagnostic Profiler & Matchmaker." Profile-first questions. Candidates are backdrop, not interrogation targets. First turn must call tools to update profile AND suggest candidates. `suggest_candidates` called on first turn; afterwards when profile shift warrants it or user requests change. Explicit: agent must never ask "Do you like [Destination]?" or "Should we add [Destination]?". "No Image Sourcing" instruction present.

**Compare mode**: "Analytical Consultant." Full matrix in one turn. Explicit "No Markdown Tables" rule. Trade-offs in ≤3 sentences in chat. No new destination suggestions unless user asks.

**Decision mode**: "Celebrator & Facilitator." No tools. Celebrate and pivot to logistics.

**Shared guidelines**: Concise, warm, 3-sentence max. End with questions. Never mention tool names.

---

## 11. Directory Map (Post-Sprint 4)

```
vacation-planner/
├── agents.md
├── README.md                              Updated: dual-frontend startup, Unsplash key note
├── requirements.txt
│
├── docs/
│   ├── project-brief/
│   ├── old-sprints/
│   ├── sprint-3-planning.md
│   ├── sprint-3-result.md                 Sprint 3 baseline (still authoritative for Sprint 3)
│   ├── sprint-4-planning.md
│   ├── sprint-4-spec.md
│   ├── sprint-4-designbrief.md
│   ├── sprint-4-build-changes.md          First-pass build log (PM QA notes)
│   ├── sprint-4-fix-plan.md               Fix campaign authority document
│   └── sprint-4-result.md                 ← THIS FILE
│
├── services/api/
│   ├── main.py                            Two endpoints: /chat and /chat/prototype
│   ├── core/
│   │   ├── config.py                      GROQ_PRIMARY/FALLBACK_MODEL, UNSPLASH_ACCESS_KEY
│   │   ├── image_resolver.py              NEW: Unsplash Search API + generic fallback
│   │   └── llm.py                         Groq client factory (unchanged)
│   └── agent/
│       ├── models.py                      Sprint 4 schema (TripProfile, DestinationCandidate, VacationPlan, UiState)
│       ├── orchestrator.py                Mode-gated tools; dual-call ReAct; server image resolution
│       ├── prompt.py                      Mode-gated prompts; No Markdown Tables rule in compare
│       ├── session.py                     SessionManager (S4) + PrototypeSessionManager (S3)
│       ├── prototype_models.py            NEW: Sprint 3 schema locked (Phase, TripShape, MentalModel, etc.)
│       ├── prototype_orchestrator.py      Locked Sprint 3 agent (imports from prototype_models)
│       └── prototype_prompt.py            Locked Sprint 3 prompts
│
├── apps/
│   ├── web/                               Sprint 4 frontend (port 5173)
│   │   └── src/
│   │       ├── index.css                  Fraunces + Inter; full oklch vacation palette; design tokens
│   │       ├── App.tsx                    Mode from uiState (not plan); all transition handlers
│   │       ├── types.ts                   Mode, TripProfile, DestinationCandidate, VacationPlan, UiState
│   │       ├── hooks/
│   │       │   └── useAgent.ts            Client-authoritative mode; overrideUiState pattern
│   │       └── components/
│   │           ├── LandingScreen.tsx      Sentence builder (differs from Lovable reference)
│   │           ├── TripProfileComponent.tsx Two-row layout; icons; "not set" state
│   │           ├── CandidateArea.tsx      Three-mode switch; 3-across explore grid; compare grid
│   │           ├── CandidateCard.tsx      NEW (extracted): photo, vibe box, two CTAs
│   │           ├── ShortlistCard.tsx      NEW (extracted): photo, vibe, best_for, seasonal_note, matrix rows
│   │           ├── ChatInterface.tsx      Unchanged in structure from Sprint 3
│   │           └── DebugPanel.tsx         Exists; unwired
│   │
│   ├── prototype-web/                     Sprint 3 frontend (port 5174)
│   │   └── src/ ...                       Locked Sprint 3 code; endpoint: /chat/prototype
│   │
│   └── lovable-ui/                        Lovable-generated design reference (not deployed)
│       └── src/
│           ├── routes/                    index.tsx, early.tsx, shortlist-a.tsx, decision.tsx etc.
│           └── components/               CandidateCard, ShortlistCard, TripProfile, Logo, ChatPanel
│
└── learning-notebooks/                    Unchanged; non-functional; not part of build process
```

---

## 12. Future Starting Point

The future starting point begins from a working application that uses a design that slightly deviates from the specific design contained in the Lovable folder. The interaction model is correctly implemented. The agent tools, state sync, and prototype isolation are correct. Several constraints from prior sprints remain in force:

1. **Flat JSON tool schemas only** — no Pydantic schema generation for Groq tools.
2. **Dual-call ReAct loop** — do not remove the second LLM call when tools are used.
3. **Client owns mode transitions** — `uiState.mode` is authoritative; never overwrite from server response.
4. **Candidate upsert by `name.lower()`** — never replace the full candidates array.
5. **Learning notebooks are not part of the build process.**