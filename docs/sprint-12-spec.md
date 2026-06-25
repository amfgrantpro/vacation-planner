# Sprint 12 Implementation Spec: Supabase Database Setup

**Status**: Draft — awaiting PM review  
**Date**: 2026-06-25

---

## 1. Overview

Sprint 12 introduces Supabase as the database layer for the five-sprint architectural arc (Sprints 12–16). This sprint is **foundational only**: create the Supabase project, write and run the SQL schema, and verify it is correct. No application code changes.

The schema is designed for the full arc — not only what Sprint 13 immediately uses. Every table and column the migration will need exists and is correct before Sprint 13 begins.

**Sprint goal**: Supabase project configured; all five tables created and verified. Ready for Sprint 13 to migrate the `SessionManager`.

---

## 2. Scope

**In scope:**
- Create Supabase account and project (free tier)
- Add Supabase connection variables to `.env`
- Write `supabase/schema.sql` and commit it to the repo
- Run the schema via the Supabase dashboard SQL Editor
- Verify all tables in the Supabase Table Editor

**Out of scope:**
- Installing the Supabase Python client (`supabase-py`) — Sprint 13
- Changes to `SessionManager`, `main.py`, or any backend code — Sprint 13
- Changes to frontend session ID generation — Sprint 13
- Generation endpoints — Sprint 14

---

## 3. Step 1 — Create Supabase Account & Project

