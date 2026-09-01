name: cors
version: 1.0.0
tier: free
status: stable
domain: security
subdomain: http-security
part: I
tags:
  - cors
  - cross-origin
  - preflight
  - access-control
  - browser-security
patterns:
  - preflight-short-circuit
  - dynamic-origin-validation
  - credentials-cors
aliases:
  - cross-origin resource sharing
  - Access-Control headers
  - preflight
  - CORS policy
depends_on: []
optional_depends_on:
  - config
  - auth_middleware
emits_events:
  - cors.preflight.handled
  - cors.origin.allowed
  - cors.origin.rejected
consumes_events: []
providers:
  - cors (npm)
  - Fastify cors plugin
  - Hono cors
  - custom middleware
---

# `cors`
[idempotency: not_idempotent] <!-- stateless; runs on every request -->

**Version:** 1.0.0 · **Tier:** Free · **Domain:** Security / HTTP Security

> CORS policy management for HTTP backends — when to allow cross-origin requests, how to handle preflight, and the rules that apply when credentials are involved.

## Search Surface

### In plain language
CORS (Cross-Origin Resource Sharing) is a browser security mechanism. When a browser on `app.example.com` calls `api.example.com`, the browser first sends an OPTIONS preflight request to check if the server allows it. This contract manages that preflight response and the `Access-Control-*` headers on every actual response. The three decisions that matter are: which origins to allow, whether to allow credentials (cookies and Authorization headers), and which HTTP methods and headers are permitted. Getting any of these wrong causes browser clients to silently fail while non-browser clients (curl, Postman) work fine — which makes CORS bugs hard to debug.

### Use this contract when
- Your API is called by a browser application hosted on a different domain
- You need to configure which origins can access your API
- You need to allow cookies or Authorization headers in cross-origin requests
- You are setting up a new HTTP backend that will serve browser clients

### Do not use this contract when
- Your API is only called server-to-server (no browser clients) → CORS is irrelevant
- You need all HTTP security headers, not just CORS → use `http_security_headers`
- You are building a same-origin backend (frontend and API on same domain) → no CORS needed

### Not to be confused with
- `http_security_headers` — broader set of headers (CSP, HSTS, X-Frame-Options, and CORS); use if you need all of them
- `auth_middleware` — validates credentials; CORS determines if the browser is allowed to send credentials at all

### Also known as
cross-origin resource sharing, Access-Control headers, preflight, CORS policy

## The Three CORS Decisions

### Decision 1: Which origins to allow

| Origin policy | When to use | Risk |
|---|---|---|
| Specific list | Production APIs with known consumers | Low; only listed origins pass |
| Wildcard `*` | Fully public read-only APIs (no credentials) | Medium; any origin can read |
| Dynamic validation | Multi-tenant SaaS where tenant domains vary | Low if validation is strict |
| **Never: `*` with credentials** | — | **HIGH: browsers reject it anyway; attempting it signals a config error** |

**Rules:**
- Never combine `Access-Control-Allow-Origin: *` with `Access-Control-Allow-Credentials: true`. Browsers reject this and it reveals a misconfiguration.
- For production, always use a specific list or strict dynamic validation.
- Development can use `http://localhost:*` patterns, but only in non-production configuration.

### Decision 2: Whether to allow credentials

Credentials = cookies + Authorization headers + TLS client certificates in cross-origin requests.

**Allow credentials when:** Your browser client sends session cookies or the `Authorization` header with tokens. Any endpoint that requires `auth_middleware` and is called from a browser needs credentials enabled.

**Do not allow credentials when:** Your API is purely public (no auth) or is called server-to-server only.

When credentials are allowed:
- `Access-Control-Allow-Origin` must be the specific origin, never `*`
- `Access-Control-Allow-Credentials: true` must be set
- The browser must set `credentials: 'include'` on the fetch call

### Decision 3: Which methods and headers to permit

```
Typical public API:
  Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization, Idempotency-Key, X-Api-Key

Minimal read-only public API:
  Access-Control-Allow-Methods: GET, HEAD, OPTIONS
  Access-Control-Allow-Headers: Content-Type

Webhook receiver (POST only):
  Access-Control-Allow-Methods: POST, OPTIONS
  Access-Control-Allow-Headers: Content-Type, X-Webhook-Signature
```

## Contract

### Functions

