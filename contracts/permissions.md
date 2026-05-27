# Module Contract: `permissions`

---

### `permissions`
Fine-grained access control.

**Functions**
```
can(user_id, action, resource) → boolean
canAll(user_id, actions, resource) → boolean
canAny(user_id, actions, resource) → boolean
grantPermission(user_id, action, resource) → void
revokePermission(user_id, action, resource) → void
getPermissions(user_id) → Permission[]
createRole(name, permissions) → Role
assignRole(user_id, role_id) → void
```

**Types**
```
Permission { action, resource, conditions? }
Role { id, name, permissions }
AccessDecision = allowed | denied
```

**Invariants**
- `can` must be deterministic for the same inputs at the same instant
- Role inheritance must be acyclic

**Providers:** Casbin, custom RBAC, AWS IAM, OPA

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** `can()` must reflect the latest grant/revoke

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for permission-change events.
* **Details:** Duplicate grant/revoke retries must not create duplicate permissions.

### Worker Scaling
* **Policy:** Permission evaluation and role mutation workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether permission state is single-region or active/passive.
* **Details:** Concurrent cross-region updates must converge deterministically.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If permission sync is saturated, updates must be deferred or rejected predictably rather than serving stale authorization state indefinitely.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Permission cache:
    max_age:           configurable per deployment
    on_expiry:         refresh from source of truth
```

### Storage Model
* **Model:** Durable role/permission store with optional evaluation cache.
* **Details:** Authorization checks must be consistent with the source of truth; cached decisions must expire promptly.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `permissions.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** audit_log, caching (for permission evaluation caching)
