name: websocket_auth
version: 1.0.0
tier: free
status: stable
domain: security
subdomain: authentication
part: I
tags:
  - websocket
  - ws-auth
  - upgrade
  - ticket
  - realtime-auth
  - ws-security
patterns:
  - ticket-exchange
  - post-connect-auth
  - cookie-upgrade
aliases:
  - WebSocket authentication
  - WS auth
  - socket authentication
  - upgrade authentication
depends_on:
  - auth_middleware
  - sessions
optional_depends_on:
  - rate_limiting
  - audit_log
emits_events:
  - ws_auth.connection.authenticated
  - ws_auth.connection.rejected
  - ws_auth.ticket.issued
  - ws_auth.ticket.consumed
consumes_events: []
providers:
  - Socket.IO (with auth handshake)
  - ws (npm, custom upgrade handler)
  - Ably
  - Pusher
---

# `websocket_auth`
[idempotency: not_idempotent] <!-- connection establishment has state -->

**Version:** 1.0.0 · **Tier:** Free · **Domain:** Security / Authentication

> Authentication for WebSocket connections — why the HTTP Authorization header does not work for WebSocket upgrades, and the three patterns that do.

## Search Surface

### In plain language
WebSocket connections start as HTTP upgrade requests. The browser's `WebSocket` constructor does not allow setting custom headers — you cannot send `Authorization: Bearer <token>` during the upgrade. This means the standard Bearer token pattern from `auth_middleware` does not apply to WebSocket connections. This contract describes the three approaches that do work (cookies, query-parameter tickets, and post-connect auth messages) and when to use each.

### Use this contract when
- You are adding authentication to WebSocket connections
- You need to reject unauthenticated WebSocket upgrade requests before the connection is established
- You need per-connection identity for routing messages or enforcing tenant isolation on a WebSocket server
- You are using Socket.IO, native WebSocket, or a managed real-time service and need to secure connections

### Do not use this contract when
- You need REST endpoint auth → use `auth_middleware`
- You need SSE stream auth → SSE uses HTTP GET; `auth_middleware` with cookies or Bearer tokens applies normally
- You need gRPC streaming auth → gRPC carries metadata on every call; use `grpc` interceptors

### Not to be confused with
- `auth_middleware` — HTTP Bearer token extraction; does not apply to WebSocket upgrades
- `sessions` — session lifecycle; WebSocket auth reads sessions but does not manage them
- `websocket_management` — WebSocket connection lifecycle (connect, disconnect, messaging); this contract is about the auth layer on top

### Also known as
WebSocket authentication, WS auth, socket authentication, upgrade authentication

## Why HTTP Headers Don't Work for WebSocket Auth

The browser's native `WebSocket` constructor:
```javascript
// This works for REST:
fetch('/api/data', { headers: { 'Authorization': 'Bearer ...' } })

// This does NOT work — no headers argument:
const ws = new WebSocket('wss://api.example.com/ws')

// This also does NOT work — custom headers are blocked:
const ws = new WebSocket('wss://api.example.com/ws', [], { headers: { ... } })
```

The WebSocket API only accepts the URL and an optional `protocols` list. Custom headers during upgrade are not possible in browser environments.

**Exception:** Server-side WebSocket clients (Node.js `ws`, Python `websockets`) CAN set custom headers. But you cannot assume all clients are server-side. Design for the browser constraint.

## The Three Patterns

### Pattern 1: Cookie (Recommended for browser apps)

**How it works:** Browser sends session cookie automatically during the WebSocket upgrade (same as any HTTP request). Server reads the cookie in the upgrade handler and validates the session.

**When to use:** Your WebSocket server is on the same domain (or a subdomain with a shared cookie domain) as the browser app.

**Requirements:**
- Session cookie must be set with appropriate `SameSite` and `Secure` attributes (see `cookie_session`)
- If the WebSocket endpoint is on a different domain, the cookie will not be sent

