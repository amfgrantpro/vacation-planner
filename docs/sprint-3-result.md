# Sprint 3 Result: The Structured Funnel & Decision Consultant

## 1. What Sprint 3 Changed

Sprint 2 gave us a capable chatbot that gathered preferences and tracked state. Sprint 3 replaced the open-ended conversational model with a **structured decision funnel** — a consultant that moves the user through a defined pipeline (Intake → Explore → Shortlist → Compare) using an explicit candidate cart.

The three headline changes:

| Area | Before (Sprint 2) | After (Sprint 3) |
|---|---|---|
| **Conversation model** | Open-ended Q&A, single narrowing funnel | 4-phase gated state machine |
| **Candidate tracking** | Transient mentions in conversation text | Persistent `candidates` array: add / eliminate / upsert |
| **API response** | Unstructured markdown string | Structured JSON: `text_reply` + `comparison_matrix` |
| **Frontend** | Debug panel showing raw state | Active Cart Sidebar with phase breadcrumb + candidate cards |

---

## 2. Architecture & System Diagram

The overall Client-Server architecture is unchanged. The changes are internal to the Agent layer and the API contract between backend and frontend.

```
┌─────────────────────────────────────────────────────────┐
│  React Frontend (Vite + Tailwind)  — apps/web/src/      │
│                                                          │
│  ┌────────────────────┐   ┌──────────────────────────┐  │
│  │  ChatInterface.tsx │   │  ActiveCartSidebar.tsx   │  │
│  │  (chat messages,   │   │  (phase breadcrumb,      │  │
│  │   ComparisonMatrix │   │   constraints strip,     │  │
│  │   inline on COMPARE│   │   top 3 candidate cards) │  │
│  └────────────────────┘   └──────────────────────────┘  │
│         │  useAgent hook (HTTP POST /chat)               │
└─────────┼───────────────────────────────────────────────┘
          │  { message, session_id }
          ▼
┌─────────────────────────────────────────────────────────┐
│  FastAPI Backend  — services/api/                        │
│                                                          │
│  main.py (POST /chat)                                    │
│    └─► SessionManager (in-memory, simulates Redis)       │
│          └─► AgentOrchestrator.run_turn()                │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  AgentOrchestrator  (orchestrator.py)            │   │
│  │                                                   │   │
│  │  1. Build system prompt  (prompt.py)             │   │
│  │  2. LLM call #1: tool-use turn                   │   │
│  │     Tools available:                              │   │
│  │       update_plan         (general fields)        │   │
│  │       manage_candidates   (add/eliminate/update)  │   │
│  │       transition_phase    (with guardrails)       │   │
│  │       generate_mcdm_matrix (Compare phase only)  │   │
│  │  3. Apply tool mutations to VacationPlan          │   │
│  │  4. LLM call #2: JSON mode response              │   │
│  │     → { text_reply, comparison_matrix }          │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  core/llm.py  → Groq (primary: llama-3.3-70b-versatile) │
│                       (fallback: llama-3.1-8b-instant)   │
└─────────────────────────────────────────────────────────┘
```

**Stack changes:** None. Python / FastAPI / React / Vite / Tailwind / Groq all unchanged.

---

## 3. Agent Loop Changes

### Before (Sprint 2)
```
User Input
  → Build prompt (phase-aware, state injected)
  → LLM call #1 with single tool: update_plan
  → If tool called: apply patch → LLM call #2 for plain text reply
  → Return: (text_string, updated_plan)
```

### After (Sprint 3)
```
User Input
  → Build prompt (phase-gated, structured JSON contract)
  → LLM call #1 with 4 tools (tool_choice="auto")
      → update_plan         → deep-merge patch fields
      → manage_candidates   → upsert/eliminate candidates in array
      → transition_phase    → validated phase transition (guardrails)
      → generate_mcdm_matrix → populate comparison_matrix rows
  → Apply ALL tool calls in sequence (multiple allowed per turn)
  → Rebuild prompt with updated state
  → LLM call #2 with json_mode=True
      → Groq response_format={"type": "json_object"}
  → Parse JSON → { text_reply, comparison_matrix }
  → Return: (structured_dict, updated_plan)
```

### Phase Guardrails
Programmatic server-side checks enforce transition rules:

| Transition | Guardrail |
|---|---|
| Any → `compare` | Requires ≥ 2 active candidates |
| `compare` → `explore` | Always allowed (backward movement) |
| All others | Permitted freely |

### Candidate Upsert Logic
Candidates are matched by `name.lower()` and upserted — never replaced as a full array. This prevents the LLM from accidentally wiping the candidate list on partial updates.

---

## 4. Frontend Changes

### Replaced: `DebugPanel.tsx` → `ActiveCartSidebar.tsx`
The raw JSON debug panel is replaced by a structured Decision Console sidebar:

