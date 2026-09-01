name: cookie_session
version: 1.0.0
tier: free
status: stable
domain: security
subdomain: authentication
part: I
tags:
  - cookie
  - session
  - csrf
  - httponly
  - samesite
  - browser-auth
  - stateful-auth
patterns:
  - double-submit-cookie
  - synchronizer-token
  - cookie-rotation
aliases:
  - session cookie
  - cookie auth
  - browser session
  - stateful session
depends_on:
  - sessions
  - auth
optional_depends_on:
  - rate_limiting
  - audit_log
emits_events:
  - cookie_session.issued
  - cookie_session.rotated
  - cookie_session.revoked
  - cookie_session.csrf.blocked
consumes_events: []
providers:
  - express-session
  - iron-session
  - cookie (npm)
  - custom signed cookie
---

# `cookie_session`
[idempotency: not_idempotent] <!-- session creation has side effects -->

**Version:** 1.0.0 · **Tier:** Free · **Domain:** Security / Authentication

> HTTP cookie-based session management for browser-facing applications — secure cookie attributes, CSRF protection, and session lifecycle for stateful auth.

## Search Surface

### In plain language
When your backend serves a browser-based frontend on the same domain (or subdomain), cookies are the right auth transport — not `Authorization: Bearer` tokens. Cookies are automatically sent by the browser, survive page refreshes, and can be made `HttpOnly` (invisible to JavaScript). This contract covers how to issue, validate, rotate, and revoke session cookies securely, and how to add CSRF protection when cookies are the auth mechanism.

### Use this contract when
- Your backend serves a browser application on the same or subdomain
- You want cookies to carry the session (not JavaScript-accessible Bearer tokens)
- You need CSRF protection because cookies are sent automatically by the browser
- You are building a traditional server-rendered or SPA application with a same-origin API

### Do not use this contract when
- Your API is consumed by mobile apps or third-party services → use `auth_middleware` with Bearer tokens
- Your frontend and API are on completely different domains with no shared parent → Bearer tokens are easier (CORS with credentials is complex)
- You need stateless auth (no session store) → JWT-only pattern via `auth`

### Not to be confused with
- `sessions` — session lifecycle (create, revoke, list); cookie_session is the HTTP transport layer for sessions
- `auth` — handles credential verification and token issuance; cookie_session manages the cookie transport
- `auth_middleware` — Bearer token extraction; cookie_session is the alternative pattern for browser clients

### Also known as
session cookie, cookie auth, browser session, stateful session, HttpOnly cookie

## Cookie Attributes (All Required)

Every session cookie must have all of the following attributes:

| Attribute | Value | Reason |
|---|---|---|
| `HttpOnly` | true | Cookie invisible to JavaScript; prevents XSS-based cookie theft |
| `Secure` | true | Cookie only sent over HTTPS; never over plain HTTP |
| `SameSite` | `Strict` or `Lax` | CSRF protection; see table below |
| `Path` | `/` | Available to all routes |
| `Domain` | `example.com` (parent domain) | Available to subdomains if needed; omit for same-origin only |
| `Max-Age` | Session TTL in seconds | Explicit expiry; never rely on session-only cookies in production |

### SameSite Selection

| Value | When to use | Effect |
|---|---|---|
| `Strict` | Single-domain app where no cross-site navigation needs to carry the cookie | Cookie never sent on cross-site requests, including top-level navigation |
| `Lax` | App that needs the cookie when user follows a link from another site | Cookie sent on cross-site top-level GET navigation; not on other cross-site requests |
| `None` | Cross-origin API that deliberately allows cookies (rare; requires CORS with credentials) | Cookie always sent; must be combined with `Secure` |

**Use `Lax` as the default.** `Strict` breaks flows where the user returns from an external redirect (OAuth callback, email link).

## CSRF Protection

Cookies are automatically sent by the browser on any cross-site request. A malicious site can trigger a state-changing request to your API using the victim's cookie without ever seeing the cookie value. CSRF protection prevents this.

### When CSRF protection is required
CSRF protection is **required** when:
- The endpoint performs a state change (POST, PUT, PATCH, DELETE)
- The auth mechanism is cookie-based

CSRF protection is **not required** when:
- The endpoint uses Bearer tokens (the browser does not auto-send them)
- The endpoint is read-only (GET, HEAD)
- `SameSite=Strict` is enforced AND no cross-site navigation is expected (still use CSRF for defence in depth)

### Recommended pattern: Double Submit Cookie

```
1. On session creation, generate a random CSRF token
2. Set it as a cookie: csrf_token=<random>; SameSite=Lax; Path=/
   (this cookie does NOT need HttpOnly — JS must be able to read it)
3. Client reads the cookie value and includes it in X-CSRF-Token header on every mutating request
4. Server compares X-CSRF-Token header value with the csrf_token cookie value
5. If they match → proceed. If they don't → reject with 403.
```

A cross-site attacker cannot read the CSRF cookie (same-origin policy) and therefore cannot set the `X-CSRF-Token` header correctly.

## Contract

