name: api_client
version: 1.0.0
tier: free
status: stable
domain: platform
subdomain: reliability
part: I
tags:
  - http-client
  - retry
  - timeout
  - backoff
  - service-to-service
  - resilient-client
  - header-propagation
patterns:
  - exponential-backoff-jitter
  - timeout-budget
  - circuit-breaker-integration
  - header-forwarding
aliases:
  - HTTP client
  - service client
  - resilient client
  - outbound HTTP
depends_on:
  - request_context
optional_depends_on:
  - circuit_breaker
  - telemetry
  - secrets
emits_events:
  - api_client.request.sent
  - api_client.request.succeeded
  - api_client.request.failed
  - api_client.request.retried
  - api_client.circuit.open
consumes_events: []
providers:
  - fetch (native)
  - axios
  - got
  - undici
  - ky
  - httpx (Python)
---

# `api_client`
[idempotency: idempotency_key_required] <!-- outbound mutations require idempotency key -->

**Version:** 1.0.0 · **Tier:** Free · **Domain:** Platform / Reliability

> Resilient outbound HTTP client for service-to-service calls — timeout budgets, retry with exponential backoff and jitter, correlation header propagation, and circuit breaker integration.

## Search Surface

### In plain language
Every time your service calls another service or a third-party API, it needs: a timeout so it doesn't wait forever, a retry strategy so transient failures don't surface as errors, jitter so all retrying clients don't hammer the same endpoint at the same moment, correlation header forwarding so traces cross service boundaries, and circuit breaking so a failing downstream doesn't take your service down. This contract defines the standard configuration for all outbound HTTP calls and the decision rules for when to retry and when not to.

### Use this contract when
- Your service makes outbound HTTP calls to other services or external APIs
- You need consistent retry, timeout, and backoff behavior across all service calls
- You need to propagate correlation IDs and auth tokens to downstream services
- You need to integrate with the circuit breaker pattern

### Do not use this contract when
- You are handling incoming HTTP requests → use `http_routing` and `auth_middleware`
- You need message queue consumption → use `queues`
- You need database connections → use `connection_pool`

### Not to be confused with
- `circuit_breaker` — the state machine that opens/closes based on error rate; api_client uses circuit_breaker as a dependency
- `http_routing` — inbound request routing; api_client is for outbound calls
- `webhooks` — sending outbound event notifications; api_client is for synchronous request-response calls

### Also known as
HTTP client, service client, resilient client, outbound HTTP

## Timeout Budget

Every outbound call must declare a timeout. Timeouts must follow the hierarchy in `ADR-025`.

| Caller type | Max timeout for outbound calls |
|---|---|
| User-facing API endpoint | 5–10 seconds (must respond to user within 25s) |
| Background job / async worker | 30 seconds |
| Health check | 2 seconds |
| Webhook delivery | 30 seconds (per `runtime_standards`) |

**The timeout you set must be shorter than the caller's own timeout.** If a user-facing endpoint has a 20-second timeout, the outbound call it makes must be ≤ 15 seconds — leaving 5 seconds for error handling and response.

## Retry Decision Table

| HTTP Status | Retry? | Reason |
|---|---|---|
| `500 Internal Server Error` | **Only if idempotent** | Server fault; may recover. Non-idempotent mutations must not retry without an idempotency key |
| `502 Bad Gateway` | Yes | Upstream transient failure |
| `503 Service Unavailable` | Yes; respect `Retry-After` header | Service temporarily unavailable |
| `504 Gateway Timeout` | Yes | Upstream timeout |
| Network timeout / connection refused | Yes | Transient connectivity issue |
| `429 Too Many Requests` | Yes; respect `Retry-After` header | Rate limited |
| `400 Bad Request` | **Never** | Client error; retrying won't fix it |
| `401 Unauthorized` | **Never** (refresh token first, then one retry) | Auth issue |
| `403 Forbidden` | **Never** | Permanent authorization failure |
| `404 Not Found` | **Never** | Resource doesn't exist |
| `409 Conflict` | **Never** | Conflict must be resolved at application layer |
| `422 Unprocessable` | **Never** | Business rule violation |

## Contract

### Functions

#### `createClient(base_url, options?) → ApiClient`
Creates a configured HTTP client for a target service.

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `base_url` | string | Yes | Base URL for all requests to this service |
| `options.timeout_ms` | number | No | Request timeout. Default: 10000 (10s) |
| `options.retry.max_attempts` | number | No | Default: 3 |
| `options.retry.backoff` | BackoffConfig | No | Default: exponential with full jitter |
| `options.circuit_breaker` | CircuitBreakerRef | No | Circuit breaker instance from `circuit_breaker` module |
| `options.auth` | AuthConfig | No | How to attach auth credentials to outbound requests |
| `options.propagate_headers` | string[] | No | Headers to forward from incoming request (e.g. `['X-Correlation-ID']`) |

