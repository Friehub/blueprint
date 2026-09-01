name: oauth2_server
version: 1.0.0
tier: free
status: stable
domain: security
subdomain: authentication
part: II
tags:
  - oauth2
  - authorization-server
  - pkce
  - authorization-code
  - token-endpoint
  - consent
  - scopes
  - openid-connect
patterns:
  - authorization-code-pkce
  - token-introspection
  - token-revocation
  - scope-delegation
aliases:
  - OAuth2 server
  - authorization server
  - OIDC provider
  - OAuth provider
  - identity provider
depends_on:
  - auth
  - sessions
  - api_keys
optional_depends_on:
  - rate_limiting
  - audit_log
  - machine_to_machine_auth
emits_events:
  - oauth2.authorization.granted
  - oauth2.authorization.denied
  - oauth2.token.issued
  - oauth2.token.revoked
  - oauth2.token.introspected
  - oauth2.client.registered
consumes_events: []
providers:
  - node-oidc-provider
  - Ory Hydra
  - Keycloak
  - custom
---

# `oauth2_server`
[idempotency: idempotency_key_required] <!-- token issuance has side effects -->

**Version:** 1.0.0 · **Tier:** Free · **Domain:** Security / Authentication

> OAuth 2.0 Authorization Server — the complete Authorization Code + PKCE flow for when your product IS the identity provider that other applications authenticate against.

## Search Surface

### In plain language
This contract is for when you ARE the OAuth2 server — when third-party developers register apps that use "Sign in with YourProduct". It covers the Authorization Code + PKCE flow: users are redirected to your consent screen, they approve the scopes, your server issues an authorization code, the client app exchanges it for access and refresh tokens, and those tokens are used to call your API. This is not the same as `federated_auth` (consuming external OAuth providers like Google) or `machine_to_machine_auth` (client credentials for services).

### Use this contract when
- Third-party developers need to build apps that authenticate users via your platform ("Login with YourApp")
- You are building a developer platform and need an OAuth2 authorization server
- You need to issue scoped access tokens to third-party integrations on behalf of your users
- You need a consent screen where users approve what data a third-party app can access

### Do not use this contract when
- You are consuming an external OAuth provider (Google, GitHub) → use `federated_auth`
- You need service-to-service auth with no user involved → use `machine_to_machine_auth`
- You need first-party authentication (your own app logging in your own users) → use `auth`
- You only need API keys for direct API access → use `api_keys`

### Not to be confused with
- `federated_auth` — you are the OAuth client consuming another server; oauth2_server means YOU are the server
- `machine_to_machine_auth` — Client Credentials flow; no user; no consent screen
- `auth` — first-party user authentication for your own app
- `api_keys` — direct long-lived API access, not OAuth-scoped delegation

### Also known as
OAuth2 server, authorization server, OIDC provider, OAuth provider, identity provider

## The Authorization Code + PKCE Flow

```
Third-party App         Browser (User)           Your OAuth Server
      │                       │                         │
      │── 1. Redirect to ─────►│                         │
      │   /authorize?          │── GET /authorize ──────►│
      │   client_id=...        │                         │  Validate client_id
      │   redirect_uri=...     │                         │  Show consent screen
      │   scope=...            │                         │
      │   code_challenge=...   │◄── Consent screen ──────│
      │   state=...            │                         │
      │                        │── User approves ───────►│
      │                        │                         │  Generate auth code
      │                        │◄── Redirect to ─────────│
      │◄────────────────────────  app.com/callback       │
      │   ?code=...&state=...  │                         │
      │                        │                         │
      │── 2. POST /token ──────────────────────────────►│
      │   code=...             │                         │  Validate code
      │   code_verifier=...    │                         │  Validate PKCE
      │   client_id=...        │                         │  Issue access + refresh tokens
      │◄─── { access_token, refresh_token } ────────────│
      │                        │                         │
      │── 3. API calls with access_token ──────────────►│
```

## Contract

### Functions

#### `registerClient(client_def) → OAuthClient`
Registers a third-party OAuth2 client. Returns the `client_id` and `client_secret` (shown once).

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `client_def.name` | string | Yes | Display name shown on consent screen |
| `client_def.redirect_uris` | string[] | Yes | Exact allowed redirect URIs; no wildcards |
| `client_def.allowed_scopes` | string[] | Yes | Scopes this client is permitted to request |
| `client_def.grant_types` | GrantType[] | Yes | e.g. `['authorization_code', 'refresh_token']` |
| `client_def.is_public` | boolean | No | Public clients (SPAs, native apps) use PKCE instead of client secret |

---

#### `initiateAuthorization(params) → AuthorizationRequest`
Validates an authorization request and returns a request object for rendering the consent screen.

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `params.client_id` | string | Yes | Must match a registered client |
| `params.redirect_uri` | string | Yes | Must exactly match one of the client's registered URIs |
| `params.scope` | string | Yes | Space-separated list; each scope must be in the client's allowed list |
| `params.state` | string | Yes | Client-generated random value; returned in redirect for CSRF protection |
| `params.code_challenge` | string | Yes (for public clients) | Base64url-encoded SHA-256 of the code_verifier |
| `params.code_challenge_method` | `'S256'` | Yes (if code_challenge set) | Only S256 is permitted; plain is rejected |

---

#### `grantAuthorization(request_id, user_id, approved_scopes) → string`
Called after the user approves the consent screen. Issues a short-lived authorization code and redirects to the client's `redirect_uri`.

**Returns:** The redirect URI with `?code=<code>&state=<state>` appended.