```
Browser            WS Server
  │──── GET /ws ───────►│  (Cookie: session=<id> sent automatically)
  │     [Upgrade]        │  Server reads cookie → validates session → allows/denies
  │◄── 101 Switching ───│
```

### Pattern 2: Short-Lived Ticket (Recommended for cross-domain or Bearer-token apps)

**How it works:** Before connecting the WebSocket, the client makes a standard authenticated REST request to get a single-use, short-lived "ticket" (a random token). The ticket is passed as a query parameter in the WebSocket URL. The server redeems the ticket on upgrade and associates the connection with the identity.

**When to use:** Your WebSocket server is on a different domain, or your app uses Bearer tokens (not cookies) for regular API auth.

```
Browser                REST API               WS Server
  │── POST /ws/ticket ──►│                      │
  │   [Authorization: Bearer <token>]           │
  │◄── { ticket: "abc123", ttl: 30s } ─────────│
  │                       │                     │
  │── GET /ws?ticket=abc123 ───────────────────►│
  │                                             │  Server looks up ticket → gets identity
  │                                             │  Marks ticket as consumed
  │◄─────────── 101 Switching ─────────────────│
```

**Ticket properties:**
- Single-use (consumed on first redemption; second use returns 403)
- Short TTL: 30–60 seconds maximum (prevents replay after a reasonable connection attempt)
- Stored in Redis or a fast key-value store
- Contains the authenticated user ID and scope; NOT a JWT (no self-validation needed)

### Pattern 3: Post-Connect Auth Message (For environments where 1 and 2 aren't possible)

**How it works:** The WebSocket connection is established without authentication. The server sets a strict deadline (e.g. 5 seconds). The client must send an auth message within that window. If no valid auth message arrives, the server closes the connection.

**When to use:** Last resort. Use only if cookie-based and ticket-based approaches are not feasible.

**Risk:** A brief window exists where the connection is open but unauthenticated. Any server-push messages sent before auth is confirmed could leak to an anonymous connection. **Never broadcast sensitive data before auth is confirmed.**

```
Browser            WS Server
  │── WS Upgrade ───────►│  (No credentials)
  │◄── 101 (open) ───────│  Server starts 5s timer
  │── { type: 'auth', token: 'Bearer ...' } ──►│
  │                       │  Validates token; attaches identity
  │◄── { type: 'auth_ok' } ───────────────────│
  │                       │  5s timer cancelled
```

## Contract

### Functions

#### `issueTicket(identity, options?) → Ticket`
Creates a short-lived, single-use ticket for the given identity. Stores the ticket in the fast store with a TTL.

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `identity` | Identity | Yes | Resolved identity from `auth_middleware` |
| `options.ttl` | number | No | Ticket TTL in seconds. Default: 30 |
| `options.scopes` | string[] | No | Scopes to bind to the ticket |

---

#### `redeemTicket(ticket_token) → Identity`
Validates and atomically consumes the ticket. Returns the associated identity. Throws if ticket is expired, not found, or already consumed.

---

#### `authenticateUpgrade(request) → Identity`
Runs on the WebSocket upgrade request (before the connection is established). Checks for a valid cookie (Pattern 1) or a valid ticket query parameter (Pattern 2). Rejects the upgrade with HTTP 401 if neither is present or valid.

---

#### `waitForAuthMessage(connection, deadline_ms) → Identity`
Post-connect pattern: waits for an auth message from the client within `deadline_ms` milliseconds. Closes the connection with code 4001 (custom Unauthorized) if no valid auth message arrives within the deadline.

---

#### `closeUnauthorized(connection, reason) → void`
Closes a WebSocket connection with a standardized unauthorized close code and reason.

### Types

