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
-- ('when' is a reserved keyword in SQL; see sprint-12-spec.md Section 6.)
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
