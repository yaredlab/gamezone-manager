-- ============================================================
-- GameZone Manager V2 — PostgreSQL Raw Schema
-- ============================================================
-- Use this file when you want to apply the schema directly
-- with psql without Prisma CLI, or as a readable reference.
--
-- For Prisma-managed deployments, run:
--   npx prisma migrate dev --name init
-- and let Prisma generate the SQL automatically.
-- ============================================================

-- Enable UUID extension (optional, used for future UUID keys)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────

CREATE TYPE console_type   AS ENUM ('PS4', 'PS5');
CREATE TYPE game_mode      AS ENUM ('FIFA', 'MISSION');
CREATE TYPE session_status AS ENUM ('free', 'playing', 'paused', 'ended');
CREATE TYPE user_role      AS ENUM ('worker', 'manager', 'admin');
CREATE TYPE payment_method AS ENUM ('Cash', 'Mobile_Banking');
CREATE TYPE mobile_banking_provider AS ENUM ('Telebirr', 'Commercial_Bank_of_Ethiopia');

-- ── BUSINESS SETTINGS ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS business_settings (
    id            INTEGER         PRIMARY KEY DEFAULT 1,
    business_name VARCHAR(100)    NOT NULL DEFAULT 'GameZone',
    location      VARCHAR(200)    NOT NULL DEFAULT '',
    phone         VARCHAR(30)     NOT NULL DEFAULT '',
    currency      VARCHAR(10)     NOT NULL DEFAULT 'ETB',
    timezone      VARCHAR(60)     NOT NULL DEFAULT 'Africa/Addis_Ababa',
    updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Seed default settings
INSERT INTO business_settings (id, business_name) VALUES (1, 'GameZone')
ON CONFLICT (id) DO NOTHING;

-- ── WORKERS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workers (
    id         SERIAL          PRIMARY KEY,
    name       VARCHAR(80)     NOT NULL,
    username   VARCHAR(60)     NOT NULL UNIQUE,
    pin_hash   TEXT            NOT NULL,              -- bcrypt hash, never plain text
    role       user_role       NOT NULL DEFAULT 'worker',
    is_active  BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ── CONSOLES ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS consoles (
    id         SERIAL          PRIMARY KEY,
    name       VARCHAR(30)     NOT NULL UNIQUE,       -- e.g. "PS4-01", "PS5-02"
    type       console_type    NOT NULL,
    is_active  BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Seed default consoles (match V1 localStorage defaults)
INSERT INTO consoles (name, type) VALUES
    ('PS4-01', 'PS4'), ('PS4-02', 'PS4'), ('PS4-03', 'PS4'), ('PS4-04', 'PS4'),
    ('PS5-01', 'PS5'), ('PS5-02', 'PS5'), ('PS5-03', 'PS5')
ON CONFLICT (name) DO NOTHING;

-- ── PRICING ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing (
    id                   SERIAL          PRIMARY KEY,
    console_type         console_type,               -- NULL = applies to all types
    game_mode            game_mode       NOT NULL,
    billing_interval_min INTEGER         NOT NULL DEFAULT 30,
    price_etb            NUMERIC(8,2)    NOT NULL,
    valid_from           TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    valid_until          TIMESTAMPTZ,                -- NULL = currently active
    created_at           TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Seed default pricing
INSERT INTO pricing (console_type, game_mode, billing_interval_min, price_etb) VALUES
    ('PS4',  'FIFA',    30, 25.00),
    ('PS5',  'FIFA',    30, 30.00),
    (NULL,   'MISSION', 30, 50.00)
ON CONFLICT DO NOTHING;

-- ── SHIFTS ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shifts (
    id         SERIAL      PRIMARY KEY,
    worker_id  INTEGER     REFERENCES workers(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at   TIMESTAMPTZ,
    notes      TEXT
);

-- ── GAME SESSIONS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS game_sessions (
    id                       SERIAL          PRIMARY KEY,
    console_id               INTEGER         NOT NULL REFERENCES consoles(id) ON DELETE RESTRICT,
    shift_id                 INTEGER         REFERENCES shifts(id) ON DELETE SET NULL,
    mode                     game_mode       NOT NULL DEFAULT 'FIFA',
    status                   session_status  NOT NULL DEFAULT 'free',
    started_at               TIMESTAMPTZ,
    ended_at                 TIMESTAMPTZ,
    paused_at                TIMESTAMPTZ,
    elapsed_seconds          INTEGER         NOT NULL DEFAULT 0,
    -- Match-mode independent cycle timer
    match_timer_elapsed      INTEGER         NOT NULL DEFAULT 0,
    match_timer_started_at   TIMESTAMPTZ,
    created_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ── MATCHES / BUBBLES ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS matches (
    id           SERIAL          PRIMARY KEY,
    session_id   INTEGER         NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    bubble_type  game_mode       NOT NULL DEFAULT 'FIFA',
    match_number INTEGER         NOT NULL,            -- sequential within session
    price_etb    NUMERIC(8,2)    NOT NULL,            -- price snapshot at creation; immutable
    is_paid      BOOLEAN         NOT NULL DEFAULT FALSE,
    paid_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ── TRANSACTIONS ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS transactions (
    id            SERIAL                  PRIMARY KEY,
    tx_ref        VARCHAR(30)             NOT NULL UNIQUE,  -- e.g. "TX-123456"
    shift_id      INTEGER                 REFERENCES shifts(id) ON DELETE SET NULL,
    session_id    INTEGER                 REFERENCES game_sessions(id) ON DELETE SET NULL,
    worker_id     INTEGER                 REFERENCES workers(id) ON DELETE SET NULL,
    console_name  VARCHAR(100)            NOT NULL,         -- denormalized; never changes with renames
    amount_etb    NUMERIC(10,2)           NOT NULL,
    method        payment_method          NOT NULL,
    provider      mobile_banking_provider,                  -- NULL for Cash
    matches_count INTEGER                 NOT NULL DEFAULT 1,
    description   TEXT,
    created_at    TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

-- ── TRANSACTION ↔ MATCH BRIDGE ──────────────────────────────

CREATE TABLE IF NOT EXISTS transaction_matches (
    transaction_id  INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    match_id        INTEGER NOT NULL REFERENCES matches(id)      ON DELETE CASCADE,
    PRIMARY KEY (transaction_id, match_id)
);

-- ── PRICING AUDIT LOG ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing_audit_log (
    id               SERIAL          PRIMARY KEY,
    changed_by       VARCHAR(80)     NOT NULL,
    ps4_price        NUMERIC(8,2),
    ps5_price        NUMERIC(8,2),
    mission_price    NUMERIC(8,2),
    mission_interval INTEGER,
    changed_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_game_sessions_console    ON game_sessions(console_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_status     ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_created    ON game_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_matches_session          ON matches(session_id);
CREATE INDEX IF NOT EXISTS idx_matches_paid             ON matches(is_paid);
CREATE INDEX IF NOT EXISTS idx_transactions_created     ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_method      ON transactions(method);
CREATE INDEX IF NOT EXISTS idx_transactions_console     ON transactions(console_name);
CREATE INDEX IF NOT EXISTS idx_transactions_shift       ON transactions(shift_id);

-- ── HELPER VIEWS ─────────────────────────────────────────────

-- Active pricing (most recently inserted per console_type + game_mode)
CREATE OR REPLACE VIEW active_pricing AS
SELECT DISTINCT ON (COALESCE(console_type::text, 'ALL'), game_mode)
    id, console_type, game_mode, billing_interval_min, price_etb, valid_from
FROM pricing
WHERE valid_until IS NULL
ORDER BY COALESCE(console_type::text, 'ALL'), game_mode, valid_from DESC;

-- Daily revenue summary
CREATE OR REPLACE VIEW daily_revenue AS
SELECT
    DATE(created_at AT TIME ZONE 'Africa/Addis_Ababa') AS day,
    COUNT(*)                                             AS total_transactions,
    SUM(amount_etb)                                      AS total_revenue,
    SUM(CASE WHEN method = 'Cash'           THEN amount_etb ELSE 0 END) AS cash_revenue,
    SUM(CASE WHEN method = 'Mobile_Banking' THEN amount_etb ELSE 0 END) AS mobile_revenue
FROM transactions
GROUP BY 1
ORDER BY 1 DESC;

-- Console performance summary
CREATE OR REPLACE VIEW console_performance AS
SELECT
    t.console_name,
    COUNT(DISTINCT t.id)      AS total_transactions,
    SUM(t.amount_etb)         AS total_revenue,
    SUM(t.matches_count)      AS total_matches
FROM transactions t
GROUP BY t.console_name
ORDER BY total_revenue DESC;
