# Module Contract: `prompt_registry`

**Version:** 0.2.1

---

### `prompt_registry`
Versioned prompt template storage with evaluation and A/B testing support.

**Functions**
```
registerPrompt(name, template, options?) → PromptVersion
getPrompt(name, version?) → PromptVersion?
listPrompts(tag?) → PromptSummary[]
updatePrompt(name, template, change_reason) → PromptVersion
activateVersion(prompt_id, version) → void
evaluatePrompt(prompt_id, test_cases) → EvaluationResult
createABTest(prompt_id, variant_a, variant_b, config) → ABTest
getABTestResults(test_id) → ABTestResult
archivePrompt(name) → void
```

**Types**
```
PromptVersion { id, prompt_id, name, template, variables, version, status: draft|active|deprecated, change_reason, created_at }
PromptSummary { id, name, active_version, total_versions, tags, last_evaluated_at }
PromptOptions { tags?, variables?, description?, model?, max_tokens?, temperature? }
EvaluationResult { prompt_id, version, test_cases: TestCaseResult[], pass_rate, avg_score, failures }
TestCaseResult { input, expected_output, actual_output, score, passed, duration_ms }
ABTest { id, prompt_id, variant_a_version, variant_b_version, config, status: running|completed, started_at }
ABTestConfig { sample_size, metric, min_duration }
ABTestResult { test_id, winner: a|b|tie, metrics: { a: MetricSummary, b: MetricSummary }, confidence }
```

**Invariants**
- `getPrompt` without a version must return the active version -- never a draft or deprecated version
- A prompt that is referenced by an active A/B test must not be archived until the test completes
- `activateVersion` must atomically mark the previous active as deprecated and the new version as active

**Providers:** custom (database-backed), LangSmith, PromptLayer, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Prompt version metadata must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for prompt lifecycle events.
* **Details:** Duplicate activation events must be idempotent -- activating an already-active version is a no-op.

### Worker Scaling
* **Policy:** Prompt retrieval and evaluation execution must be independently scalable.

### Multi-Region Behavior
* **Mode:** Prompt registry data must be replicated to all regions where LLM inference runs.
* **Details:** Prompt templates are synchronized asynchronously; activation must propagate before the prompt is used.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Evaluation runs against LLM backends must use the llm_gateway module and inherit its backpressure behavior.

### Storage Model
* **Model:** Relational database (PostgreSQL) for prompt versions, templates, and A/B test configurations.
* **Details:**
```sql
CREATE TABLE prompts (
    id              UUID PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE,
    active_version  INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prompt_versions (
    id              UUID PRIMARY KEY,
    prompt_id       UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
    version         INT NOT NULL,
    template        TEXT NOT NULL,
    variables       TEXT[],
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'deprecated')),
    change_reason   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (prompt_id, version)
);

CREATE TABLE ab_tests (
    id              UUID PRIMARY KEY,
    prompt_id       UUID NOT NULL REFERENCES prompts(id),
    variant_a_version INT NOT NULL,
    variant_b_version INT NOT NULL,
    config          JSONB,
    status          TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'completed')),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_versions_active ON prompt_versions (prompt_id, version) WHERE status = 'active';
```

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
registerPrompt   → prompt.registered           { name, version }
  updatePrompt     → prompt.updated              { name, new_version, change_reason }
  activateVersion  → prompt.activated             { name, version }
  archivePrompt    → prompt.archived              { name }
  evaluatePrompt   → prompt.evaluation.completed  { name, version, pass_rate }
```

### Temporal Constraints
```
Draft expiry:
    default:        30 days
    on_expiry:      auto-archive draft versions that have never been activated
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `prompt_registry.<function>`.
* **Telemetry Metrics:**
```
blueprint_prompt_registry_prompts_total          { status }
  blueprint_prompt_registry_evaluations_total     { result }
  blueprint_prompt_registry_ab_tests_total         { status }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** llm_gateway (for evaluation), audit_log