#### `configure(options) → CorsMiddleware`
Returns a configured CORS middleware function.

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `options.origins` | `string[] \| '*' \| ((origin: string) => boolean)` | Yes | Allowed origins |
| `options.methods` | string[] | No | Default: `['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']` |
| `options.allowed_headers` | string[] | No | Default: `['Content-Type','Authorization']` |
| `options.exposed_headers` | string[] | No | Headers the browser can read from the response |
| `options.credentials` | boolean | No | Default: `false`. Set `true` if browser sends cookies or Authorization header |
| `options.max_age` | number | No | Preflight cache TTL in seconds. Default: `86400` (24 hours) |

---

#### `handlePreflight(request, response, config) → boolean`
Handles an OPTIONS preflight request. Returns `true` if handled (short-circuits the pipeline); `false` if not a preflight. When handled, sends `200 OK` with `Access-Control-*` headers and no body.

---

#### `applyHeaders(response, origin, config) → void`
Applies CORS headers to an actual request response. Runs on every non-OPTIONS response.

### Types

```typescript
type CorsConfig = {
  origins: string[] | '*' | OriginValidator
  methods: string[]
  allowed_headers: string[]
  exposed_headers: string[]
  credentials: boolean
  max_age: number
}

type OriginValidator = (origin: string) => boolean

type PreflightResult = {
  allowed: boolean
  origin: string
  headers_set: string[]
}
```

## Invariants

1. **CORS middleware must be the first middleware in the pipeline.** Preflight OPTIONS requests must be handled before auth or any other middleware runs. An OPTIONS preflight must return `200 OK` even for protected endpoints.
2. **`Access-Control-Allow-Origin: *` must never be combined with `Access-Control-Allow-Credentials: true`.** This combination is rejected by all browsers.
3. **Dynamic origin validation must use an allowlist, not a blocklist.** Checking that an origin does NOT match a pattern is error-prone. Checking that it DOES match is safe.
4. **Preflight must be cached by the browser using `Access-Control-Max-Age`.** Not setting this causes a preflight on every request, doubling network overhead.
5. **Exposed headers must be explicitly listed.** The browser cannot read custom headers from a cross-origin response unless they appear in `Access-Control-Expose-Headers`.

## CORS is Not Security

CORS does not protect your API. It only controls which browser origins can make requests. Non-browser tools (curl, Postman, other servers) ignore CORS entirely. Real API security is `auth_middleware` + `permissions`. CORS is browser UX policy, not an access control mechanism.

## Error Catalogue

| Error Code | Browser behaviour | Cause | Fix |
|---|---|---|---|
| `CORS_ORIGIN_BLOCKED` | Browser blocks the request silently | Origin not in allowlist | Add origin to `options.origins` |
| `CORS_CREDENTIALS_WILDCARD` | Browser blocks; console error | `*` + `credentials: true` | Use specific origin |
| `CORS_MISSING_ALLOW_HEADER` | Browser blocks | Custom header not in `allowed_headers` | Add header to `allowed_headers` |
| `CORS_PREFLIGHT_FAILED` | Browser blocks; 4xx on OPTIONS | Middleware not first; auth intercepted preflight | Move CORS before auth |

## Integration Map

### Position in pipeline
**Must be position 1.** See `http_middleware_pipeline`.

### Used by

| Contract | How |
|---|---|
| `http_middleware_pipeline` | Position 1 in the canonical middleware order |
| `auth_middleware` | Runs after CORS; relies on preflight already being handled |

### Related ADRs and Standards

- `ADR-035` — Bearer vs cookie auth (credentials CORS implications)
- `http_security_headers` — broader security header contract

## Observability

### Metrics

```
blueprint_cors_preflight_total        counter { origin, result }
blueprint_cors_origin_blocked_total   counter { origin }
blueprint_cors_requests_total         counter { origin, method }
```

## Provider Guide

| Provider | Type | Notes |
|---|---|---|
| cors (npm) | Managed | Standard Express/Connect middleware; pass `corsOptions` object |
| Fastify cors | Managed | `@fastify/cors` plugin; async origin validator supported |
| Hono cors | Managed | Built-in `hono/cors`; edge-native |
| Custom middleware | Custom | Implement `handlePreflight` + `applyHeaders` functions directly |

## Failure Modes

| Scenario | Behaviour | Recovery |
|---|---|---|
| CORS configured after auth | Preflight returns 401; browser clients fail | Move CORS before auth in middleware order |
| Origin list not updated after domain change | All browser requests fail silently | Update `options.origins`; deploy |
| `max_age` not set | Browser sends preflight on every request | Set `max_age: 86400` |
| Credentials not enabled but frontend sends `credentials: 'include'` | Browser drops credentials | Set `credentials: true` and specific origin |
