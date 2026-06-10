# Module Contract: `zero_trust_network_policy`

**Version:** 0.1.0

---

### `zero_trust_network_policy`
Service-to-service authentication with identity registration, certificate/mTLS management, and trust policy enforcement.

**Functions**
```
registerServiceIdentity(service_name, public_key, metadata?) → ServiceIdentity
getServiceIdentity(service_name) → ServiceIdentity?
verifyServiceIdentity(caller_identity, target_service) → IdentityVerification
rotateIdentity(service_name) → RotationResult
listTrustedServices() → TrustedService[]
setTrustPolicy(source_service, target_service, policy) → void
getTrustPolicy(source_service, target_service) → TrustPolicy?
revokeIdentity(identity_id, reason) → void
```

**Types**
```
ServiceIdentity { id, service_name, public_key, method: mtls|jwt|token, status: active|rotating|revoked, expires_at, created_at }
IdentityVerification { verified: bool, caller_service, target_service, method, verified_at }
RotationResult { identity_id, new_public_key, old_valid_until, rotated_at }
TrustedService { name, allowed_targets: string[], methods: string[] }
TrustPolicy { source, target, allowed_methods, require_mtls: bool, rate_limit?, audit: bool }
TrustPolicyRule { effect: allow|deny, source, target, conditions, priority }
```

**Invariants**
- Every inter-service call must present a verifiable identity -- unauthenticated calls between services must be rejected at the network layer
- `verifyServiceIdentity` must check that the caller's identity is not expired or revoked before returning a positive verification
- A service must not be able to call another service unless a `TrustPolicy` explicitly allows it -- implicit trust between any two services in the same deployment is a contract violation
- Identity rotation must provide a grace period during which both the old and new credentials are accepted to prevent rotation-related outages
- All identity verification decisions must be logged to `audit_log` regardless of whether the verification passed or failed

**Providers:** SPIFFE/SPIRE, Istio mTLS, Consul Connect, Linkerd, custom

**Dependencies:** service_mesh

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Identity and trust policy state must be immediately consistent to prevent unauthorized access

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for identity lifecycle events.
* **Details:** Duplicate identity registration must be idempotent (update existing, not create duplicate).

### Worker Scaling
* **Policy:** Identity verification must be per-request with sub-millisecond overhead.

### Multi-Region Behavior
* **Mode:** Trust policies are global; identity verification is performed locally.
* **Details:** Identity revocation must propagate to all regions within the maximum cache TTL.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Identity verification must complete within request budget; if the identity store is unreachable, the module must deny by default rather than allow by default.

### Error Taxonomy
### Module-Specific Errors
```
verifyServiceIdentity:
    identity_expired:        Caller identity has expired | renew identity
    identity_revoked:        Caller identity has been revoked | contact security team
    no_trust_policy:         No trust policy exists between these services | configure trust policy first
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
registerServiceIdentity → zero_trust.identity.registered { service_name, method }
  verifyServiceIdentity   → zero_trust.verification.passed  { caller, target, method }
                         OR zero_trust.verification.failed  { caller, target, reason }
  rotateIdentity          → zero_trust.identity.rotated     { service_name, old_valid_until }
  revokeIdentity          → zero_trust.identity.revoked     { service_name, reason }
```

### Temporal Constraints
```
Identity certificate expiry:
    default:        24 hours (short-lived, automatic rotation)
    max:            7 days
    on_expiry:      identity is invalid; service must re-register

  Grace period on rotation:
    duration:       5 minutes
    on_expiry:      old identity revoked

  Local cache TTL:
    default:        60 seconds
    on_expiry:      refresh from identity store
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `zero_trust_network_policy.<function>`.
* **Telemetry Metrics:**
```
gensense_zero_trust_identities_active              gauge { service }
  gensense_zero_trust_verifications_total            { result }
  gensense_zero_trust_verification_latency_ms         histogram
  gensense_zero_trust_identities_rotated_total        { service }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** service_mesh
* **Emits To:** events
* **Recommends:** audit_log, telemetry, secrets
