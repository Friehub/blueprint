# Module Contract: `permissions`

**Version:** 1.0.0

---

### `permissions`
Fine-grained access control with RBAC and ABAC support.

**Functions**
```
can(user_id, action, resource, context?) → boolean
canAll(user_id, actions, resource, context?) → boolean
canAny(user_id, actions, resource, context?) → boolean
batchCheckPermission(user_id, checks[], context?) → boolean[]
grantPermission(user_id, action, resource) → void
revokePermission(user_id, action, resource) → void
denyPermission(user_id, action, resource, reason?) → void
revokeDeny(user_id, action, resource) → void
getPermissions(user_id) → Permission[]
createRole(name, permissions) → Role
assignRole(user_id, role_id) → void
```

**Types**
```
Permission { action, resource, conditions?, effect: allow | deny }
Role { id, name, permissions, inherits?: RoleId[] }
AccessDecision = allowed | denied
ExplicitDeny { user_id, action, resource, reason?, created_at }
PermissionCheck { action, resource }
```

**Invariants**
- `can` must be deterministic for the same inputs at the same instant
- Role inheritance must be acyclic and transitive: if Role A inherits from B, and B inherits from C, then users of A inherit permissions from C
- An explicit deny for the requesting identity always overrides any role-level grant -- deny wins over allow when both are present for the same identity, action, and resource combination
- `denyPermission` must take effect immediately and must not require cache invalidation or propagation delay
- ABAC `context` evaluation: if a `Permission` has `conditions`, the `context` parameter must be evaluated against those conditions at runtime. Conditions use attribute-based matching (e.g. `resource.owner_id == context.user_id`, `resource.region in context.allowed_regions`). If conditions are present and `context` is omitted, the permission is denied.
- Permission actions support glob matching: `*` matches all actions within a resource, `resource:*` matches all actions on that resource. Globs must be expanded at evaluation time, not at storage time.
- `batchCheckPermission` must return results in the same order as the input checks array. A single failed check must not short-circuit the remaining checks.

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
```
grantPermission      → permission.granted              { user_id, action, resource, granted_by }
revokePermission     → permission.revoked               { user_id, action, resource, revoked_by }
denyPermission       → permission.denied                { user_id, action, resource, reason }
revokeDeny           → permission.deny_revoked           { user_id, action, resource }
createRole           → role.created                     { role_id, name, permissions }
assignRole           → role.assigned                    { user_id, role_id, assigned_by }
```

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
* **Telemetry Metrics:**
```
blueprint_permissions_operation_total       counter { function, result: success|failure }
blueprint_permissions_operation_duration_ms histogram { function, p50, p95, p99 }
blueprint_permissions_errors_total          counter { function, error_code }
blueprint_permissions_grants_total          counter { action }
blueprint_permissions_revocations_total     counter { action }
blueprint_permissions_evaluations_total     counter { result: allowed|denied }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** audit_log, caching (for permission evaluation caching)