1. Go to [supabase.com](https://supabase.com) and sign up for a free account.
2. After confirming your email, click **New project**.
3. Fill in:
   - **Organisation**: create a new one (e.g. your name)
   - **Project name**: `vacation-planner`
   - **Database password**: generate a strong password and save it in your password manager (you will need it if you ever connect via direct Postgres)
   - **Region**: pick the region closest to you
4. Click **Create new project**. Supabase takes ~1 minute to provision.
5. Once the dashboard loads, navigate to **Project Settings → API**.
6. Note the following values — you will use them in Step 2:
   - **Project URL** (e.g. `https://xyzabc.supabase.co`)
   - **Anon/public key** (safe for frontend use)
   - **Service role key** (secret — backend only; do not commit)

---

## 4. Step 2 — Configure Environment Variables

Open the `.env` file at the project root and add the three Supabase variables:

```
# Supabase (added Sprint 12)
# Project URL
SUPABASE_URL=https://<your-project-ref>.supabase.co

# Publishable key (formerly: anon / public key)
SUPABASE_ANON_KEY=<your-publishable-key>

# Secret key (formerly: service role key) — backend only, do not commit
SUPABASE_SERVICE_ROLE_KEY=<your-secret-key>
```

> These variables will be read by the backend in Sprint 13. They are added now so the `.env` file is complete before any migration work begins.

The `.env` file is already git-ignored. Do not commit API keys.

---

## 5. Step 3 — Write the Schema

Create the file `supabase/schema.sql` at the project root (new directory). This is the canonical schema for the full five-sprint arc and should be committed to the repo as a reference.

The full SQL is below. Explanations for non-obvious decisions follow each table block.

```sql
-- ============================================================
-- Vacation Planner — Supabase Schema
-- Sprint 12 · Full five-sprint arc (Sprints 12–16)
-- Run via: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================


-- --------------------------------
-- sessions
-- --------------------------------
CREATE TABLE sessions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    mode            TEXT        NOT NULL DEFAULT 'explore'
                                    CHECK (mode IN ('explore', 'compare', 'decision')),
    selected_winner TEXT
);

-- Auto-update updated_at whenever a session row is modified.
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
    BEFORE UPDATE ON sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- --------------------------------
-- trip_profile
-- One row per session (session_id is the primary key).
-- Field mapping note: Python TripProfile.when → DB column travel_when
-- ('when' is a reserved keyword in SQL; see Section 6.)
-- --------------------------------
CREATE TABLE trip_profile (
    session_id      UUID    PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
    origin          TEXT,
    travelers       TEXT,
    travel_when     TEXT,
    duration        TEXT,
    budget          TEXT,
    vacation_type   TEXT[]  NOT NULL DEFAULT '{}',
    likes           TEXT[]  NOT NULL DEFAULT '{}',
    avoid           TEXT[]  NOT NULL DEFAULT '{}'
);


-- --------------------------------
-- candidates
-- Many per session. Upsert key in Sprint 13: (session_id, lower(name)).
-- --------------------------------
CREATE TABLE candidates (
    id               UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id       UUID  NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name             TEXT  NOT NULL,
    region           TEXT  NOT NULL,
    vibe             TEXT  NOT NULL,
    photo_url        TEXT  NOT NULL,
    status           TEXT  NOT NULL DEFAULT 'suggested'
                               CHECK (status IN ('suggested', 'shortlisted', 'rejected')),
    trip_feel        TEXT,
    seasonal_note    TEXT,
    rejection_reason TEXT
);

CREATE INDEX idx_candidates_session_id ON candidates (session_id);


-- --------------------------------
-- comparison_criteria
-- One row per (criterion × candidate) pair.
-- value is nullable: missing values are filled on the next generation call.
-- Candidates can leave and re-enter the shortlist; previously generated
-- values are preserved and not regenerated unless explicitly replaced.
-- --------------------------------
CREATE TABLE comparison_criteria (
    id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID  NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    criterion_name  TEXT  NOT NULL,
    candidate_name  TEXT  NOT NULL,
    value           TEXT,
    UNIQUE (session_id, criterion_name, candidate_name)
);

CREATE INDEX idx_comparison_criteria_session_id ON comparison_criteria (session_id);


-- --------------------------------
-- conversation_history
-- One row per message turn.
-- The full Groq API message dict is stored as a JSONB blob — preserving
-- tool_calls arrays and tool_call_id fields for restore-on-load without
-- normalisation. position (0-indexed integer) is the authoritative
-- ordering column.
-- --------------------------------
CREATE TABLE conversation_history (
    id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID     NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    position    INTEGER  NOT NULL,
    message     JSONB    NOT NULL,
    UNIQUE (session_id, position)
);

CREATE INDEX idx_conversation_history_session_id ON conversation_history (session_id);
```

---

## 6. Schema Design Notes

### `travel_when` naming
`WHEN` is a reserved keyword in SQL. Using `"when"` as a quoted identifier is syntactically valid but error-prone (the quotes can be omitted by accident, causing silent query failures). The column is named `travel_when` to avoid this. Sprint 13 will map Python's `TripProfile.when` to DB column `travel_when` explicitly.

### `trip_profile` uses `session_id` as its primary key
There is exactly one trip profile per session. Using `session_id` as the PK avoids an unnecessary `id UUID` column and makes the one-to-one relationship explicit in the schema. All other tables have their own `id UUID` because they hold multiple rows per session.

### `comparison_criteria` normalisation
The current in-memory representation is `List[dict]` where each dict holds `{"criterion": "...", "Destination A": "...", "Destination B": "..."}`. The new schema normalises this to one row per (criterion × candidate) pair. The `UNIQUE` constraint on `(session_id, criterion_name, candidate_name)` enables upsert semantics: Sprint 14's generation endpoint can call `INSERT ... ON CONFLICT DO UPDATE` to fill in a missing value without overwriting adjacent cells.

### `conversation_history` as JSONB
The Groq API message format includes `tool_calls` arrays and `tool_call_id` references that span multiple message objects. Normalising these into relational columns would require multi-table joins to reconstruct the original list on every session load. Storing each message as a JSONB blob avoids this cost entirely — the array is read out in `position` order and passed directly to the Groq client, identical to how the current in-memory history is used.

### `updated_at` trigger on sessions
Industry standard. Updated_at is set automatically by the database on every UPDATE, rather than by application code. This removes a class of bugs where application code forgets to set it, and means the field is always accurate even if rows are updated via the Supabase dashboard or a one-off SQL script.

### Indexes on `session_id`
PostgreSQL does not automatically create indexes for foreign keys. Without indexes, any query scoped to a session (e.g. "fetch all candidates for this session") performs a full table scan. The four `idx_*_session_id` indexes ensure these lookups are fast from Sprint 13 onward.

### Row Level Security (RLS)
RLS is left disabled on all tables. The backend will use the `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS entirely. This is acceptable for a single-user dev tool with no authentication layer.

---

## 7. Step 4 — Commit the Schema to the Repo

Create the `supabase/` directory at the project root and save the SQL above as `supabase/schema.sql`. Commit this file.

```
vacation-planner/
└── supabase/
    └── schema.sql     ← NEW
```

This gives the team a single source of truth for the database schema. If the schema needs to change in a future sprint, the SQL file is updated and a migration is noted in the sprint result doc.

---

## 8. Step 5 — Run the Schema in Supabase

1. Open your Supabase project dashboard.
2. In the left sidebar, click **SQL Editor**.
3. Click **New query**.
4. Paste the full contents of `supabase/schema.sql`.
5. Click **Run** (or press `Cmd+Enter` / `Ctrl+Enter`).
6. Confirm the query completes with no errors. The output panel should show something like `Success. No rows returned.`

If you see an error, check Section 9 (Troubleshooting) before retrying.

---

## 9. Step 6 — Verify in Table Editor (Checklist)

Navigate to **Table Editor** in the Supabase sidebar. Verify each of the following.

### sessions
- [ ] Table exists
- [ ] Columns: `id` (uuid, PK), `created_at` (timestamptz), `updated_at` (timestamptz), `mode` (text), `selected_winner` (text, nullable)
- [ ] Default for `mode` is `explore`
- [ ] Trigger `sessions_updated_at` exists (visible under **Database → Triggers**)

### trip_profile
- [ ] Table exists
- [ ] Columns: `session_id` (uuid, PK), `origin`, `travelers`, `travel_when`, `duration`, `budget` (all text, nullable), `vacation_type`, `likes`, `avoid` (all text[], non-nullable, default `{}`)
- [ ] Foreign key on `session_id` → `sessions.id`

### candidates
- [ ] Table exists
- [ ] Columns: `id` (uuid, PK), `session_id` (uuid), `name`, `region`, `vibe`, `photo_url` (all text, non-nullable), `status` (text, default `suggested`), `trip_feel`, `seasonal_note`, `rejection_reason` (all text, nullable)
- [ ] Foreign key on `session_id` → `sessions.id`

### comparison_criteria
- [ ] Table exists
- [ ] Columns: `id` (uuid, PK), `session_id` (uuid), `criterion_name` (text), `candidate_name` (text), `value` (text, nullable)
- [ ] Foreign key on `session_id` → `sessions.id`
- [ ] Unique constraint visible on `(session_id, criterion_name, candidate_name)`

### conversation_history
- [ ] Table exists
- [ ] Columns: `id` (uuid, PK), `session_id` (uuid), `position` (integer), `message` (jsonb)
- [ ] Foreign key on `session_id` → `sessions.id`
- [ ] Unique constraint visible on `(session_id, position)`

### Indexes
- [ ] `idx_candidates_session_id` exists (visible under **Database → Indexes**)
- [ ] `idx_comparison_criteria_session_id` exists
- [ ] `idx_conversation_history_session_id` exists

---

## 10. Troubleshooting

**"relation already exists"**: The schema has already been run (partially or fully). Either drop the existing tables and re-run, or use `CREATE TABLE IF NOT EXISTS` variants. Dropping is safer at this stage since no application data exists yet.

**"permission denied"**: Make sure you are running the SQL as the project owner (the default Supabase SQL Editor does this automatically). If you see this in a different context, switch to the service role.

**"syntax error at or near WHEN"**: The `travel_when` column name avoids this but if the error appears elsewhere, look for any other SQL keyword conflicts in the query.

---

## 11. Notes for Sprint 13

The following are **not** Sprint 12 tasks but are noted here so Sprint 13 planning starts with accurate context:

- **Session ID format change**: The frontend currently generates session IDs as a short alphanumeric string via `Math.random().toString(36).substring(7)`. The new schema uses UUID. Sprint 13 will need to change how session IDs are created — likely by creating a session row in Supabase at session start and using the returned UUID.
- **`travel_when` mapping**: The Sprint 13 migration must map Python's `TripProfile.when` → DB column `travel_when` in both read and write paths.
- **Supabase Python client**: `supabase-py` (or direct PostgREST calls) will be added to `requirements.txt` in Sprint 13. No dependency is added this sprint.
- **End-to-end verification**: Full round-trip testing (write a session, read it back, confirm data integrity) happens in Sprint 13 — not here. Sprint 12 only verifies that the schema exists and is structurally correct.

---

## 12. Deliverables

| Deliverable | Where |
|---|---|
| `supabase/schema.sql` committed to repo | `supabase/schema.sql` |
| Supabase env vars in `.env` | `.env` (git-ignored) |
| All five tables and trigger created in Supabase | Verified via Table Editor checklist (Section 9) |

---

## 13. Constraints Carried Forward

All constraints from Sprint 11 are preserved. No new constraints are introduced this sprint (no application code is changed).
