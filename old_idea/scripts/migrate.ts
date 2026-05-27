import { db, pool } from "../src/db";

const MIGRATION_SQL = `
-- 1. spec_runs
CREATE TABLE IF NOT EXISTS spec_runs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  prompt          TEXT NOT NULL,
  domain          TEXT NOT NULL DEFAULT 'fintech',
  status          TEXT NOT NULL CHECK (status IN (
    'running','awaiting_clarification','completed','failed'
  )),
  options         JSONB NOT NULL DEFAULT '{}',
  parent_spec_id  TEXT REFERENCES spec_runs(id),
  change_summary  TEXT,
  reused_passes   INTEGER[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  total_ms        INTEGER
);
CREATE INDEX IF NOT EXISTS idx_spec_runs_user_id ON spec_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spec_runs_status ON spec_runs (status) WHERE status IN ('running','awaiting_clarification');

-- 2. pass_outputs
CREATE TABLE IF NOT EXISTS pass_outputs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  pass_number     INTEGER NOT NULL CHECK (pass_number BETWEEN 1 AND 5),
  status          TEXT NOT NULL CHECK (status IN ('completed','failed','retried')),
  output          JSONB NOT NULL,
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  duration_ms     INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (spec_run_id, pass_number, attempt_number)
);
CREATE INDEX IF NOT EXISTS idx_pass_outputs_spec_run_id ON pass_outputs (spec_run_id, pass_number);

-- 3. clarification_events
CREATE TABLE IF NOT EXISTS clarification_events (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  questions       JSONB NOT NULL,
  answers         JSONB,
  status          TEXT NOT NULL CHECK (status IN ('pending','answered','timed_out')),
  asked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at     TIMESTAMPTZ,
  timeout_at      TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clarification_events_status ON clarification_events (status, timeout_at) WHERE status = 'pending';

-- 4. formal_models
CREATE TABLE IF NOT EXISTS formal_models (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  model_id        TEXT NOT NULL,
  tla_source      TEXT NOT NULL,
  cfg_source      TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('verified','violated','error')),
  verification_bounds JSONB NOT NULL,
  counterexample  TEXT,
  duration_ms     INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. rendered_specs
CREATE TABLE IF NOT EXISTS rendered_specs (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id) UNIQUE,
  markdown        TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. spec_artifacts
CREATE TABLE IF NOT EXISTS spec_artifacts (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  artifact_type   TEXT NOT NULL CHECK (artifact_type IN ('tla_bundle','scaffold')),
  storage_key     TEXT NOT NULL,
  size_bytes      BIGINT NOT NULL,
  content_type    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

async function migrate() {
  console.log("Starting migration...");
  try {
    await db.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await db.query(MIGRATION_SQL);
    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
