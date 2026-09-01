name: http_middleware_pipeline
version: 1.0.0
tier: free
status: stable
domain: platform
subdomain: api
part: I
tags:
  - middleware
  - pipeline
  - request-lifecycle
  - middleware-ordering
  - cross-cutting-concerns
  - middleware-composition
patterns:
  - middleware-chain
  - onion-model
  - short-circuit
aliases:
  - middleware chain
  - middleware stack
  - request pipeline
  - middleware composition
  - HTTP pipeline
depends_on:
  - http_routing
optional_depends_on:
  - cors
  - auth_middleware
  - rate_limiting
  - request_validation
  - http_security_headers
  - request_context
  - telemetry
emits_events:
  - middleware.pipeline.configured
  - middleware.short_circuited
consumes_events: []
providers:
  - Express
  - Fastify
  - Hono
  - NestJS
  - Django
  - FastAPI
---

# `http_middleware_pipeline`
[idempotency: not_idempotent] <!-- stateless pipeline; idempotency is per-route -->

**Version:** 1.0.0 · **Tier:** Free · **Domain:** Platform / API

> Correct ordering, composition, and error propagation for HTTP middleware in a backend server — the decision framework for how cross-cutting concerns are layered on every request.

## Search Surface

### In plain language
Every HTTP backend runs multiple cross-cutting concerns on every request: CORS preflight, security headers, request ID injection, auth token extraction, rate limiting, payload validation, and then the business handler. The order these run in is not arbitrary — getting it wrong causes auth to run before CORS headers are set (breaking preflight), or rate limiting to run before auth (counting anonymous and authenticated requests in the same bucket). This contract defines the mandatory ordering, explains why each position matters, and describes how errors short-circuit the pipeline.

### Use this contract when
- You are setting up a new HTTP backend and need to know what middleware to add and in what order
- You need to understand why CORS must run before auth
- You need to ensure rate limiting uses the authenticated identity as its key
- You need error propagation to work correctly through the middleware chain
- You are composing per-route vs global middleware

### Do not use this contract when
- You need the individual middleware implementations → use `cors`, `auth_middleware`, `rate_limiting`, etc.
- You need message queue or event processing pipelines → this is HTTP-only
- You need gRPC interceptor ordering → use `grpc` interceptor pattern

### Not to be confused with
- `http_routing` — defines routes and handlers; middleware_pipeline defines what runs before handlers
- `auth_middleware` — implements auth extraction; this contract defines where auth sits in the chain
- `cors` — implements CORS policy; this contract defines that CORS runs first

### Also known as
middleware chain, middleware stack, request pipeline, middleware composition, HTTP pipeline

## The Canonical Middleware Order

Every HTTP server must apply middleware in this order. Position is not configurable.

```
Request arrives
      │
      ▼
1. Request Context (request_id, correlation_id, start_time)
      │
      ▼
2. CORS (preflight short-circuit; response headers on all responses)
      │
      ▼
3. HTTP Security Headers (CSP, HSTS, X-Frame-Options — applied early)
      │
      ▼
4. Request Size Limit (reject oversized bodies before any parsing)
      │
      ▼
5. Body Parser (parse JSON / form-data / multipart)
      │
      ▼
6. Auth Middleware (extract and validate credentials; attach identity)
      │
      ▼
7. Rate Limiting (per-identity if authenticated; per-IP if anonymous)
      │
      ▼
8. Bot Protection (if applicable; after auth so API keys bypass)
      │
      ▼
9. Request Validation (schema validation of parsed body and params)
      │
      ▼
10. Audit Log pre-hook (record that a request was received with identity)
      │
      ▼
11. Route Handler (business logic)
      │
      ▼
12. Audit Log post-hook (record outcome)
      │
      ▼
Response sent
```

### Why This Order

| Position | Reason |
|---|---|
| **Request Context first** | Every subsequent layer needs `request_id` for logging and tracing |
| **CORS before auth** | Browser preflight (`OPTIONS`) must return 200 without auth. If auth runs first, preflight is rejected with 401, breaking all browser clients |
| **Security headers before body parsing** | Headers are cheap; parsing bodies is not. Headers should be set regardless of whether the body parse succeeds |
| **Size limit before body parser** | Rejecting a 500MB payload before attempting to parse it prevents memory exhaustion |
| **Body parser before auth** | Some auth schemes (webhook signatures, HMAC) need the raw body to verify. Parse once, share the result |
| **Auth before rate limiting** | Rate limiting uses the identity (user_id or tenant_id) as the bucket key. Without auth, you can only rate-limit by IP, which is easy to bypass |
| **Rate limiting before validation** | No point running expensive schema validation on a rate-limited request |
| **Bot protection after auth** | API keys and service accounts must bypass bot protection. Bot detection is only for browser/anonymous traffic |
| **Validation before handler** | Handler only runs with well-formed, authenticated, rate-checked input |