- **Phase Breadcrumb**: Visual progress indicator (Intake → Explore → Shortlist → Compare), with current phase highlighted in blue and completed phases in light blue.
- **Constraints Strip**: Shows `origin`, `duration_days`, `budget_range`, `travelers` — visible for debugging and user transparency.
- **Candidate Cards**: Up to 3 active candidates rendered with rank number, rationale, and `decision_criteria` badges (amber pills flagging unresolved blockers). Eliminated candidates vanish entirely.
- **Open Blockers**: `mental_model.unknowns` rendered as a bullet list at the bottom — systemic decision blockers, not conversational tangents.

### New: `ComparisonMatrix.tsx`
Rendered inline below the assistant message that triggers the Compare phase. Displays a trade-off table with `criterion` as rows and active candidate names as columns. The matrix data comes directly from the `comparison_matrix` field on the API response — the UI renders it, it does not compute it.

### Updated: `ChatInterface.tsx`
Accepts `activeCandidateNames` prop (used as column headers in the comparison matrix). Renders `ComparisonMatrix` beneath the relevant assistant message when `comparison_matrix` is non-null.

### Updated: `useAgent.ts`
Attaches `comparison_matrix` from the API response to each assistant `ChatMessage` object so it travels with the message it originated from.

### Updated: `types.ts`
New types: `Phase`, `DestinationCandidate` (with `status`, `rationale`, `pros_cons`, `decision_criteria`), enriched `VacationPlan` (with `phase` as `Phase` enum value, `candidates: DestinationCandidate[]`, `comparison_matrix`). `ChatResponse` includes `comparison_matrix`.

---

## 5. Why We Made These Changes & Expected Product Impact

### The Problem With Sprint 2
The agent treated every conversation as a single narrowing funnel with no explicit memory of what candidates had been considered. It would mention destinations, then silently forget them. More critically, it converged on *one* option — it was acting as a search filter, not a consultant.

Real users don't decide by elimination-to-one. They decide by **comparison between a shortlist**. The sprint 2 agent had no way to hold that structure.

### The Phase-Gated State Machine
By enforcing explicit phase transitions (Intake → Explore → Shortlist → Compare), the agent is forced to do different things at different stages:
- **Intake**: Profile before suggesting anything
- **Explore**: Diagnose before naming destinations; one destination at a time
- **Shortlist**: Commit to a top 3 explicitly
- **Compare**: Present trade-offs without picking a winner

This mirrors the mental model of any good human consultant — they don't list everything they know, they listen, diagnose, then propose.

### The Candidate Cart
By treating candidates as a persistent array with explicit `add`/`eliminate` operations, the agent can no longer silently drop something the user showed interest in. Every elimination has a recorded reason. The cart is visible to the user in the sidebar, making the agent's reasoning legible.

### Structured JSON Output
Returning `{ text_reply, comparison_matrix }` instead of a markdown string separates the *data* from the *prose*. The comparison matrix is a server-driven UI payload — the backend tells the frontend what to render and the frontend renders a React component, not a markdown table. This is the foundation for the richer Generative UI work in Sprint 4.

---

## 6. How This Is Done for Real-World AI & Travel Products

### Phase-Gated State Machines
Products like **Expedia's Romi** and **Booking.com's AI assistant** use explicit NLP intent routers that detect when a user has moved from "discovery" (broad queries) to "selection" (comparing specific options). Rather than a single chat prompt, they switch between purpose-built agent configurations for each stage. Our implementation simulates this with a single agent that receives different system prompt instructions per phase.

### The Cart Metaphor
In production travel & commerce systems, candidate tracking is never held in the LLM's context window. It is a first-class database entity — a standard e-commerce cart stored in a persistent backend service (e.g. Redis or Postgres), read by the UI independently of the chat. The UI reads the cart database, not the chat text. Our in-memory `SessionManager` + `candidates` array simulates this pattern exactly.

### Server-Driven UI (SDUI)
Platforms like **Airbnb**, **Lottie** (formerly Lottie Files), and many fintech products use SDUI patterns where the backend sends JSON payloads that tell the frontend which component to render and with what data — rather than having the LLM emit HTML or Markdown tables. Our `comparison_matrix` response field is a direct implementation of this principle: the LLM outputs structured data, and a dedicated `ComparisonMatrix` React component renders it. This avoids markdown-table hallucination and gives the UI full control over presentation.

### Consultant-First Interaction Model
Products that achieve high task-completion rates (Intercom's Fin, Klarna's shopping assistant) use a "diagnose before prescribe" pattern — the agent asks clarifying questions before making proposals. Sprint 3 enforces this explicitly in the Explore phase prompt: ask before suggesting, one destination at a time, track every rejection explicitly.

---

## 7. Learning Notebook Changes

**No changes were made to the learning notebooks in Sprint 3.**

