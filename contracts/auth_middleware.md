name: auth_middleware
version: 1.0.0
tier: free
status: stable
domain: security
subdomain: authentication
part: I
tags:
  - bearer
  - authorization-header
  - auth-middleware
  - token-extraction
  - api-key-extraction
  - request-auth
  - scope-validation
patterns:
  - bearer-scheme
  - token-introspection
  - scope-enforcement
  - anonymous-passthrough
aliases:
  - bearer middleware
  - auth guard
  - token extractor
  - authorization middleware
  - request authentication
depends_on:
  - sessions
  - api_keys
optional_depends_on:
  - machine_to_machine_auth
  - rate_limiting
  - audit_log
  - request_context
emits_events:
  - auth_middleware.token.validated
  - auth_middleware.token.rejected
  - auth_middleware.scope.denied
  - auth_middleware.anonymous.passed
consumes_events: []
providers:
  - custom Express middleware
  - custom Fastify plugin
  - Passport.js
  - custom Hono middleware
  - NestJS AuthGuard
---

# `auth_middleware`
[idempotency: not_idempotent] <!-- read-only: validates on every request, no state mutation -->

**Version:** 1.0.0 · **Tier:** Free · **Domain:** Security / Authentication

> Per-request authentication middleware that extracts and validates Bearer tokens, API keys, and session cookies from HTTP requests — bridging the auth system to every protected endpoint.

## Search Surface

### In plain language
Sits at the HTTP layer and runs on every request before the route handler. Extracts credentials from the incoming request (Authorization header, X-Api-Key header, session cookie, or query parameter), validates them against the auth or api_keys module, attaches the resolved identity to the request context, and either passes the request through or returns 401/403 before the handler runs. Supports multiple credential schemes in a priority order, per-route scope requirements, and anonymous passthrough for public endpoints.

### Use this contract when
- You need to protect HTTP endpoints so only authenticated callers can access them
- You need to extract a Bearer JWT or opaque token from the `Authorization` header
- You need to support API key authentication via a header or query parameter
- You need to enforce OAuth scopes or permission checks at the route level
- You need to distinguish anonymous vs authenticated requests on public endpoints

### Do not use this contract when
- You need the full sign-in / token issuance flow → use `auth`
- You need session creation or revocation → use `sessions`
- You need to check what a user is allowed to do (RBAC/ABAC) → use `permissions`
- You are authenticating service-to-service calls (mTLS) → use `zero_trust_network_policy`

### Not to be confused with
- `auth` — issues tokens and manages the login flow; auth_middleware validates them on each request
- `sessions` — manages session lifecycle; auth_middleware reads session tokens and resolves identities
- `permissions` — answers "can this user do X?"; auth_middleware answers "who is this caller?"
- `api_keys` — stores and rotates API keys; auth_middleware extracts and validates them from requests

### Also known as
bearer middleware, auth guard, token extractor, authorization middleware, request authentication, JWT middleware

## Credential Extraction Priority

When a request arrives, credentials are checked in this priority order:

```
1. Authorization: Bearer <token>     → JWT or opaque access token
2. Authorization: Basic <base64>     → username:password (only for specific legacy endpoints)
3. X-Api-Key: <key>                  → API key (header form, preferred)
4. Cookie: session=<token>           → Session cookie (browser-facing endpoints)
5. ?api_key=<key>                    → API key (query param; only for webhook callbacks and SDKs that cannot set headers)
```

**Never extract credentials from the URL path itself.** Path-embedded tokens appear in server logs, CDN logs, and browser history.

**Query-parameter tokens are a last resort.** They appear in access logs and referrer headers. Only use for webhook receivers and embedded asset URLs with short TTLs.

## Contract

### Functions

#### `protect(options?) → Middleware`
Returns a middleware function that enforces authentication on a route. When attached to a route, any request without valid credentials receives `401 Unauthorized`.

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `options.schemes` | `('bearer' \| 'api_key' \| 'cookie' \| 'basic')[]` | No | Default: `['bearer', 'api_key', 'cookie']` |
| `options.scopes` | string[] | No | Required OAuth scopes; token must possess all listed scopes |
| `options.allow_anonymous` | boolean | No | Default: `false`. If `true`, the middleware passes through unauthenticated requests but still resolves identity when credentials are present |
| `options.audience` | string | No | Required JWT `aud` claim; rejects tokens issued for a different audience |

