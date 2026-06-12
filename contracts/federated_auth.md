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

### Error Taxonomy
### Module-Specific Errors
```
connectIdentity:
    authorization_invalid:        Provider-issued code verification failed | retry OAuth flow
    provider_account_linked:      Provider account already linked to another user | login with existing account
    provider_unavailable:         Provider identity endpoint unreachable | retry with backoff
    state_mismatch:               OAuth state parameter does not match | CSRF detected; abort

  disconnectIdentity:
    last_auth_method:             Cannot remove last authentication method | set password first
    identity_not_found:           No identity linked for this provider | check provider

  handleSamlAssertion:
    invalid_signature:            SAML response signature invalid | check provider certificate config
    assertion_expired:            SAML assertion has expired | retry authentication

  initiateOAuth:
    pkce_required:                Provider requires PKCE but code_verifier not generated | use PKCE flow

  refreshProviderToken:
    token_refresh_failed:         Provider rejected token refresh | force re-authentication
```

### Storage Model
* **Model:** Durable identity link store with provider configuration.
* **Details:** Identity links must be immediately consistent. Provider tokens may be cached but must be refreshable.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE federated_identities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  provider            TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  email               TEXT,
  name                TEXT,
  avatar              TEXT,
  connected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_account_id)
);

CREATE INDEX idx_fed_identities_user ON federated_identities(user_id);

CREATE TABLE federated_provider_configs (
  provider            TEXT PRIMARY KEY,
  provider_type       TEXT NOT NULL CHECK (provider_type IN ('oauth2', 'oidc', 'saml')),
  client_id           TEXT NOT NULL,
  issuer_url          TEXT NOT NULL,
  scopes              JSONB NOT NULL DEFAULT '[]',
  metadata_url        TEXT,
  certificate         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE federated_oauth_states (
  state               TEXT PRIMARY KEY,
  user_id             UUID,
  provider            TEXT NOT NULL,
  code_verifier       TEXT,
  redirect_uri        TEXT NOT NULL,
  expires_at          TIMESTAMPTZ NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_states_expires ON federated_oauth_states(expires_at)
  WHERE expires_at < now();

CREATE TABLE federated_tokens (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  provider            TEXT NOT NULL,
  access_token        TEXT NOT NULL,
  refresh_token       TEXT,
  id_token            TEXT,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| OAuth state nonce reuse | `state_mismatch` on callback | Reject; alert on repeated attempts (CSRF) |
| Provider certificate rotation | `invalid_signature` on SAML | Announce cert rotation window; support overlapping certs |
| Provider token refresh failure | `token_refresh_failed` error | Force re-authentication; notify user |
| Provider outage during login | `provider_unavailable` error | Show cached provider config; degrade to other providers |
| Duplicate provider account link | `provider_account_linked` error | Guide user to login with existing account |

**Breaking Changes:** Removing a supported provider type (oauth2/oidc/saml) is breaking for users with active identities on that provider. Provider config field changes must be backward-compatible. The OAuth state format change requires all in-flight flows to complete or expire first.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `federated_auth.<function>`.
* **Telemetry Metrics:**
```
gensense_federated_auth_identities_total        gauge { provider }
gensense_federated_auth_connections_total       { provider, result }
gensense_federated_auth_token_refresh_total     { provider, result }
gensense_federated_auth_saml_assertions_total   { provider, result }
gensense_federated_auth_oauth_state_expired_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** auth, sessions
* **Emits To:** events
* **Recommends:** audit_log, user profile
