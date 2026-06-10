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
- A `browser` endpoint must send Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy headers on every response
- An `api` endpoint must send CORS headers but is not required to send CSP or HSTS
- `getHeaders` with no explicit policy must return the minimum required defaults defined in global standards
- A CORS policy with `credentials: true` must not use `*` as the allowed origin

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
* None explicitly defined. Custom events must use the canonical domain envelope.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `http_security_headers.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** auth, sessions
* **Emits To:** (none)
* **Recommends:** config_schema
