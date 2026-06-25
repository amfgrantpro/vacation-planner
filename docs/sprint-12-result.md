# Sprint 12 Final State: Supabase Database Setup

**Status**: Complete  
**Date**: 25th June 2026

This document describes the end of Sprint 12 code state.

---

## 1. Summary

Sprint 12 is foundational only: introduce Supabase as the database layer for the five-sprint architectural arc (Sprints 12–16). No application code was changed. The deliverables are a committed SQL schema and a live, verified Supabase database with all five tables created and confirmed correct.

---

## 2. Sprint 11 → Sprint 12: Before vs. After

| Dimension | Sprint 11 (Before) | Sprint 12 (After) |
|---|---|---|
| **Database** | None — all session state lives in server-side Python memory | Supabase project provisioned; five tables created and verified |
| **Schema file** | None | `supabase/schema.sql` committed to repo — canonical source of truth for the full five-sprint arc |
| **Environment variables** | `GROQ_API_KEY`, `UNSPLASH_ACCESS_KEY` | Added `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` to `.env` |
| **Application code** | — | Unchanged |

---

## 3. Schema

Five tables created in Supabase, designed for the complete five-sprint arc (Sprints 12–16):

### `sessions`
One row per planning session. Columns: `id` (UUID, PK), `created_at`, `updated_at` (both TIMESTAMPTZ), `mode` (TEXT, CHECK constraint: `explore` / `compare` / `decision`, default `explore`), `selected_winner` (TEXT, nullable).

A `sessions_updated_at` trigger auto-sets `updated_at = now()` on every UPDATE via the `update_updated_at()` PL/pgSQL function. This means application code never needs to set `updated_at` manually.

### `trip_profile`
One row per session. `session_id` is both PK and FK to `sessions.id` (ON DELETE CASCADE) — the one-to-one relationship is explicit in the schema. Text fields `origin`, `travelers`, `travel_when`, `duration`, `budget` are all nullable. Array fields `vacation_type`, `likes`, `avoid` are `TEXT[] NOT NULL DEFAULT '{}'`.

Note: the column is named `travel_when` (not `when`) because `WHEN` is a reserved SQL keyword. Sprint 13 will map `TripProfile.when` → `travel_when` explicitly.

### `candidates`
Many rows per session. `id` UUID PK, FK `session_id → sessions.id` (ON DELETE CASCADE). Non-nullable columns: `name`, `region`, `vibe`, `photo_url`, `status` (TEXT, CHECK: `suggested` / `shortlisted` / `rejected`, default `suggested`). Nullable columns: `trip_feel`, `seasonal_note`, `rejection_reason`. Index: `idx_candidates_session_id`.

Sprint 13's upsert key will be `(session_id, lower(name))`.

### `comparison_criteria`
One row per (criterion × candidate) pair. `id` UUID PK, FK `session_id → sessions.id` (ON DELETE CASCADE), `criterion_name` TEXT NOT NULL, `candidate_name` TEXT NOT NULL, `value` TEXT nullable. UNIQUE constraint on `(session_id, criterion_name, candidate_name)` enables `INSERT ... ON CONFLICT DO UPDATE` upsert semantics in Sprint 14's generation endpoint — a missing value for a re-shortlisted candidate can be filled without overwriting adjacent cells. Index: `idx_comparison_criteria_session_id`.

### `conversation_history`
One row per message turn. `id` UUID PK, FK `session_id → sessions.id` (ON DELETE CASCADE), `position` INTEGER NOT NULL (0-indexed, authoritative ordering column), `message` JSONB NOT NULL. UNIQUE constraint on `(session_id, position)`. The full Groq API message dict is stored as a JSONB blob — preserving `tool_calls` arrays and `tool_call_id` fields for restore-on-load without normalisation. Index: `idx_conversation_history_session_id`.

### Design decisions
- **RLS disabled**: the backend uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely. Acceptable for a single-user dev tool with no authentication layer.
- **`session_id` as PK for `trip_profile`**: avoids a redundant `id UUID` column; makes the one-to-one relationship explicit.
- **Normalised comparison criteria**: the current in-memory format (`List[dict]` with destination columns) is normalised to one row per (criterion × candidate) pair. This allows Sprint 14's generation endpoint to fill individual missing values without regenerating the full matrix.
- **JSONB for conversation history**: avoids multi-table joins to reconstruct the Groq message list on session load. The array is read in `position` order and passed directly to the Groq client.
- **`session_id` indexes on all multi-row tables**: PostgreSQL does not auto-index foreign keys; without these, session-scoped queries would perform full table scans.

---

## 4. Constraints Carried Forward

All constraints from Sprint 11 are preserved. No new constraints introduced (no application code changed).

---

## 5. Directory Map (Post-Sprint 12)

```
vacation-planner/
├── docs/
│   ├── sprint-12-planning.md
│   ├── sprint-12-spec.md
│   └── sprint-12-result.md              ← THIS FILE
│
└── supabase/
    └── schema.sql                        ← NEW: five-table schema for full arc
```

---

## 6. Notes for Sprint 13

- **Session ID format change**: the frontend currently generates session IDs as a short alphanumeric string (`Math.random().toString(36).substring(7)`). The new schema uses UUID. Sprint 13 must change how session IDs are created — likely by inserting a session row in Supabase at session start and using the returned UUID.
- **`travel_when` mapping**: Sprint 13 must map `TripProfile.when` → DB column `travel_when` in both read and write paths.
- **Supabase Python client**: `supabase-py` (or direct PostgREST calls) will be added to `requirements.txt` in Sprint 13. No dependency added this sprint.
- **End-to-end verification**: full round-trip testing (write a session, read it back, confirm data integrity) happens in Sprint 13 — not here.