---

#### `exchangeCode(params) → TokenPair`
Exchanges an authorization code for access and refresh tokens. Validates PKCE if the client is public.

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `params.code` | string | Yes | One-time authorization code |
| `params.client_id` | string | Yes | — |
| `params.client_secret` | string | Confidential clients | Not required for public clients (PKCE instead) |
| `params.code_verifier` | string | Public clients | The original random string before SHA-256 hashing |
| `params.redirect_uri` | string | Yes | Must match what was used in `initiateAuthorization` |

---

#### `refreshToken(params) → TokenPair`
Exchanges a refresh token for a new access token. Rotates the refresh token on use.

---

#### `introspectToken(token, client_id) → IntrospectionResult`
Allows a resource server (your API) to check if a token is active and read its claims. Returns `{ active: false }` for invalid or expired tokens — never an error.

---

#### `revokeToken(token, client_id) → void`
Revokes an access or refresh token. If a refresh token is revoked, all access tokens issued from it are also revoked.

### Types

```typescript
type OAuthClient = {
  client_id: string
  client_secret?: string      // Only returned on creation; stored hashed
  name: string
  redirect_uris: string[]
  allowed_scopes: string[]
  grant_types: GrantType[]
  is_public: boolean
}

type GrantType = 'authorization_code' | 'refresh_token' | 'client_credentials'

type AuthorizationRequest = {
  request_id: string
  client: OAuthClient
  requested_scopes: string[]
  state: string
  expires_at: Timestamp        // Short-lived; user must consent within this time
}

type TokenPair = {
  access_token: string         // Short-lived JWT (15 min)
  refresh_token: string        // Opaque; long-lived (30 days)
  token_type: 'Bearer'
  expires_in: number           // Seconds
  scope: string                // Space-separated list of granted scopes
}

type IntrospectionResult = {
  active: boolean
  sub?: string                 // Subject (user_id) — only if active
  scope?: string               // Granted scopes — only if active
  client_id?: string
  exp?: number
  iat?: number
}
```

## Scope Design Guide

Scopes represent specific permissions a user can grant to a third-party app. Design them as resource:action pairs:

```
read:profile         Read the user's name, email, and avatar
write:profile        Update the user's profile
read:orders          List and read the user's orders
write:orders         Create orders on behalf of the user
read:billing         Read billing info and invoices
admin:users          Admin-level user management (should require explicit approval)
```

**Rules:**
- Never create a single `admin` scope that grants all permissions.
- Scopes must be additive, not hierarchical. `write:orders` does not imply `read:orders`.
- Display a human-readable description for every scope on the consent screen.
- Allow users to see and revoke active grants via a "Connected Apps" page.

## Invariants

1. **Authorization codes must be single-use and short-lived (max 10 minutes).** Reuse of a code must revoke all tokens issued from that code (replay attack response).
2. **PKCE is mandatory for public clients.** Reject authorization requests from public clients without a `code_challenge`.
3. **Only S256 code challenge method is permitted.** The `plain` method is trivially bypassable and must be rejected.
4. **Redirect URIs must be exact matches — no wildcards, no path prefix matching.** An attacker can register `evil.com?redirect=legit.com` as a redirect URI if wildcard matching is allowed.
5. **The `state` parameter must be validated by the client** to prevent CSRF. The server must return it unchanged in the redirect. The server must not enforce state uniqueness — the client is responsible for validating it.
6. **Access tokens must be short-lived (≤ 15 minutes).** Refresh tokens handle session continuity. Long-lived access tokens are not revocable within their TTL.
7. **Refresh token rotation must be enforced.** On every refresh, the old token is invalidated and a new one is issued.

## Integration Map

### Depends on

| Contract | Relationship | Notes |
|---|---|---|
| `auth` | **Required** | User must be authenticated before consent screen is shown |
| `sessions` | **Required** | User session is read to identify who is granting access |
| `api_keys` | **Related** | Both provide API access; oauth2_server is the delegated, user-consent model |

### Used by

| Contract | How |
|---|---|
| `auth_middleware` | Validates access tokens issued by this server on API requests |
| `machine_to_machine_auth` | Uses the same token format; serves different grant type (client credentials) |
| `developer_portal` | Allows developers to register OAuth clients and view active grants |

## Provider Guide

| Provider | Type | Notes |
|---|---|---|
| `node-oidc-provider` | Managed | Most complete Node.js OAuth2/OIDC server library; highly configurable |
| Ory Hydra | Managed | Dedicated OAuth2 server; decoupled from your user store; delegate consent to your app |
| Keycloak | Managed | Full identity platform; includes user management, SSO, and admin UI |
| Custom | Custom | Implement from spec; only if compliance requirements prevent using a library |

**Recommendation:** Use `node-oidc-provider` (Node.js) or Ory Hydra (any language). The OAuth2 spec has many edge cases. Do not implement from scratch unless your threat model requires it.

## Failure Modes

| Scenario | Behaviour | Recovery |
|---|---|---|
| Authorization code replayed | Revoke all tokens from that code; return `invalid_grant` | Force re-authorization |
| PKCE verifier mismatch | Reject token exchange with `invalid_grant` | Client restarts auth flow with new PKCE pair |
| Redirect URI not registered | Reject with `invalid_redirect_uri`; do not redirect (would open redirect vulnerability) | Client registers the URI; admin approves |
| Refresh token replayed (rotation family) | Revoke entire token family; user must re-authenticate | Alert; user signs in again |
| Consent screen expired | Return `consent_required`; restart authorization flow | Client redirects user again |
