# Module Contract: `request_validation`

**Version:** 0.1.0

---

### `request_validation`
Universal request payload validation with size limits, type coercion, character set enforcement, and injection prevention.

**Functions**
```
validatePayload(payload, schema, options?) → ValidationResult
validateField(value, rules) → FieldResult
sanitizeForSql(input) → SanitizedInput
sanitizeForShell(input) → SanitizedInput
sanitizeForHtml(input) → SanitizedInput
getMaxPayloadSize(endpoint) → number
setMaxPayloadSize(endpoint, bytes) → void
```

**Types**
```
ValidationResult { valid: bool, errors: ValidationError[], sanitized?: Record<string, any> }
ValidationError { field, code: size_exceeded|invalid_type|invalid_charset|injection_detected, message, rejected_value? }
FieldResult { valid: bool, sanitized?: string, error?: ValidationError }
SanitizedInput { original, safe, method: parameterized|escaped|encoded }
ValidationRule { type: string|number|boolean|email|url|date|regex, required?, max_length?, min_length?, pattern?, charset?, sanitize: bool }
ValidationOptions { max_payload_size?, strict_types?, strip_unknown?: bool }
```

**Invariants**
- Every module function that accepts external input must validate the payload size before processing -- payloads exceeding `max_payload_size` must be rejected with a `size_exceeded` error before any business logic runs
- Any input that fails validation must be rejected with a `validation_error` before it reaches the database, cache, or downstream service
- Inputs used in database queries must pass through parameterised queries or prepared statements -- string concatenation of user input into SQL is a contract violation
- Inputs used in HTML or XML output must be contextually escaped to prevent XSS
- Inputs used in shell commands must be rejected unless they pass through an allowlist of permitted characters

**Providers:** Zod, Joi, Pydantic, class-validator, custom

**Dependencies:** config_schema

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Validation rules must be immediately consistent per instance

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for validation.
* **Details:** Validation is synchronous per-request; no retry semantics.

### Worker Scaling
* **Policy:** Validation is CPU-bound and must scale with request volume.

### Multi-Region Behavior
* **Mode:** Validation rules are identical across regions; payload size limits may be tuned per region.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
validatePayload:
    size_exceeded:          Payload exceeds the maximum allowed size | reduce payload size
    invalid_charset:        Input contains characters outside the permitted set | sanitize or reject

  sanitizeForSql:
    injection_detected:     Input contains patterns matching known SQL injection vectors | reject
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `request_validation.<function>`.
* **Telemetry Metrics:**
```
gensense_request_validation_checks_total        { result }
  gensense_request_validation_rejections_total    { code }
  gensense_request_validation_payload_bytes       histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** config_schema
* **Emits To:** (none)
* **Recommends:** audit_log