---

#### `client.get(path, options?) → Response`
Sends a GET request. Always retried on transient failures.

---

#### `client.post(path, body, options?) → Response`
Sends a POST request. **Only retried if an `idempotency_key` is provided in `options`.** Without an idempotency key, POST is not retried.

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `options.idempotency_key` | string | No | If provided, enables safe retry of this POST |
| `options.timeout_ms` | number | No | Per-request timeout override |

---

#### `client.put(path, body, options?) → Response`
Sends a PUT request. Retried on transient failures (PUT is idempotent by HTTP semantics).

---

#### `client.patch(path, body, options?) → Response`
Sends a PATCH request. **Only retried if an `idempotency_key` is provided.**

---

#### `client.delete(path, options?) → Response`
Sends a DELETE request. Retried on transient failures (DELETE is idempotent).

### Types

```typescript
type ApiClient = {
  base_url: string
  options: ClientOptions
  get(path: string, options?: RequestOptions): Promise<Response>
  post(path: string, body: any, options?: RequestOptions): Promise<Response>
  put(path: string, body: any, options?: RequestOptions): Promise<Response>
  patch(path: string, body: any, options?: RequestOptions): Promise<Response>
  delete(path: string, options?: RequestOptions): Promise<Response>
}

type ClientOptions = {
  timeout_ms: number
  retry: RetryConfig
  circuit_breaker?: CircuitBreakerRef
  auth?: AuthConfig
  propagate_headers: string[]
}

type RetryConfig = {
  max_attempts: number
  backoff: BackoffConfig
  retryable_status_codes: number[]
}

type BackoffConfig = {
  strategy: 'exponential_full_jitter'
  base_ms: number            // Default: 100
  cap_ms: number             // Default: 30000
}

type AuthConfig =
  | { type: 'bearer'; token_fn: () => Promise<string> }
  | { type: 'api_key'; key: string; header: string }
  | { type: 'mtls'; cert_path: string; key_path: string }
  | { type: 'none' }
```

## Backoff Formula

All retries must use exponential backoff with **full jitter**:

```
wait_ms = random(0, min(cap_ms, base_ms × 2^attempt))

Where:
  base_ms = 100
  cap_ms  = 30000
  attempt = 0, 1, 2, ...
```

Full jitter is mandatory. Equal jitter still causes synchronized retry bursts. No jitter causes thundering herd. See `ADR-025`.

## Invariants

1. **Every outbound request must have a timeout.** An unbounded outbound call will block a worker thread/goroutine indefinitely under failures.
2. **Non-idempotent requests (POST, PATCH) must not be retried without an idempotency key.** Retrying without idempotency creates duplicate side effects.
3. **Correlation headers must be propagated to every outbound request.** The `X-Correlation-ID` and `X-Request-ID` from `request_context` must be forwarded.
4. **Client errors (4xx) must never be retried** (except 429, which respects `Retry-After`).
5. **The circuit breaker must be checked before making the request.** If the circuit is open, return a fast failure immediately — do not attempt the call.
6. **Auth credentials must be obtained via a function call, not a static string.** `token_fn` is called per-request so that rotated tokens are always used.

## Integration Map

### Depends on

| Contract | Relationship | Notes |
|---|---|---|
| `request_context` | **Required** | Reads correlation ID; propagates to outbound headers |
| `circuit_breaker` | **Optional but recommended** | Wraps outbound call in circuit breaker state |
| `telemetry` | **Optional** | Creates trace spans for each outbound call |
| `secrets` | **Optional** | Fetches API keys and tokens from secrets store |

### Related ADRs and Standards

- `ADR-025` — Timeout and retry hierarchy
- `ADR-026` — Graceful degradation

## Observability

### Metrics

```
blueprint_api_client_requests_total        counter   { target_service, method, status }
blueprint_api_client_duration_ms           histogram { target_service, method }
blueprint_api_client_retries_total         counter   { target_service, reason }
blueprint_api_client_circuit_opens_total   counter   { target_service }
blueprint_api_client_timeouts_total        counter   { target_service, method }
```

### Trace spans

```
api_client.<target_service>.<method>   → full outbound call including retries
  api_client.attempt.<n>              → individual attempt
```

## Failure Modes

| Scenario | Behaviour | Recovery |
|---|---|---|
| Timeout on attempt 1 | Retry with backoff + jitter | Up to max_attempts |
| Circuit breaker open | Return fast failure immediately; do not attempt | Wait for circuit to half-open |
| Non-idempotent POST times out | Return timeout error; do not retry | Client must check for side effect before retrying |
| `Retry-After` header present | Wait exactly that duration before retrying | |
| All retries exhausted | Return `PROVIDER_ERROR` to caller | Caller handles fallback or surfaces error |
