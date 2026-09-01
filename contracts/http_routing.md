name: http_routing
version: 1.0.0
tier: free
status: stable
domain: platform
subdomain: api
part: I
tags:
  - rest
  - http
  - routing
  - endpoints
  - content-negotiation
  - http-methods
  - status-codes
patterns:
  - resource-based-routing
  - content-negotiation
  - request-lifecycle
  - response-envelope
aliases:
  - REST API
  - HTTP routing
  - route definitions
  - REST endpoints
  - HTTP handlers
depends_on:
  - request_validation
optional_depends_on:
  - auth_middleware
  - rate_limiting
  - cors
  - telemetry
  - error_response_standard
emits_events:
  - http.request.received
  - http.response.sent
  - http.request.rejected
consumes_events: []
providers:
  - Express
  - Fastify
  - Hono
  - Koa
  - NestJS
  - FastAPI
  - gin
  - axum
---

# `http_routing`
[idempotency: safe_methods_idempotent] <!-- GET, HEAD, OPTIONS are idempotent by definition; mutating methods require idempotency key -->

**Version:** 1.0.0 · **Tier:** Free · **Domain:** Platform / API

> REST/HTTP endpoint routing, HTTP method semantics, status code conventions, content negotiation, and request lifecycle for any HTTP-serving backend.

## Search Surface

### In plain language
Defines how to structure REST endpoints: URL path design, HTTP method assignment, status code selection, response envelope shape, content negotiation via Accept/Content-Type headers, and route-level middleware attachment. This is the foundational layer that every HTTP backend needs before adding auth, rate limiting, or validation. The contract enforces resource-based URL design, correct idempotency per method, and consistent response shapes across all endpoints.

### Use this contract when
- You are building any HTTP/REST API backend
- You need to decide how to name and structure URL paths
- You need to assign HTTP methods (GET/POST/PUT/PATCH/DELETE) correctly
- You need consistent response envelopes across all routes
- You need content negotiation (JSON vs other formats)
- You need to understand which HTTP methods are safe/idempotent

### Do not use this contract when
- You are building a GraphQL API → use `graphql`
- You are building a gRPC service → use `grpc`
- You are building a tRPC API → use `trpc`
- You need WebSocket upgrade handling → use `websocket_management`
- You need streaming via SSE → use `sse`

### Not to be confused with
- `graphql` — query language protocol; http_routing is the REST/HTTP layer
- `grpc` — binary RPC over HTTP/2; http_routing is resource-based REST
- `request_validation` — validates payload content; http_routing defines endpoint structure
- `auth_middleware` — extracts and validates auth on each request; http_routing defines routes, not protection
- `api_versioning` — manages lifecycle of multiple API versions; http_routing is the routing mechanism

### Also known as
REST API, HTTP routing, route definitions, REST endpoints, HTTP handlers, HTTP server

## URL Design Rules

### Resource naming
```
GET    /users              → list users (paginated)
POST   /users              → create a user
GET    /users/:id          → get a single user
PUT    /users/:id          → replace a user (full update)
PATCH  /users/:id          → partial update a user
DELETE /users/:id          → delete a user

GET    /users/:id/orders   → list orders for a user (nested resource)
POST   /users/:id/orders   → create an order for a user
```

**Rules:**
- Always use nouns, never verbs. `/users` not `/getUsers`.
- Collections are always plural. `/users` not `/user`.
- Nest resources at most one level deep. `/users/:id/orders` is acceptable; `/users/:id/orders/:id/items/:id/tags` is not — flatten it.
- Use query parameters for filtering, sorting, and pagination. Never encode filter state in the path.
- Use kebab-case for multi-word segments. `/api/user-profiles` not `/api/user_profiles` or `/api/userProfiles`.
- Sub-actions that do not map to CRUD must use a verb suffix. `/orders/:id/cancel` for a cancel action is acceptable.

### HTTP Method Semantics

| Method | Semantics | Body | Idempotent | Safe |
|---|---|---|---|---|
| `GET` | Read a resource or collection | None | Yes | Yes |
| `HEAD` | Read headers only; same as GET but no body | None | Yes | Yes |
| `OPTIONS` | Return allowed methods (used by CORS preflight) | None | Yes | Yes |
| `POST` | Create a new resource or trigger an action | Required | **No** — use idempotency key |No |
| `PUT` | Full replacement of a resource | Required | Yes | No |
| `PATCH` | Partial update of a resource | Required | **No** — use idempotency key | No |
| `DELETE` | Remove a resource | Optional | Yes | No |

**Agent rule:** `POST` and `PATCH` must accept an `Idempotency-Key` header. Without it, duplicate requests produce duplicate effects. See `idempotency_key_standard`.

### HTTP Status Code Guide