---

#### `extractCredential(request) → Credential | null`
Reads the incoming request and returns the first credential found according to priority order. Returns `null` if no credential is present.

---

#### `validateCredential(credential) → Identity`
Validates the credential against the appropriate backend (`sessions`, `api_keys`, or `machine_to_machine_auth`). Returns the resolved `Identity` or throws a `TokenRejected` error.

**Validation rules by credential type:**
- **Bearer JWT**: Verify signature, check `exp`, check `iss`, check `aud` (if configured), check `jti` against revocation list.
- **Bearer opaque**: Perform token store lookup in `sessions`; return `401` if expired or revoked.
- **API key**: Hash the presented key; look up in `api_keys`; check revoked status; check IP allowlist if configured.
- **Session cookie**: Look up session ID in `sessions`; check expiry and status; extend TTL if active.

---

#### `attachIdentity(request, identity) → void`
Attaches the resolved `Identity` to the request context under a reserved key (`request.auth`). All downstream handlers read from here — they must never re-validate credentials.

---

#### `requireScopes(scopes) → Middleware`
Returns a middleware that checks the resolved identity's scopes after `protect()` has run. Returns `403 Forbidden` if the required scopes are absent. Must be chained after `protect()`.

---

#### `optionalAuth() → Middleware`
Equivalent to `protect({ allow_anonymous: true })`. Resolves identity when present but does not reject unauthenticated requests. Used for public endpoints that have optional personalization.

### Types

```typescript
type Credential = {
  scheme: 'bearer' | 'api_key' | 'cookie' | 'basic'
  raw: string
  source: 'authorization_header' | 'x_api_key_header' | 'cookie' | 'query_param'
}

type Identity = {
  type: 'user' | 'api_key' | 'service'
  subject_id: string          // user_id, api_key_id, or client_id
  scopes: string[]
  tenant_id?: string
  session_id?: string
  token_id?: string           // jti for JWT or api_key_id
  expires_at: Timestamp
  metadata?: Record<string, any>
}

type AuthContext = {
  identity: Identity | null
  authenticated: boolean
  scheme_used: Credential['scheme'] | null
}
```

## Invariants

1. **The middleware must reject a request with `401` before the route handler runs** if credentials are missing and `allow_anonymous` is not set.
2. **A token that has been revoked must be rejected even if its signature is valid and `exp` is in the future.** Revocation state takes precedence over JWT self-validation.
3. **Bearer JWTs must have all required claims: `sub`, `iss`, `aud`, `iat`, `exp`, `jti`.** A JWT missing any of these must be rejected as malformed.
4. **The resolved identity must be immutable for the duration of the request.** Downstream handlers must not alter `request.auth`.
5. **Credential extraction must not log the raw token value.** Only log the token type, subject ID, and outcome.
6. **An API key extracted from a query parameter must be stripped from the URL before forwarding** to downstream services or logging.
7. **`requireScopes` must only run after `protect` has resolved an identity.** Calling it on an unauthenticated request must return `401`, not `403`.
8. **Timing for token validation must be constant.** A missing token and an invalid token must take the same time to reject, to prevent timing-based token enumeration.

## Error Catalogue

| Error Code | HTTP Status | Trigger | Client Action |
|---|---|---|---|
| `TOKEN_MISSING` | 401 | No credential found in request | Include `Authorization: Bearer <token>` header |
| `TOKEN_MALFORMED` | 401 | Credential cannot be parsed (bad base64, missing `.` in JWT) | Re-authenticate; obtain a new token |
| `TOKEN_EXPIRED` | 401 | Access token TTL has passed | Use refresh token to obtain a new access token |
| `TOKEN_REVOKED` | 401 | Token was explicitly invalidated | Re-authenticate |
| `TOKEN_INVALID_SIGNATURE` | 401 | JWT signature verification failed | Re-authenticate; do not retry with same token |
| `TOKEN_WRONG_AUDIENCE` | 401 | JWT `aud` does not match configured audience | Request a token for the correct audience |
| `SCOPE_INSUFFICIENT` | 403 | Token lacks required scope | Re-authenticate with required scopes or contact owner |
| `API_KEY_REVOKED` | 401 | API key has been deactivated | Generate a new API key |
| `API_KEY_IP_BLOCKED` | 403 | Request IP not on API key allowlist | Contact API key owner |

