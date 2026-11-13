-- ============================================================
-- schema.sql — GameZone Manager · Future PostgreSQL Schema
-- ============================================================
-- This file is a placeholder for the planned server-side
-- database. No backend connection is required in V1.
-- All data is currently stored in browser localStorage.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
-- Enable UUIDs (requires PostgreSQL 13+)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tables ───────────────────────────────────────────────────

-- Workers / staff accounts
CREATE TABLE IF NOT EXISTS workers (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(60)  NOT NULL UNIQUE,
    pin_hash    TEXT         NOT NULL,       -- bcrypt hash
    role        VARCHAR(20)  NOT NULL DEFAULT 'worker', -- 'worker' | 'manager'
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Consoles registered in the system
CREATE TABLE IF NOT EXISTS consoles (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(30)  NOT NULL UNIQUE,  -- e.g. "PS4-01"
    type        VARCHAR(10)  NOT NULL,         -- 'PS4' | 'PS5'
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Daily shift sessions (one row per worker shift)
CREATE TABLE IF NOT EXISTS shifts (
    id          SERIAL PRIMARY KEY,
    worker_id   INTEGER      REFERENCES workers(id),
    started_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    ended_at    TIMESTAMPTZ,
    notes       TEXT
);

-- Game sessions (one row per console session)
CREATE TABLE IF NOT EXISTS game_sessions (
    id              SERIAL PRIMARY KEY,
    console_id      INTEGER     NOT NULL REFERENCES consoles(id),
    shift_id        INTEGER     REFERENCES shifts(id),
    mode            VARCHAR(10) NOT NULL DEFAULT 'FIFA', -- 'FIFA' | 'MISSION'
    status          VARCHAR(10) NOT NULL DEFAULT 'free', -- 'free' | 'playing' | 'paused'
    started_at      TIMESTAMPTZ,
    ended_at        TIMESTAMPTZ,
    elapsed_seconds INTEGER     NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual FIFA match records (one row per match bubble)
CREATE TABLE IF NOT EXISTS matches (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER     NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    match_number    INTEGER     NOT NULL,  -- sequential within session
    price_etb       NUMERIC(8,2) NOT NULL,
    is_paid         BOOLEAN     NOT NULL DEFAULT FALSE,
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment transactions
CREATE TABLE IF NOT EXISTS transactions (
    id              SERIAL PRIMARY KEY,
    shift_id        INTEGER     REFERENCES shifts(id),
    session_id      INTEGER     REFERENCES game_sessions(id),
    amount_etb      NUMERIC(10,2) NOT NULL,
    method          VARCHAR(20) NOT NULL,  -- 'Cash' | 'Mobile Banking'
    provider        VARCHAR(60),           -- 'Telebirr' | 'Commercial Bank of Ethiopia' | NULL
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bridge: which matches are covered by a transaction
CREATE TABLE IF NOT EXISTS transaction_matches (
    transaction_id  INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    match_id        INTEGER NOT NULL REFERENCES matches(id)      ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, match_id)
);

-- ── Indexes ───────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_game_sessions_console ON game_sessions(console_id);
CREATE INDEX IF NOT EXISTS idx_matches_session       ON matches(session_id);
CREATE INDEX IF NOT EXISTS idx_transactions_shift    ON transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created  ON transactions(created_at);

-- ── Pricing reference (optional lookup table) ─────────────────
CREATE TABLE IF NOT EXISTS pricing (
    id          SERIAL PRIMARY KEY,
    console_type VARCHAR(10) NOT NULL,   -- 'PS4' | 'PS5'
    game_mode    VARCHAR(10) NOT NULL,   -- 'FIFA' | 'MISSION'
    duration_min INTEGER,                -- NULL = per-match pricing
    price_etb    NUMERIC(8,2) NOT NULL,
    valid_from   DATE         NOT NULL DEFAULT CURRENT_DATE,
    valid_until  DATE
);

-- Seed default pricing
INSERT INTO pricing (console_type, game_mode, duration_min, price_etb)
VALUES
    ('PS4', 'FIFA',    NULL, 25.00),   -- 25 ETB per match
    ('PS5', 'FIFA',    NULL, 30.00),   -- 30 ETB per match
    ('PS4', 'MISSION', 30,   50.00),   -- 50 ETB for 30 min
    ('PS4', 'MISSION', 60,  100.00),   -- 100 ETB for 60 min
    ('PS5', 'MISSION', 30,   50.00),
    ('PS5', 'MISSION', 60,  100.00)
ON CONFLICT DO NOTHING;
