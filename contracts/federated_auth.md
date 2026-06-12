# Module Contract: `federated_auth`

**Version:** 0.1.0

---

### `federated_auth`
Federated identity management with OAuth 2.0, OpenID Connect, and SAML provider integration.

**Functions**
```
connectIdentity(user_id, provider, code) → ConnectedIdentity
disconnectIdentity(user_id, provider) → void
getConnectedIdentities(user_id) → ConnectedIdentity[]
getIdentity(provider, provider_account_id) → UserMapping?
getProviderConfig(provider) → ProviderConfig
listConfiguredProviders() → ProviderConfig[]
handleSamlAssertion(provider, saml_response) → Session
initiateOAuth(provider, redirect_uri) → AuthorizationUrl
refreshProviderToken(user_id, provider) → void
```

**Types**
```
ConnectedIdentity { user_id, provider, provider_account_id, email?, name?, avatar?, connected_at }
UserMapping { internal_user_id, provider, provider_account_id }
AuthorizationUrl { url, state, code_verifier? }
ProviderConfig { provider, type: oauth2|oidc|saml, client_id, issuer_url, scopes[], metadata_url? }
ProviderType = oauth2 | oidc | saml
TokenExchangeResult { access_token, refresh_token?, id_token?, expires_in }
```

**Invariants**
- `connectIdentity` must verify the provider-issued authorization code before creating the identity link -- accepting an unverified code is a security violation
- A user must not be able to connect the same provider account to more than one internal user -- duplicate provider account links must be rejected
- `disconnectIdentity` must not remove the last authentication method if the user has no password set -- at least one sign-in method must remain
- `handleSamlAssertion` must validate the SAML response signature against the configured provider's certificate -- unsigned assertions must be rejected
- `initiateOAuth` must generate a cryptographically random `state` parameter and store it for CSRF verification during the callback
- When PKCE is supported by the provider, `initiateOAuth` must generate a `code_verifier` and use `S256` challenge method -- the verifier must not be logged or transmitted to the provider

**Providers:** Auth0, Okta, Keycloak, Azure AD, custom

**Dependencies:** auth, sessions

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Provider connections must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for OAuth flow lifecycle events.
* **Details:** Duplicate OAuth callback handling must be idempotent (state nonce used once).

### Worker Scaling
* **Policy:** OAuth callback handling and token refresh are low-volume; parallelizable by provider.

### Multi-Region Behavior
* **Mode:** Provider config is global; identity linking is per-user and must be globally consistent.
* **Details:** A user connecting an identity in one region must see it immediately in all regions.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Event Emission
```
connectIdentity        -> federated_auth.identity.connected    { user_id, provider }
  disconnectIdentity     -> federated_auth.identity.disconnected { user_id, provider }
  refreshProviderToken   -> federated_auth.token.refreshed      { user_id, provider }
```

### Temporal Constraints
```
Provider token refresh:
    default:        refresh when access token has < 5 minutes until expiry
    on_expiry:      force re-authentication via provider

  OAuth state nonce TTL:
    default:        10 minutes
    on_expiry:      reject callback with expired_nonce error
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `federated_auth.<function>`.

### Module Dependencies
* **Depends On:** auth, sessions
* **Emits To:** events
* **Recommends:** audit_log, user profile