## Integration Map

### Depends on

| Contract | Relationship | Notes |
|---|---|---|
| `sessions` | **Required** | Validates opaque Bearer tokens and session cookies |
| `api_keys` | **Required** | Validates API keys and checks revocation and IP allowlist |
| `machine_to_machine_auth` | **Optional** | Validates M2M JWT tokens when service-to-service calls are expected |
| `request_context` | **Optional** | Attaches identity to request-scoped context |

### Used by

| Contract | How |
|---|---|
| `http_middleware_pipeline` | Positioned after CORS and before business logic handlers |
| `permissions` | Reads `request.auth.identity` to check authorization |
| `audit_log` | Reads `request.auth.identity` to attribute actions to a subject |
| `rate_limiting` | Uses `request.auth.identity.subject_id` as the rate limit key |

### Related ADRs and Standards

- `ADR-011` — JWT vs opaque token selection
- `ADR-035` — Bearer vs cookie auth: when to use which
- `runtime_standards` — credential logging rules

## Provider Guide

| Provider | Type | Notes |
|---|---|---|
| Custom Express middleware | Custom | `app.use(protect())` before route handlers; identity in `req.auth` |
| Custom Fastify plugin | Custom | Register as `fastify.addHook('preHandler', protect())` |
| Passport.js | Managed | Strategy-based; use `passport-jwt` for Bearer, `passport-http-bearer` for opaque |
| NestJS AuthGuard | Managed | Implement `canActivate`; decorate routes with `@UseGuards(AuthGuard)` |
| Custom Hono middleware | Custom | `app.use('*', protect())` before route handlers |

## Operational Behaviour

### Consistency model
**Model:** Strong — a revoked token must not pass validation anywhere. If revocation state is stored in Redis, the middleware must read the revocation list on every request, not from a local cache older than the JWT TTL.

### Delivery guarantee
**Model:** Synchronous per-request. No async delivery.

### Backpressure
If the session store or revocation list is unreachable, the middleware must **fail closed** (return `503`) rather than passing all requests through unauthenticated.

### Multi-region behaviour
**Mode:** Active/active — middleware is stateless. Revocation state must be replicated to all regions before a token is considered revoked system-wide.

### Throughput limits
**`validateCredential` (JWT):** < 1ms per request (local signature verification, no I/O)
**`validateCredential` (opaque):** < 5ms per request (single Redis/DB lookup)

## Observability

### Metrics

```
blueprint_auth_middleware_requests_total    counter   { scheme, result }
blueprint_auth_middleware_latency_ms        histogram { scheme }
blueprint_auth_middleware_rejections_total  counter   { reason }
blueprint_auth_middleware_scope_denied_total counter  { required_scope }
```

### Trace spans

```
auth_middleware.extract_credential
auth_middleware.validate_credential
auth_middleware.attach_identity
auth_middleware.require_scopes
```

### SLO targets

| Operation | P50 | P99 | Error rate |
|---|---|---|---|
| JWT validation (local) | < 1ms | < 3ms | < 0.01% |
| Opaque token lookup | < 3ms | < 10ms | < 0.1% |
| API key validation | < 3ms | < 10ms | < 0.1% |

## Failure Modes

| Scenario | Behaviour | Recovery |
|---|---|---|
| Session store unreachable | Fail closed: return `503`; do not pass through | Alert; restore session store |
| JWT signing key unavailable (JWKS fetch fails) | Fail closed: return `503` | Cache JWKS with TTL; fail closed if TTL expired |
| Revocation list stale | Fail closed: return `503` after configurable staleness threshold | Restore revocation store |
| Malformed Authorization header | Return `401 TOKEN_MALFORMED` immediately | Client re-authenticates |
| Token validated but identity record deleted | Return `401 TOKEN_REVOKED` | Client re-authenticates |

## Change Policy

**Current version:** 1.0.0
**Stability:** Stable

### Non-breaking changes
- Adding a new supported credential scheme
- Adding new optional fields to `Identity`
- Adding new optional `options` to `protect()`

### Breaking changes
- Removing a supported credential scheme
- Changing the shape of `Identity` (removing fields)
- Changing where identity is attached to the request object
