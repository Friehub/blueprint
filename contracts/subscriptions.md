# Module Contract: `subscriptions`

**Version:** 0.2.1

---

### `subscriptions` (Media, SaaS, Content)
Access entitlement and content gating separate from billing.

**Functions**
```
getEntitlements(user_id) → Entitlement[]
hasAccess(user_id, resource_id) → boolean
grantEntitlement(user_id, entitlement_type, expires_at?) → Entitlement
revokeEntitlement(user_id, entitlement_type) → void
getAccessHistory(user_id, resource_id) → AccessEvent[]
```

**Types**
```
Entitlement { user_id, type, granted_at, expires_at?, source: plan|gift|trial|purchase }
AccessEvent { user_id, resource_id, granted, reason, timestamp }
```

---

---

## System-Level Integrations & Constraints

### Invariants
- `grantEntitlement` with the same `(user_id, entitlement_type)` must be idempotent — duplicate calls must return the existing entitlement and not extend expiry
- `hasAccess` must return `false` for an entitlement that has passed its `expires_at` even if the entitlement record still exists
- `revokeEntitlement` must immediately void access — a subsequent `hasAccess` call must return `false`
- An entitlement with `source: trial` must have a non-null `expires_at` — unlimited trials are not permitted
- `getEntitlements` must never return expired entitlements unless explicitly requested with an `include_expired` option

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Entitlement state must be immediately consistent for access checks; billing sync can be eventual

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for entitlement lifecycle events.
* **Details:** Duplicate grant/revoke retries must not duplicate entitlement state.

### Worker Scaling
* **Policy:** Entitlement writes and access checks must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether entitlement state is single-region or active/passive.
* **Details:** Cross-region entitlement conflicts must converge deterministically using last-write-wins on timestamp.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:** `grantEntitlement`, `revokeEntitlement`

### Backpressure
* If entitlement sync is saturated, grant/revoke operations must be deferred or rejected predictably rather than serving stale access indefinitely.

### Error Taxonomy
### Module-Specific Errors
```
grantEntitlement:
    entitlement_already_active:    User already has this entitlement | return existing
    entitlement_not_available:     Entitlement type is not available on current plan | upgrade plan

  hasAccess:
    resource_not_found:            Resource ID does not exist | return false

  revokeEntitlement:
    entitlement_not_found:         User does not have this entitlement | no-op
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
grantEntitlement → subscription.entitlement.granted    { user_id, entitlement_type, expires_at }
revokeEntitlement → subscription.entitlement.revoked   { user_id, entitlement_type }
hasAccess        → subscription.access.checked         { user_id, resource_id, result: granted|denied }
```

### Temporal Constraints
```
Entitlement retention:
    retention:         configurable per policy, minimum 30 days after expiry
    on_expiry:         revoke or downgrade access according to policy; retain audit record

  Expiry check interval:
    cadence:           every 1 hour for expired entitlements
    on_expiry:         emit entitlement.expired event, revoke access
```

### Storage Model
* **Model:** Durable entitlement store.
* **Details:** Access history must remain queryable for the configured retention window.

```sql
CREATE TABLE entitlements (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL,
    type            VARCHAR(100) NOT NULL,
    source          VARCHAR(50) NOT NULL CHECK (source IN ('plan', 'gift', 'trial', 'purchase')),
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at      TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    idempotency_key VARCHAR(255) UNIQUE,
    UNIQUE(user_id, type)
);

CREATE TABLE access_history (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL,
    resource_id     VARCHAR(255) NOT NULL,
    granted         BOOLEAN NOT NULL,
    reason          VARCHAR(255),
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entitlements_user ON entitlements(user_id);
CREATE INDEX idx_access_history_user ON access_history(user_id, resource_id);
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `subscriptions.<function>`.
* **Telemetry Metrics:**
```
blueprint_subscriptions_operation_total           counter { function, result: success|failure }
blueprint_subscriptions_operation_duration_ms     histogram { function, p50, p95, p99 }
blueprint_subscriptions_errors_total              counter { function, error_code }
blueprint_subscriptions_entitlements_active       gauge { type }
blueprint_subscriptions_access_checks_total       counter { result: granted|denied }
blueprint_subscriptions_expirations_total         counter { type }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Billing sync unavailable | Grant entitlement locally; queue billing sync for retry |
| Database unreachable for access check | Return false (deny by default); log error |
| Duplicate grant with same idempotency_key | Return existing entitlement without side effects |
| Expired entitlement not yet cleaned up | `hasAccess` returns false based on `expires_at` check; cleanup is eventual |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** billing
* **Emits To:** events
* **Recommends:** feature_flags (for entitlement-gated features)
