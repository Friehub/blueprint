# Module Contract: `error_response_standard`

**Version:** 0.1.0

---

### `error_response_standard`
Canonical error response envelope used across all API endpoints.

**Functions**
```
formatError(error: any, request_id?: string) → ErrorResponse
parseError(response: any) → ErrorDetail
```

**Types**
```
ErrorResponse { error: ErrorDetail, request_id: string }
ErrorDetail { code: string, message: string, details?: any, docs_url?: string }
ErrorCode = NotFound | Unauthorized | ValidationError | RateLimited | ProviderError | Timeout | InternalError
```

**Invariants**
- All errors must include `code`, `message`, and `request_id` fields
- Stack traces must never be exposed to the caller; they are logged server-side only
- `request_id` must be a UUID v4 that correlates to the server-side trace
- `code` must use UpperCamelCase and match a known ErrorCode value
- `message` must be user-facing and locale-aware when i18n is configured
- `details` is optional and must not contain sensitive data (PII, secrets, tokens)
- `docs_url` when present must point to a valid documentation page for the error code

**Providers:** built-in, Express error middleware, FastAPI exception handler, Spring @ControllerAdvice, Gin middleware, Axum error handler

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Error responses are generated synchronously per request

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once`
* **Details:** Error is returned directly in the HTTP response body

### Worker Scaling
* **Policy:** Error formatting is stateless and CPU-bound; no scaling concerns

### Idempotency Requirements
* **Standard:** Idempotent errors: retrying the same request with the same idempotency key returns the same error response.

### Error Taxonomy
* All errors inherit from the standard ErrorCode taxonomy:
  - `NotFound` — requested resource does not exist
  - `Unauthorized` — authentication or authorization failed
  - `ValidationError` — request payload failed validation
  - `RateLimited` — caller exceeded rate limit
  - `ProviderError` — downstream provider returned an error
  - `Timeout` — operation exceeded deadline
  - `InternalError` — unexpected server error (no details exposed)

### Event Emission
```
formatError    → error.response.formatted   { code, request_id, has_details }
formatError    → error.stack_trace.suppressed { request_id, error_code }
```

### Storage Model
* **Model:** Errors are not persisted; they are returned inline and logged
* **Details:** Structured error logs are written to the observability pipeline with full stack traces

### Observability
* **Tracing Spans:** Every error creates a span with error annotation. Span names follow `error.<function>`.
* **Telemetry Metrics:**
```
blueprint_error_response_total              counter { code, function }
blueprint_error_response_suppressed_trace   counter { code }
blueprint_error_response_docs_missing       counter { code }
```

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events, logs
* **Recommends:** (none)

### Database Schema

#### PostgreSQL
```sql
-- No dedicated tables; error responses are transient.
-- Structured error logs are stored in the observability backend.
CREATE TABLE error_response_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id    UUID NOT NULL,
  code          TEXT NOT NULL,
  message       TEXT NOT NULL,
  details       JSONB,
  stack_trace   TEXT,  -- server-side only, never returned to caller
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_error_log_request ON error_response_log(request_id);
CREATE INDEX idx_error_log_code ON error_response_log(code);
CREATE INDEX idx_error_log_created ON error_response_log(created_at);
```

### Breaking Change Policy
- Adding new error codes is backward-compatible.
- Removing or renaming a standard error code requires a MAJOR version bump.
- Changing the error response envelope shape requires a MAJOR version bump.
- Adding new optional fields to `ErrorDetail` is backward-compatible.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Stack trace leak | Misconfigured error serializer | Server-side redaction; audit log on exposure |
| Missing request_id | Request processed before middleware | Auto-generate at earliest middleware |
| Unrecognized error code | New error thrown without registration | Fall back to InternalError; log warning |
| Sensitive data in details | Developer error in error enrichment | Scan details for secret patterns; redact on format |
