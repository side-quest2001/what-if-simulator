-- ============================================================
-- Revenue Recognition Simulator — PostgreSQL Schema
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- production_subscriptions
-- Read-only mirror of real Stripe subscription data.
-- In a real system this would be synced from Stripe webhooks.
-- ============================================================
CREATE TABLE IF NOT EXISTS production_subscriptions (
  id            VARCHAR(255) PRIMARY KEY,         -- e.g. "sub_001" or "sub_1Abc..." from Stripe
  customer_name VARCHAR(255) NOT NULL,
  plan_name     VARCHAR(255) NOT NULL,
  contract_value NUMERIC(12, 2) NOT NULL,         -- Total contract value in USD
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  status        VARCHAR(50) NOT NULL DEFAULT 'active',

  CONSTRAINT production_subs_status_check
    CHECK (status IN ('active', 'cancelled', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_prod_subs_status
  ON production_subscriptions(status);

-- ============================================================
-- simulation_sessions
-- Each session is an isolated sandbox. Multiple sessions
-- per user are supported. Sessions auto-expire after 24h
-- to avoid DB bloat.
-- ============================================================
CREATE TABLE IF NOT EXISTS simulation_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    VARCHAR(255) NOT NULL,
  name       VARCHAR(255) NOT NULL DEFAULT 'Unnamed Simulation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  status     VARCHAR(50) NOT NULL DEFAULT 'active',

  CONSTRAINT sessions_status_check
    CHECK (status IN ('active', 'expired'))
);

-- Fast lookups by user and by TTL sweep (background job)
CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON simulation_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON simulation_sessions(expires_at)
  WHERE status = 'active';

-- ============================================================
-- simulated_subscriptions
-- A snapshot of a production subscription cloned into a
-- simulation session. Override columns are NULL until the
-- user changes an assumption — NULL means "use original value".
--
-- Isolation guarantee: any query on simulated_subscriptions
-- must join through simulation_sessions. Production data is
-- never modified.
-- ============================================================
CREATE TABLE IF NOT EXISTS simulated_subscriptions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL REFERENCES simulation_sessions(id)
                            ON DELETE CASCADE,
  source_subscription_id  VARCHAR(255) NOT NULL
                            REFERENCES production_subscriptions(id),

  -- Production snapshot (immutable copy at clone time)
  customer_name   VARCHAR(255) NOT NULL,
  plan_name       VARCHAR(255) NOT NULL,
  contract_value  NUMERIC(12, 2) NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE NOT NULL,

  -- User-editable assumptions (NULL = keep original)
  sim_contract_value  NUMERIC(12, 2),
  sim_end_date        DATE,
  sim_refund_amount   NUMERIC(12, 2) NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One subscription per session (MVP: one subscription at a time)
  CONSTRAINT one_sub_per_session UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_sim_subs_session_id
  ON simulated_subscriptions(session_id);

-- ============================================================
-- simulated_revenue_schedule (optional cache layer)
-- Stores pre-computed revenue schedules to avoid recomputing
-- on every request. Invalidated when assumptions change.
-- For MVP, we compute on-the-fly and skip this table.
-- Included here as the production-ready cache schema.
-- ============================================================
CREATE TABLE IF NOT EXISTS simulated_revenue_schedule (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES simulation_sessions(id)
                     ON DELETE CASCADE,
  subscription_id  UUID NOT NULL REFERENCES simulated_subscriptions(id)
                     ON DELETE CASCADE,
  month            CHAR(7) NOT NULL,               -- YYYY-MM

  actual_recognized    NUMERIC(12, 2) NOT NULL DEFAULT 0,
  simulated_recognized NUMERIC(12, 2) NOT NULL DEFAULT 0,
  actual_deferred      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  simulated_deferred   NUMERIC(12, 2) NOT NULL DEFAULT 0,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uniq_schedule_entry
    UNIQUE (session_id, subscription_id, month)
);

CREATE INDEX IF NOT EXISTS idx_schedule_session_month
  ON simulated_revenue_schedule(session_id, month);