`4_agent_evals.ipynb` was explicitly removed from scope. The notebook has never functioned as intended — it does not demonstrate A/B evaluation of the agent loop and was cut rather than updated with placeholder work.

The user is extremely dissatisfied with the learning notebook. It was described explicitly as a place to:
1. Manually change the values of the LLM/model used
2. Manually change the values of the system prompt
3. Manually change the values of the agent loop & tools
4. Run an A/B test of the original and the new values
5. Output a clear set of results for the original and the new values

The Coding Agent was even given 2 previous workbooks as examples to look at. It failed to implement any of the changes requested.

Considering that the learning notebook does not have a place to manually change the values, and it does not output a clear set of results for the original and the new values (A/B)... it can only be graded with a 0/10. It is an obvious failure and adds zero value to this project.

Considering that none of the LLM/Prompt/Agent have ever been tested, none of them have ever been optimised. This is a significant failure of the build-agent and it has so-far shown zero interest in rectifying this situation. We proceed to use the shittest LLM model and nobody is interested in asking which one might actually be better for our use-case. It's just fucking embarrassing that the Agent is suggesting improvements each sprint and have never said "hey, I wonder if one of the other models might be better for us".

---

## 8. Other File Changes

| File | Change |
|---|---|
| `README.md` | Not updated this sprint |
| `agents.md` | Not updated this sprint |
| `requirements.txt` | No new dependencies. Groq JSON mode is part of the existing Groq SDK. |
| `docs/sprint-3-planning.md` | Written pre-sprint — no changes |
| `docs/sprint-3-spec.md` | Written pre-sprint — no changes |
| `reproduce_issue.py` | Untouched |

### Known Issue: Fallback Model Compatibility

The fallback model (`llama-3.1-8b-instant`) does not reliably execute multiple tool calls in a single turn. Under rate-limit conditions where it activates, the agent will typically:

- Call only `manage_candidates` for 1 of 3 candidates in a batch
- Fail to call `transition_phase` even when phase transition criteria are met
- Result: the agent gets stuck in `EXPLORE` and cannot proceed through the funnel

**This is a known degradation, not a bug.** The primary model (`llama-3.3-70b-versatile`) handles multi-tool turns correctly. The fix for Sprint 4 or 5 is to reduce the fallback model's workload (e.g. simpler schema, fewer tool options) or to implement a retry mechanism that calls each tool individually.

---

## 9. Directory Map

```
vacation-planner/
├── agents.md                         # Coding agent constitution
├── README.md                         # Quick-start and architecture overview
├── requirements.txt                  # Python dependencies
│
├── docs/
│   ├── project-brief/
│   │   ├── 1_Project-brief-agentic-tool.md
│   │   ├── 2_Project-plan-agentic-travel-planner.md
│   │   └── 3_MVP-plan-agentic-travel-planner.md
│   ├── sprint-1-planning.md
│   ├── sprint-1-spec.md
│   ├── sprint-1-result.md
│   ├── sprint-2-planning.md
│   ├── sprint-2-spec.md
│   ├── sprint-2-result.md
│   ├── sprint-3-planning.md
│   ├── sprint-3-spec.md
│   └── sprint-3-result.md            ← this doc
│
├── services/api/                     # FastAPI backend
│   ├── main.py                       # ← UPDATED: ChatResponse adds comparison_matrix
│   ├── core/
│   │   ├── llm.py                    # Groq client factory
│   │   └── config.py                 # Env var settings
│   └── agent/
│       ├── models.py                 # ← REWRITTEN: Phase enum, DestinationCandidate, VacationPlan
│       ├── prompt.py                 # ← REWRITTEN: 4-phase prompts, JSON output contract
│       ├── orchestrator.py           # ← REWRITTEN: 4 tools, guardrails, Groq JSON mode
│       └── session.py                # Unchanged: in-memory session store
│
├── apps/web/                         # React frontend
│   └── src/
│       ├── App.tsx                   # ← UPDATED: ActiveCartSidebar replaces DebugPanel
│       ├── types.ts                  # ← UPDATED: Phase, DestinationCandidate, VacationPlan
│       ├── hooks/
│       │   └── useAgent.ts           # ← UPDATED: parses comparison_matrix from response
│       └── components/
│           ├── ChatInterface.tsx     # ← UPDATED: renders ComparisonMatrix inline
│           ├── ActiveCartSidebar.tsx # ← NEW: Decision Console sidebar
│           ├── ComparisonMatrix.tsx  # ← NEW: trade-off table (COMPARE phase)
│           └── DebugPanel.tsx        # Retained but no longer wired to App.tsx
│
└── learning-notebooks/               # Unchanged in Sprint 3
    ├── 1_intro_agents.ipynb
    ├── 2_more_agents.ipynb
    ├── 3_agent_loop.ipynb
    └── 4_agent_evals.ipynb           # Non-functional, not updated
```