| Code | When to use |
|---|---|
| `200 OK` | Successful GET, PUT, PATCH, DELETE with body |
| `201 Created` | Successful POST that created a resource; include `Location` header |
| `202 Accepted` | Request received but processing is async (job enqueued) |
| `204 No Content` | Successful DELETE or PATCH with no response body |
| `400 Bad Request` | Validation failure; request payload is malformed or fails schema |
| `401 Unauthorized` | Missing or invalid auth token; must include `WWW-Authenticate` header |
| `403 Forbidden` | Authenticated but not authorized; do not return 404 to hide resource existence |
| `404 Not Found` | Resource does not exist; return for unknown IDs |
| `409 Conflict` | State conflict (duplicate unique key, optimistic lock failure) |
| `410 Gone` | Resource existed but was permanently deleted (useful for GDPR erasure) |
| `422 Unprocessable` | Request is well-formed but semantically invalid (business rule violation) |
| `429 Too Many Requests` | Rate limit exceeded; include `Retry-After` header |
| `500 Internal Server Error` | Unexpected server fault; never include stack traces |
| `503 Service Unavailable` | Intentional shed load or dependency unavailable; include `Retry-After` |

**Never use `200` for an error** — some clients cannot see the body. Never use `404` to hide authorization failures from attackers; use `403`.

## Contract

### Functions

#### `registerRoute(method, path, handlers) → Route`
Registers an HTTP route with one or more handler functions. Handlers execute in order. The last handler must send the response.

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `method` | `GET \| POST \| PUT \| PATCH \| DELETE \| HEAD \| OPTIONS` | Yes | HTTP method |
| `path` | string | Yes | URL path pattern with optional `:param` segments |
| `handlers` | Function[] | Yes | Ordered middleware + final handler |

---

#### `negotiateContent(request, supported_types) → ContentType`
Reads the `Accept` header and returns the best matching content type from `supported_types`. Returns `application/json` if no `Accept` header is present. Returns `406 Not Acceptable` if no match.

---

#### `parseBody(request, schema?) → ParsedBody`
Reads and parses the request body. Enforces `Content-Type` header. Applies size limit. Optionally validates against a schema.

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `request` | HttpRequest | Yes | Incoming request object |
| `schema` | Schema | No | Validation schema; delegates to `request_validation` |

---

#### `sendResponse(response, status, body?, headers?) → void`
Sends an HTTP response with the given status code, optional body, and headers. Automatically sets `Content-Type` based on body type.

---

#### `sendError(response, error) → void`
Formats and sends an error response using the `error_response_standard` envelope. Never exposes stack traces.

### Types

```typescript
type Route = {
  method: HttpMethod
  path: string
  handlers: Handler[]
  middleware: Middleware[]
}

type ParsedBody = {
  raw: Buffer
  parsed: any
  content_type: string
  size_bytes: number
}

type ContentType = 
  | 'application/json'
  | 'application/xml'
  | 'text/plain'
  | 'text/html'
  | 'application/octet-stream'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

type RequestContext = {
  request_id: string
  method: HttpMethod
  path: string
  params: Record<string, string>
  query: Record<string, string>
  headers: Record<string, string>
  body: ParsedBody | null
  ip: string
  start_time: number
}
```

## Response Envelope Standard

All JSON responses must use a consistent envelope:

### Success response
```json
{
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

### List response (paginated)
```json
{
  "data": [ ... ],
  "pagination": {
    "cursor": "opaque-cursor",
    "has_more": true,
    "limit": 20
  },
  "meta": {
    "request_id": "uuid",
    "timestamp": "ISO-8601"
  }
}
```

### Error response
Delegated to `error_response_standard`. Never diverge from it.

## Invariants

1. **Safe methods (`GET`, `HEAD`, `OPTIONS`) must never produce side effects.** A GET request that modifies state is a contract violation.
2. **`POST` endpoints must not be used for retrieval.** Use query parameters on `GET` for complex filter expressions, not `POST` with a filter body.
3. **`201 Created` responses must include a `Location` header** pointing to the newly created resource.
4. **`PUT` replaces the entire resource.** Missing fields are treated as null/deleted. If partial updates are needed, use `PATCH`.
5. **Error responses must never include stack traces.** Internal error details belong in the server log and error tracking, not the response body.
6. **Request bodies on `GET` and `DELETE` must be ignored.** Routers that forward them to handlers violate HTTP semantics.
7. **Every response must include a `X-Request-ID` header** matching the value in the `meta.request_id` field. See `request_context`.

## Error Catalogue

| Error Code | HTTP Status | Trigger | Client Action |
|---|---|---|---|
| `METHOD_NOT_ALLOWED` | 405 | HTTP method not registered for this path | Use the correct method; check `Allow` header |
| `NOT_ACCEPTABLE` | 406 | No matching content type for `Accept` header | Use `application/json` or a supported type |
| `PAYLOAD_TOO_LARGE` | 413 | Request body exceeds size limit | Reduce payload size |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | `Content-Type` not supported | Use `application/json` |
| `ROUTE_NOT_FOUND` | 404 | No route matches path | Check API documentation |

## Integration Map

### Depends on

| Contract | Relationship | Notes |
|---|---|---|
| `request_validation` | **Optional but recommended** | Validates parsed body against schema |
| `error_response_standard` | **Required** | Formats all error responses |

### Used by

| Contract | How |
|---|---|
| `auth_middleware` | Attaches auth extraction to routes |
| `cors` | Handles OPTIONS preflight and response headers |
| `rate_limiting` | Applies per-route rate limits |
| `http_middleware_pipeline` | Composes ordered middleware on routes |

### Related ADRs and Standards

- `ADR-018` — API style selection (REST vs GraphQL vs gRPC)
- `error_response_standard` — error envelope format
- `idempotency_key_standard` — idempotency on `POST`/`PATCH`
- `pagination_standard` — cursor pagination for list endpoints

## Provider Guide

| Provider | Type | Notes |
|---|---|---|
| Express | Managed | Most widely used Node.js HTTP framework; middleware via `app.use()` |
| Fastify | Managed | Faster than Express; schema-first with JSON Schema validation built in |
| Hono | Managed | Edge-native; works on Cloudflare Workers, Deno, Bun, and Node |
| Koa | Custom | Minimal middleware framework; compose via `koa-compose` |
| NestJS | Managed | Opinionated; built on Express/Fastify; decorators for routes |
| FastAPI | Managed | Python; automatic OpenAPI generation; Pydantic for validation |
| gin | Managed | Go; high-performance; JSON binding built in |
| axum | Managed | Rust; type-safe extractors; `tower` middleware ecosystem |

**Provider selection guide:**
- TypeScript API, standard workload → Fastify
- TypeScript API, edge/serverless → Hono
- TypeScript API, enterprise/enterprise team → NestJS
- Python API → FastAPI
- Go API → gin
- Rust API → axum

## Operational Behaviour

### Consistency model
**Model:** Stateless — HTTP routing itself carries no state. Consistency is determined by the underlying data modules.

### Delivery guarantee
**Model:** At-most-once (HTTP is fire-and-forget; use `idempotency_key_standard` to make non-idempotent routes safe to retry).

### Backpressure
When the server is overloaded, the router must return `503 Service Unavailable` with a `Retry-After` header. Never accept and silently queue requests beyond the configured limit. See `load_shedding`.

### Multi-region behaviour
**Mode:** Active/active — HTTP routing is stateless and can run in any region. Route to the nearest region via CDN or global load balancer.

### Throughput limits
Declare per-route in the route registry. Enforce via `rate_limiting`. HTTP routing itself has no built-in limit.

## Observability

### Metrics

```
blueprint_http_requests_total            counter   { method, path_pattern, status }
blueprint_http_request_duration_ms       histogram { method, path_pattern, status }
blueprint_http_request_size_bytes        histogram { method, path_pattern }
blueprint_http_response_size_bytes       histogram { method, path_pattern }
blueprint_http_errors_total              counter   { method, path_pattern, error_code }
```

### Trace spans

```
http.<method>.<path_pattern>
http.parse_body
http.negotiate_content
http.send_response
```

### SLO targets

| Endpoint class | P50 | P99 | Error rate |
|---|---|---|---|
| Read (GET) | < 50ms | < 200ms | < 0.1% |
| Write (POST/PUT/PATCH) | < 100ms | < 500ms | < 0.5% |
| Delete (DELETE) | < 100ms | < 300ms | < 0.5% |

## Failure Modes

| Scenario | Behaviour | Recovery |
|---|---|---|
| Request body exceeds size limit | Return `413 Payload Too Large` immediately | Client reduces payload size |
| Route not found | Return `404` with standard error envelope | Client checks API docs |
| Upstream dependency timeout | Return `503` with `Retry-After` | Client retries with backoff |
| Unsupported `Content-Type` | Return `415 Unsupported Media Type` | Client switches to `application/json` |
| Uncaught exception in handler | Catch at framework level; return `500`; log internally | Alert via `error_tracking` |

## Change Policy

**Current version:** 1.0.0
**Stability:** Stable

### Non-breaking changes
- Adding a new route
- Adding new optional query parameters
- Adding new optional response fields
- Adding new response headers

### Breaking changes (major version bump)
- Removing a route
- Changing a path parameter name or structure
- Removing a required request field
- Changing a response field type
- Changing an HTTP method for an existing route