## Contract

### Functions

#### `compose(middlewares) → Middleware`
Composes an ordered list of middlewares into a single middleware function. Middlewares execute in order; each calls `next()` to pass to the following layer.

---

#### `applyGlobal(app, middlewares) → void`
Registers the canonical ordered middlewares on all routes in the application.

---

#### `applyRoute(route, middlewares) → Route`
Adds per-route middleware after the global stack. Per-route middleware runs after step 9 (request validation) and before the handler. Use for route-specific auth scope checks or business-rule guards.

---

#### `shortCircuit(response, error) → void`
Immediately sends an error response and halts the pipeline. Subsequent middlewares and the handler do not run.

### Types

```typescript
type Middleware = (request: HttpRequest, response: HttpResponse, next: NextFn) => Promise<void>

type NextFn = () => Promise<void>

type PipelineConfig = {
  global: Middleware[]              // Applied to all routes
  per_route?: Record<string, Middleware[]>  // Applied to specific routes
  error_handler: ErrorMiddleware    // Catches unhandled errors from any layer
}

type ErrorMiddleware = (error: Error, request: HttpRequest, response: HttpResponse) => Promise<void>
```

## Invariants

1. **CORS middleware must run before auth middleware.** OPTIONS preflight requests must return 200 without triggering auth extraction.
2. **Rate limiting must run after auth.** The rate limit key must be the authenticated `subject_id` (or `tenant_id`) when available, falling back to IP only for anonymous requests.
3. **The error handler must be the last registered middleware.** It catches errors thrown by any earlier layer.
4. **Middleware must call `next()` exactly once or short-circuit with an error response.** Calling `next()` twice produces duplicate responses. Not calling it causes the request to hang.
5. **No business logic may appear in global middleware.** Global middleware is for cross-cutting concerns only.
6. **Per-route middleware must not re-run auth extraction.** Auth is global. Per-route middleware reads from `request.auth`, it does not re-validate.
7. **A middleware that mutates the request body must do so before body parsing middleware runs.** After parsing, the body is a shared object; mutations affect all downstream middleware.

## Global vs Per-Route Middleware

```
Global (runs on every request):
  request_context, cors, http_security_headers, size_limit,
  body_parser, auth_middleware, rate_limiting, request_validation

Per-route (runs only on matching routes):
  requireScopes(['orders:write'])
  checkFeatureFlag('new_checkout')
  requireTenant()
  validateIdempotencyKey()
```

**Rule:** If a concern applies to more than 80% of routes, make it global. If it applies to specific resource types, make it per-route.

## Error Propagation

When a middleware calls `next()` and the downstream layer throws, the error bubbles up through the chain in reverse order. Each middleware can catch and handle errors or re-throw.

```
Global error handler must catch:
  - Validation errors     → 400
  - Auth errors           → 401 / 403
  - Rate limit errors     → 429
  - Not found errors      → 404
  - All other errors      → 500 (log internally; do not expose)
```

**The error handler must never expose stack traces to the client.**

## Integration Map

### Depends on

| Contract | Relationship | Notes |
|---|---|---|
| `http_routing` | **Required** | Routes are defined before middleware is attached |

### Used by (sits above these in the pipeline)

| Contract | Notes |
|---|---|
| `cors` | Position 2 |
| `http_security_headers` | Position 3 |
| `auth_middleware` | Position 6 |
| `rate_limiting` | Position 7 |
| `bot_protection` | Position 8 |
| `request_validation` | Position 9 |

### Related ADRs

- `ADR-018` — API style selection
- `ADR-036` — Middleware ordering rationale
- `ADR-009` — Rate limiting scope hierarchy

## Observability

### Metrics

```
blueprint_middleware_duration_ms   histogram { middleware_name }
blueprint_middleware_errors_total  counter   { middleware_name, error_code }
blueprint_pipeline_short_circuits  counter   { stage, reason }
```

### Trace spans

```
http.pipeline                       → parent span for the full pipeline
  middleware.request_context
  middleware.cors
  middleware.auth
  middleware.rate_limit
  middleware.validation
  route.handler
```

## Failure Modes

| Scenario | Behaviour | Recovery |
|---|---|---|
| Middleware throws unhandled error | Error handler catches; returns 500 | Alert via `error_tracking` |
| Middleware forgets to call `next()` | Request hangs until timeout | Framework request timeout kills the connection |
| CORS runs after auth | Preflight requests rejected with 401 | Fix ordering; CORS must be first |
| Rate limiting runs before auth | All traffic rate-limited by IP only | Fix ordering; auth before rate limiting |
