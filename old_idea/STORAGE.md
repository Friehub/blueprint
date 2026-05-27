# Storage Specification
## Where Specs Live, How They Are Versioned, and How They Are Retrieved

> A specification is a long-lived artifact. Users return to it when
> requirements change, when implementation starts, and when they need
> to understand why a design decision was made. The storage layer must
> support versioning, retrieval, and delta analysis -- not just persistence.

---

## Data Model

### Core Entities

```sql
-- One row per pipeline execution triggered by the user.
CREATE TABLE spec_runs (
  id              TEXT PRIMARY KEY,       -- ULID: spec_01HZ7M3QVXK4X2RVNQ5Y8P6JA
  user_id         TEXT NOT NULL,
  prompt          TEXT NOT NULL,
  domain          TEXT NOT NULL DEFAULT 'fintech',
  status          TEXT NOT NULL           -- running | awaiting_clarification
                  CHECK (status IN (      -- | completed | failed
                    'running',
                    'awaiting_clarification',
                    'completed',
                    'failed'
                  )),
  options         JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  total_ms        INTEGER
);

CREATE INDEX ON spec_runs (user_id, created_at DESC);
CREATE INDEX ON spec_runs (status) WHERE status IN ('running', 'awaiting_clarification');

-- Each pass produces one row when it completes.
-- Pass outputs are stored here, not in the spec_runs table.
-- This allows individual passes to be re-run without invalidating
-- other passes.
CREATE TABLE pass_outputs (
  id              TEXT PRIMARY KEY,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  pass_number     INTEGER NOT NULL CHECK (pass_number BETWEEN 1 AND 5),
  status          TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'retried')),
  output          JSONB NOT NULL,         -- Structured output per PIPELINE.md schemas
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  duration_ms     INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (spec_run_id, pass_number, attempt_number)
);

-- Questions asked and answers received at the clarification gate.
CREATE TABLE clarification_events (
  id              TEXT PRIMARY KEY,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  questions       JSONB NOT NULL,         -- Array of ClarificationQuestion
  answers         JSONB,                  -- NULL until answered
  status          TEXT NOT NULL CHECK (status IN ('pending', 'answered', 'timed_out')),
  asked_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  answered_at     TIMESTAMPTZ,
  timeout_at      TIMESTAMPTZ NOT NULL    -- asked_at + 300 seconds
);

-- One row per TLA+ model group generated in Pass 5.
CREATE TABLE formal_models (
  id              TEXT PRIMARY KEY,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  model_id        TEXT NOT NULL,          -- e.g., "BalanceSafety"
  tla_source      TEXT NOT NULL,          -- Full .tla file content
  cfg_source      TEXT NOT NULL,          -- Full .cfg file content
  status          TEXT NOT NULL CHECK (status IN ('verified', 'violated', 'error')),
  verification_bounds JSONB NOT NULL,
  counterexample  TEXT,                   -- TLC output if violated
  duration_ms     INTEGER NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The final rendered markdown specification.
-- Stored separately from pass outputs so it can be fetched without
-- reassembling from parts.
CREATE TABLE rendered_specs (
  id              TEXT PRIMARY KEY,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id) UNIQUE,
  markdown        TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Versioning Model

### Why Specs Need Versions

Requirements change. A spec generated in week 1 may be outdated by week 3
when the user realizes they need multi-region support. The platform must
allow re-running the pipeline with updated requirements without destroying
the original spec.

### How Versioning Works

When a user requests a spec update:
1. The original `spec_run` is NOT modified.
2. A new `spec_run` is created with `parent_spec_id` pointing to the
   original.
3. The user provides the changed or new requirements only -- not the full
   prompt again.
4. The pipeline runs a **delta analysis** first: which passes are
   invalidated by the change?

**Delta Analysis Rules**

| Changed Input | Invalidated Passes | Passes Reused |
|---|---|---|
| NFR only (e.g., throughput) | Pass 4, Pass 5 | Pass 1 (partial), Pass 2, Pass 3 |
| New functional requirement | Pass 2, Pass 3, Pass 4, Pass 5 | Pass 1 (partial) |
| Clarification answer change | All passes after the gate | Pass 1 |
| Concurrency model override | Pass 4, Pass 5 | Pass 1, 2, 3 |

Passes that can be reused are copied from the parent `spec_run` rather
than re-executed. This reduces pipeline runtime for incremental updates.

**Schema Addition**
```sql
-- Added to spec_runs table:
parent_spec_id  TEXT REFERENCES spec_runs(id),
change_summary  TEXT,   -- What changed from parent spec (user-provided)
reused_passes   INTEGER[] DEFAULT '{}'  -- Pass numbers reused from parent
```

---

## File Storage (TLA+ Models and Scaffold)

TLA+ `.tla` and `.cfg` files are stored in the database (`formal_models`
table) for small specs and in object storage (S3-compatible) for larger
outputs and scaffold archives.

**Decision boundary**: If total formal model output < 1MB, store in DB.
If >= 1MB, store in object storage with DB reference.

```sql
-- For object storage references:
CREATE TABLE spec_artifacts (
  id              TEXT PRIMARY KEY,
  spec_run_id     TEXT NOT NULL REFERENCES spec_runs(id),
  artifact_type   TEXT NOT NULL CHECK (artifact_type IN ('tla_bundle', 'scaffold')),
  storage_key     TEXT NOT NULL,   -- e.g., "specs/spec_01.../models.zip"
  size_bytes      BIGINT NOT NULL,
  content_type    TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Object storage paths follow the pattern:
```
specs/{spec_id}/models.zip
specs/{spec_id}/scaffold.zip
```

Pre-signed URLs are generated on demand for downloads. URLs expire after
15 minutes. This is enforced in the API layer, not by trusting the client
to use the URL immediately.

---

## Spec ID Format

All spec IDs are **ULIDs** (Universally Unique Lexicographically Sortable
Identifiers):
- Monotonically sortable by creation time.
- URL-safe (no special characters).
- 26 characters.
- Example: `spec_01HZ7M3QVXK4X2RVNQ5Y8P6JA`

Prefix `spec_` is prepended to make the entity type obvious in logs and
URLs. The raw ULID is what is stored as the primary key.

---

## Retention Policy

| Data | Retention |
|------|-----------|
| `spec_runs` metadata | Indefinite (user-owned) |
| `pass_outputs` | 90 days after spec completion |
| `rendered_specs` (markdown) | Indefinite |
| `formal_models` (TLA+ source) | Indefinite |
| Object storage artifacts | Indefinite |
| Failed spec runs | 30 days, then purged |
| SSE connection logs | 7 days |

Users can explicitly delete a spec run. Deletion is soft-deleted first
(30-day recovery window), then hard-deleted.

---

## Indexing Strategy

**High-traffic queries and their indexes:**

```sql
-- Fetch a user's recent specs (primary list view)
SELECT * FROM spec_runs
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 20;
-- Index: (user_id, created_at DESC) -- already defined above

-- Check if a spec is still running (dashboard polling)
SELECT status FROM spec_runs WHERE id = $1;
-- Index: primary key (id)

-- Fetch all pass outputs for a completed spec (result assembly)
SELECT * FROM pass_outputs
WHERE spec_run_id = $1
ORDER BY pass_number ASC;
-- Index: (spec_run_id, pass_number)

-- Find specs awaiting clarification (background job / reminder system)
SELECT * FROM clarification_events
WHERE status = 'pending' AND timeout_at < now();
-- Index: (status, timeout_at) WHERE status = 'pending'
```

---

## Consistency Requirements

The storage layer for spec runs does NOT require strong distributed
consistency -- a spec run is owned by one pipeline process at a time.
However, the following operations are atomic:

1. **Pass output + pass status update**: When a pass completes, its
   output is written AND the `spec_run` status is updated in the same
   transaction.

2. **Clarification gate state**: When a clarification event is answered,
   the `answers` field and `status = 'answered'` are set in one update.
   The pipeline resumes only after this commit is confirmed.

3. **Spec completion**: When the pipeline completes, the `rendered_specs`
   row is inserted AND `spec_runs.status` is set to `completed` AND
   `spec_runs.completed_at` is set -- all in one transaction.

**Invariant**: A `spec_run` with `status = completed` ALWAYS has a
corresponding `rendered_specs` row. There is no partial completion state.

---

## Spec Search (Future, Not MVP)

Post-MVP, specs should be searchable by:
- Semantic similarity to a new prompt (prevent duplicate spec generation).
- Domain patterns used (e.g., "Show all specs that used SAGA_PATTERN").
- Verification status (e.g., "All specs with unresolved violations").

This requires a vector embedding of the spec's requirements stored
alongside the structured data. Not implemented in MVP.