### Functions

#### `issueSessionCookie(response, session_id, options?) → void`
Sets the session cookie on the HTTP response with all required attributes. Reads the session TTL from the `sessions` module.

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `response` | HttpResponse | Yes | Outgoing response object |
| `session_id` | string | Yes | Session ID from `sessions.createSession()` |
| `options.same_site` | `'Strict' \| 'Lax' \| 'None'` | No | Default: `'Lax'` |
| `options.domain` | string | No | Parent domain for subdomain sharing |

---

#### `readSessionCookie(request) → string | null`
Reads the session ID from the incoming request cookie. Returns `null` if no session cookie is present.

---

#### `issueCsrfCookie(response) → string`
Generates a cryptographically random CSRF token, sets it as a readable (non-HttpOnly) cookie, and returns the token value for embedding in the HTML page.

---

#### `validateCsrf(request) → boolean`
Compares the `X-CSRF-Token` request header with the `csrf_token` cookie value. Returns `false` if either is missing or if they do not match. Must be called on all state-changing routes.

---

#### `revokeSessionCookie(response) → void`
Clears the session cookie by setting `Max-Age=0`. Must be called alongside `sessions.revokeSession()`.

---

#### `rotateSessionCookie(request, response) → string`
Issues a new session ID after privilege elevation (e.g. after MFA completion). Revokes the old session cookie and issues a new one. Prevents session fixation.

### Types

```typescript
type CookieOptions = {
  name: string
  value: string
  http_only: boolean
  secure: boolean
  same_site: 'Strict' | 'Lax' | 'None'
  max_age: number
  path: string
  domain?: string
}

type CsrfValidationResult = {
  valid: boolean
  reason?: 'MISSING_HEADER' | 'MISSING_COOKIE' | 'MISMATCH'
}
```

## Invariants

1. **Session cookies must always be `HttpOnly` and `Secure`.** A session cookie without these attributes can be stolen via XSS or network interception.
2. **CSRF validation must run on all state-changing routes** (POST, PUT, PATCH, DELETE) when cookie auth is used.
3. **Session must be rotated after any privilege elevation** (login → MFA complete, anonymous → authenticated). Keeping the same session ID before and after login is a session fixation vulnerability.
4. **CSRF tokens must be cryptographically random, at least 32 bytes.** Predictable CSRF tokens defeat the protection.
5. **`revokeSessionCookie` must always be paired with `sessions.revokeSession`.** Clearing the cookie without revoking the server-side session allows an attacker with a stolen cookie value to continue using it.
6. **Never store sensitive data directly in the cookie.** The cookie must only contain the session ID (opaque reference to the session store), not user data or permissions.

## Error Catalogue

| Error Code | HTTP Status | Trigger | Client Action |
|---|---|---|---|
| `SESSION_COOKIE_MISSING` | 401 | No session cookie on a protected route | Redirect to login |
| `SESSION_EXPIRED` | 401 | Session TTL passed | Redirect to login |
| `SESSION_REVOKED` | 401 | Session was invalidated | Redirect to login |
| `CSRF_VALIDATION_FAILED` | 403 | X-CSRF-Token header missing or mismatches cookie | Retry with correct CSRF token; refresh CSRF token |

## Integration Map

### Depends on

| Contract | Relationship | Notes |
|---|---|---|
| `sessions` | **Required** | Creates, validates, and revokes server-side session records |
| `auth` | **Required** | Issues the initial session after successful authentication |

### Used by

| Contract | How |
|---|---|
| `auth_middleware` | Reads session cookie as one of the credential extraction schemes |
| `http_middleware_pipeline` | CSRF validation middleware runs at position 9 (before handlers on mutating routes) |

### Related ADRs and Standards

- `ADR-011` — JWT vs opaque token
- `ADR-035` — Bearer vs cookie auth: when to use which

## Provider Guide

| Provider | Type | Notes |
|---|---|---|
| `express-session` | Managed | Standard Express session middleware; configure `store` with Redis for production |
| `iron-session` | Managed | Encrypted cookie sessions; no server-side store needed; good for edge |
| Custom signed cookie | Custom | HMAC-sign the session ID; verify on every request; minimal dependencies |

**iron-session trade-off:** No server-side session store means sessions cannot be revoked instantly. Suitable for short-lived sessions (< 1 hour) or when instant revocation is not required.

## Operational Behaviour

### Consistency model
**Model:** Strong for session validation (must read from session store on every request); eventual for cookie propagation (browser may have stale cookie until TTL expires after revocation).

### Failure Modes

| Scenario | Behaviour | Recovery |
|---|---|---|
| Session store unreachable | Fail closed: reject all authenticated requests with 503 | Restore session store |
| Cookie attribute misconfigured (missing HttpOnly) | Cookie accessible to XSS | Fix cookie options; rotate all sessions |
| CSRF not validated on mutation | Open to CSRF attacks | Add `validateCsrf` to all state-changing routes |
| Session not rotated after login | Session fixation vulnerability | Add `rotateSessionCookie` to auth success handler |