```typescript
type Ticket = {
  token: string            // Cryptographically random, 32+ bytes, base64url-encoded
  identity_id: string
  scopes: string[]
  expires_at: Timestamp
  consumed: boolean
}

type WsAuthConfig = {
  pattern: 'cookie' | 'ticket' | 'post_connect'
  ticket_ttl?: number               // Seconds; default 30
  post_connect_deadline_ms?: number // Milliseconds; default 5000
  cookie_name?: string              // Default: 'session'
}

type WsIdentity = Identity & {
  connection_id: string             // Unique per WS connection
  authenticated_at: Timestamp
  pattern_used: WsAuthConfig['pattern']
}

type WsCloseCode =
  | 4000  // Generic auth failure
  | 4001  // Unauthorized (no credentials)
  | 4002  // Token expired
  | 4003  // Ticket already consumed
  | 4004  // Auth deadline exceeded (post-connect)
```

## Invariants

1. **Tickets must be single-use.** Consuming a ticket must be atomic (compare-and-swap in Redis). A ticket consumed twice returns 403 on the second use.
2. **Ticket TTL must not exceed 60 seconds.** Longer TTLs make stolen tickets replayable.
3. **`authenticateUpgrade` must run before the upgrade is accepted.** A WebSocket connection that exists before auth has run is a security gap.
4. **Post-connect auth must close unauthenticated connections within the deadline.** The connection must not remain open past the deadline under any circumstances.
5. **WebSocket close codes for auth failures must use the 4000–4999 range.** The 1000–3999 range is reserved by the WebSocket spec.
6. **Rate limit WebSocket upgrade attempts per IP** the same way you rate limit login attempts. Upgrade requests are cheap to make but expensive to validate.

## Error Catalogue

| Error Code | WS Close Code | Cause | Client Action |
|---|---|---|---|
| `WS_UNAUTHORIZED` | 4001 | No credentials on upgrade | Obtain ticket or check cookie; reconnect |
| `WS_TICKET_EXPIRED` | 4002 | Ticket TTL passed | Request a new ticket; reconnect |
| `WS_TICKET_CONSUMED` | 4003 | Ticket already used | Request a new ticket; reconnect |
| `WS_AUTH_DEADLINE` | 4004 | Auth message not received in time | Reconnect; send auth immediately after open |
| `WS_SESSION_REVOKED` | 4002 | Session was invalidated while connected | Re-authenticate; reconnect |

## Integration Map

### Depends on

| Contract | Relationship | Notes |
|---|---|---|
| `auth_middleware` | **Required** | Validates Bearer tokens for ticket issuance endpoint |
| `sessions` | **Required** | Validates session cookies during upgrade (Pattern 1) |
| `caching` | **Required for Pattern 2** | Stores and atomically redeems tickets (Redis) |

### Used by

| Contract | How |
|---|---|
| `websocket_management` | Calls `authenticateUpgrade` before accepting connections |
| `live_updates` | Uses authenticated WS connections for push |
| `presence` | Reads WS identity to track per-user connection state |
| `messaging` | Routes messages to connections by authenticated user ID |
| `trpc` (subscriptions) | Uses the ticket pattern for authenticated tRPC subscriptions over WS |

### Related ADRs and Standards

- `ADR-011` — JWT vs opaque token (tickets are opaque)
- `ADR-035` — Bearer vs cookie auth (cookie is Pattern 1)

## Operational Behaviour

### Consistency model
**Model:** Strong for ticket redemption (atomic consume); eventual for session revocation while connected (connected sessions may stay alive until the next heartbeat or message).

### Failure Modes

| Scenario | Behaviour | Recovery |
|---|---|---|
| Ticket store (Redis) unreachable | Return 503 on ticket issuance; close upgrade with 4001 | Restore Redis; clients re-attempt ticket issuance |
| User session revoked while WS connected | Server detects on next message send; closes with 4002 | Client receives close event; re-authenticates |
| Post-connect auth message delayed > deadline | Server closes connection | Client reconnects; sends auth message immediately |
| Same ticket used concurrently (race) | Atomic CAS ensures only first succeeds; second gets 4003 | Client requests new ticket |
