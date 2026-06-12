# Module Contract: `data_masking`

**Version:** 0.1.0

---

### `data_masking`
PII obfuscation with anonymization, tokenization, and context-aware redaction.

**Functions**
```
maskField(value, strategy) → MaskedValue
maskDocument(document, rules) → MaskedDocument
tokenize(value, context) → Token
detokenize(token, context) → OriginalValue
anonymize(value, strategy) → AnonymizedValue
registerMaskingRule(name, config) → MaskingRule
listMaskingRules(data_type?) → MaskingRule[]
redactLog(log_entry, rules) → RedactedEntry
scanForPii(document_or_schema) → PiiClassification[]
```

**Types**
```
MaskedValue { original_type, masked: string, strategy: partial|full|regex|tokenize, reversible: bool }
MaskedDocument { fields: Record<string, MaskedValue>, unmasked_fields: string[] }
Token { id, context, created_at, expires_at }
OriginalValue { token_id, value, accessed_at }
AnonymizedValue { original_type, anonymized, strategy: generalization|perturbation|k_anonymity }
MaskingRule { id, name, data_type, field_pattern, strategy, reversible, created_at }
RedactedEntry { original, redacted, rules_applied: string[] }
MaskingConfig { strategy, character, preserve_prefix?, preserve_suffix?, regex_pattern?, reversible? }
PiiClassification { field, category: email|phone|ssn|credit_card|address|name|dob|ip|custom, confidence, suggested_strategy }
```

**Invariants**
- A masked value with `reversible: false` must never be recoverable through any function in this module
- `tokenize` and `detokenize` must be authenticated -- any caller without a valid token context must receive an error
- `redactLog` must preserve the log structure (timestamp, level, correlation_id) while masking only sensitive fields

**Providers:** custom, AWS Macie, Microsoft Purview, Privitar, Protegrity

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Token-to-value mappings must be strongly consistent to prevent incorrect detokenization

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for masking operations.
* **Details:** Masking is idempotent -- applying the same rule to the same input produces the same output.

### Worker Scaling
* **Policy:** Tokenization, masking, and redaction must scale with data volume independently.

### Multi-Region Behavior
* **Mode:** Token storage is typically single-region or replicated with strong consistency within a region.
* **Details:** Detokenization requests must be routed to the region that holds the token mapping.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Batch masking operations must report progress and support pause/resume for large datasets.

### Error Taxonomy
### Module-Specific Errors
```
maskField:
    unsupported_type:        Data type is not supported by the requested strategy | use a different strategy

  detokenize:
    token_expired:            Token has expired | re-tokenize the original value
    token_not_found:          Token not found or invalid | verify token ID and context
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
tokenize        → masking.token.created          { token_id, context }
  detokenize      → masking.token.accessed         { token_id, context }
  registerMaskingRule → masking.rule.created      { rule_id, data_type, strategy }
  scanForPii     → masking.pii.scanned            { field_count, pii_fields }
```

### Temporal Constraints
```
Token expiration:
    default:        24 hours
    on_expiry:      token is invalid; original value cannot be recovered

  Masking rule version retention:
    duration:       90 days
    on_expiry:      eligible for archival
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `data_masking.<function>`.
* **Telemetry Metrics:**
```
gensense_data_masking_operations_total          { strategy }
  gensense_data_masking_tokens_created_total     { context }
  gensense_data_masking_redactions_total          { rule }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** Strongly consistent token-to-value mapping store with encrypted values at rest.
* **Details:** Token mappings must be strongly consistent to prevent incorrect detokenization. Reversible masking rules are stored with encryption at rest.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE data_masking_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  data_type       TEXT NOT NULL,
  field_pattern   TEXT NOT NULL,
  strategy        TEXT NOT NULL CHECK (strategy IN ('partial', 'full', 'regex', 'tokenize')),
  config          JSONB NOT NULL DEFAULT '{}',
  reversible      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE data_masking_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context         TEXT NOT NULL,
  token_hash      TEXT NOT NULL UNIQUE,
  encrypted_value BYTEA NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '24 hours'
);

CREATE INDEX idx_masking_tokens_context ON data_masking_tokens(context);
CREATE INDEX idx_masking_tokens_expiry ON data_masking_tokens(expires_at) WHERE expires_at > now();

CREATE TABLE data_masking_pii_classifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field           TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('email', 'phone', 'ssn', 'credit_card', 'address', 'name', 'dob', 'ip', 'custom')),
  confidence      REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  suggested_strategy TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Module Dependencies
* **Depends On:** encryption
* **Emits To:** events
* **Recommends:** audit_log, config, data_catalog
