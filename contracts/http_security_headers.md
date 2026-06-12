# Module Contract: `http_security_headers`

**Version:** 0.1.0

---

### `http_security_headers`
HTTP security header enforcement with distinct policies for browser-facing and API-only endpoints.

**Functions**
```
getHeaders(endpoint_type, options?) → HeaderPolicy
validateResponse(response, policy) → ValidationResult
getCorsPolicy(origin) → CorsPolicy
setCorsPolicy(origin, policy) → void
getHstsPolicy() -> HstsPolicy
```

**Types**
```
HeaderPolicy { endpoint_type: browser|api, headers: SecurityHeader[], cors: CorsPolicy? }
SecurityHeader { name, value, required: bool, description }
CorsPolicy { allowed_origins, allowed_methods, allowed_headers, expose_headers?, credentials: bool, max_age_seconds }
HstsPolicy { max_age, include_subdomains: bool, preload: bool }
ValidationResult { valid: bool, missing: SecurityHeader[], warnings: string[] }
EndpointType = browser | api | mixed
```

**Invariants**
- A `browser` endpoint must send Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy headers on every response — `validateResponse` must return `valid: false` and list missing headers in `missing[]` if any are absent.
- An `api` endpoint must send CORS headers but is not required to send CSP or HSTS — `getHeaders(endpoint_type: "api")` must include `Access-Control-Allow-Origin` at minimum.
- `getHeaders` with no explicit policy must return the minimum required defaults defined in global standards — if global defaults are not configured, return an error rather than sending no headers.
- A CORS policy with `credentials: true` must not use `*` as the allowed origin — `setCorsPolicy` must reject with `INVALID_CORS_ORIGIN` if the origin is `*` and credentials is true.
- `getHstsPolicy` must return a policy with `max_age >= 31536000` (1 year minimum) when HSTS is enabled for the endpoint.
- Header values must be sanitised against header injection (CRLF sequences `\r\n`) — `validateResponse` must flag any header value containing `%0d` or `%0a` as a warning.

**Dependencies:** auth, sessions

**Providers:** helmet, custom middleware, CDN edge functions

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Policy configuration must be immediately consistent per instance

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for header delivery.
* **Details:** Headers are set per-response; no retry semantics.

### Worker Scaling
* **Policy:** Header policy evaluation is per-request with no scaling concerns.

### Multi-Region Behavior
* **Mode:** CORS policies may differ by region; the module must apply the policy matching the request origin regardless of serving region.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
getHeaders      → http_security_headers.generated     { endpoint_type, header_count }
setCorsPolicy   → http_security_headers.cors_updated   { origin, credentials }
validateResponse → http_security_headers.validation_run { endpoint_type, valid, warning_count }
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `http_security_headers.<function>`.
* **Telemetry Metrics:**
```
blueprint_http_security_headers_operations_total      { function, result }
blueprint_http_security_headers_operation_duration_ms  histogram { function }
blueprint_http_security_headers_errors_total           { code }
blueprint_http_security_headers_csp_enforced            gauge { endpoint_type }
blueprint_http_security_headers_validation_warnings     gauge { warning_type }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Invalid CORS origin | Return INVALID_CORS_ORIGIN with allowed origin format |
| Missing required header | Return ValidationResult with valid: false and missing[] populated |

### Breaking Change Policy
- Adding a new optional header: non-breaking
- Removing a required header from default policy: breaking — requires major version bump and migration guide
- Changing a header value format: breaking
- Tightening CSP default policy: non-breaking (safer by default)

### Module Dependencies
* **Depends On:** auth, sessions
* **Emits To:** events
* **Recommends:** config_schema
