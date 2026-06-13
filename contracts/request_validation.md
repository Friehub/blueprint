# Module Contract: `request_validation`

**Version:** 0.2.0

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
- `validatePayload` must return an error for every invalid field -- it must not silently drop fields from the payload
- `sanitizeForSql` must reject inputs containing SQL metacharacters, not merely escape them. Rejection must occur before the input reaches any query construction code
- `sanitizeForShell` must reject any input containing shell metacharacters (`;`, `|`, `` ` ``, `$`, `\`, `'`, `"`, `*`, `?`, `[`, `]`, `~`, `<`, `>`, `(`, `)`, `{`, `}`, `!`, `^`, `#`) unless the deployment explicitly documents an allowlist override
- The `max_payload_size` for an endpoint must be evaluated against the raw Content-Length header or an equivalent byte-accurate measurement, not against a pre-parsed representation. Character count or field count alone is not sufficient
- Schema validation must use a declarative schema definition (Zod, Joi, Pydantic, etc.) -- imperative custom validation functions that bypass the schema are a contract violation unless explicitly declared in the module's adapter documentation

**Providers:** Zod, Joi, Pydantic, class-validator, custom

**Dependencies:** config_schema

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Validation rules must be immediately consistent per instance. Schema definitions may be cached locally with a TTL.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for validation.
* **Details:** Validation is synchronous per-request; no retry semantics. Validation failures are deterministic -- the same input and schema must always produce the same result.

### Worker Scaling
* **Policy:** Validation is CPU-bound and must scale with request volume. CPU-intensive validation (regex, charset scanning, size checks) must not block the event loop.

### Multi-Region Behavior
* **Mode:** Validation rules are identical across regions; payload size limits may be tuned per region.
* **Details:** Schema definitions are propagated to all regions before activation; validation must not depend on cross-region calls.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If payload size validation or schema parsing becomes a bottleneck, the module must reject excess requests with a `rate_limited` or `429` response rather than blocking. Validation is not backpressure-safe by default -- deployers must configure request concurrency limits.

### Storage Model
* **Model:** In-memory schema registry with optional persistent backup.
* **Details:** Schema definitions may be stored in a configuration database or config file. Compiled schemas (e.g., Zod parsers, Joi schemas) are cached in memory for the lifetime of the process or until invalidated.

### Error Taxonomy
### Module-Specific Errors
```
validatePayload:
    size_exceeded:          Payload exceeds the maximum allowed size | reduce payload size
    invalid_charset:        Input contains characters outside the permitted set | sanitize or reject
    schema_parse_error:     Payload does not match the declared schema | check field types and constraints
    unknown_field:          Payload contains fields not declared in the schema | strip or reject per configuration

  sanitizeForSql:
    injection_detected:     Input contains patterns matching known SQL injection vectors | reject

  sanitizeForShell:
    shell_injection_detected: Input contains shell metacharacters outside the allowlist | reject

  setMaxPayloadSize:
    invalid_size:           Payload size must be a positive integer | provide a valid byte count
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
validatePayload    → request_validation.payload.validated   { result: valid|invalid, fields_inspected }
validatePayload    → request_validation.payload.rejected    { code: size_exceeded|invalid_charset|injection_detected, field }
sanitizeForSql    → request_validation.injection_prevented { context: sql|html|shell }
```

### Temporal Constraints
```
Schema cache TTL:
    default:        5 minutes
    on_expiry:      reload schema from config store; use stale schema if reload fails

  Max payload size:
    duration:       persistent per endpoint configuration
    on_expiry:      N/A -- does not expire; must be explicitly updated
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `request_validation.<function>`.
* **Telemetry Metrics:**
```
blueprint_request_validation_checks_total        { result }
blueprint_request_validation_rejections_total    { code }
blueprint_request_validation_payload_bytes       histogram
blueprint_request_validation_parse_duration_ms   histogram { schema }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details). Validation P99 must be < 10ms for payloads under 1MB.

### Module Dependencies
* **Depends On:** config_schema
* **Emits To:** events
* **Recommends:** audit_log, rate_limiting
