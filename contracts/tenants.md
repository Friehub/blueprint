# Module Contract: `tenants`

**Version:** 0.1.0

---

### `tenants`
Multi-tenancy management for SaaS products.

**Functions**
```
createTenant(name, owner_id, plan_id?) → Tenant
getTenant(tenant_id) → Tenant
getTenantBySlug(slug) → Tenant?
updateTenant(tenant_id, data) → Tenant
suspendTenant(tenant_id, reason) → Tenant
reactivateTenant(tenant_id) → Tenant
deleteTenant(tenant_id) → void
getTenantMembers(tenant_id) → TenantMember[]
inviteMember(tenant_id, email, role) → TenantInvite
removeMember(tenant_id, user_id) → void
getTenantConfig(tenant_id) → TenantConfig
updateTenantConfig(tenant_id, config) → TenantConfig
```

**Types**
```
Tenant { id, name, slug, plan_id, status, owner_id, created_at }
TenantMember { user_id, tenant_id, role, joined_at }
TenantInvite { id, email, role, expires_at, accepted }
TenantConfig { settings: Record<string, unknown>, feature_flags, limits }
TenantStatus = active | suspended | deleted
```

---

---

## System-Level Integrations & Constraints

### Invariants
- `createTenant` with the same `slug` must return `TENANT_SLUG_CONFLICT` — slugs must be unique across all tenants
- `suspendTenant` on an already-suspended tenant must be a no-op
- `deleteTenant` must fail if the tenant has active members or active subscriptions — cascade deletion requires explicit force flag
- A tenant with status `deleted` must not accept any state-mutating operations except `getTenant` (for audit trails)
- `getTenantBySlug` must perform a case-insensitive slug lookup — slugs are normalised to lowercase on create
- The last `owner` of a tenant cannot be removed via `removeMember` — transfer ownership first

### Consistency Model
* **Model:** `strong`
* **Details:** Suspension must be immediately enforced; tenant config changes must be atomic

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for tenant lifecycle and membership events.
* **Details:** Duplicate tenant creation must be idempotent by slug or idempotency_key.

### Worker Scaling
* **Policy:** Tenant CRUD is low-volume; membership operations may scale with user count. Tenant-scoped queries must use the tenant_id index.

### Multi-Region Behavior
* **Mode:** Tenant data is global; write operations are directed to the primary region.
* **Details:** Read replicas in secondary regions must lag no more than 5 seconds for tenant lookups.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:** `createTenant`, `updateTenant`, `deleteTenant`, `inviteMember`

### Error Taxonomy
### Module-Specific Errors
```
createTenant:
    tenant_slug_conflict:      A tenant with this slug already exists | use a different slug

  updateTenant:
    tenant_suspended:          Cannot update a suspended tenant | reactivate first
    tenant_deleted:            Cannot update a deleted tenant

  deleteTenant:
    tenant_has_members:        Cannot delete a tenant with active members | remove members first
    tenant_has_subscriptions:  Cannot delete a tenant with active subscriptions | cancel subscriptions first

  inviteMember:
    member_already_exists:     User is already a member of this tenant | return existing membership
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createTenant      → tenant.created             { tenant_id, name, owner_id }
suspendTenant     → tenant.suspended           { tenant_id, reason }
reactivateTenant  → tenant.reactivated         { tenant_id }
deleteTenant      → tenant.deleted             { tenant_id }
inviteMember      → tenant.member.invited      { tenant_id, email, role }
removeMember      → tenant.member.removed      { tenant_id, user_id }
```

### Temporal Constraints
```
Tenant suspension retention:
    duration:         configurable, minimum 30 days before automatic purge
    on_expiry:        notify owner; if not reactivated, mark for deletion

  Invite expiry:
    duration:         7 days
    on_expiry:        mark invite as expired; allow resend

  Config update propagation:
    max_lag:          5 seconds
    on_exceed:        surface stale config warning
```

### Storage Model
* **Model:** Durable tenant and membership store.

```sql
CREATE TABLE tenants (
    id              UUID PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(255) NOT NULL UNIQUE,
    plan_id         VARCHAR(100),
    status          VARCHAR(50) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'deleted')),
    owner_id        UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_members (
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    user_id         UUID NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'member',
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);

CREATE TABLE tenant_invites (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    email           VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    accepted        BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tenant_config (
    tenant_id       UUID PRIMARY KEY REFERENCES tenants(id),
    settings        JSONB NOT NULL DEFAULT '{}',
    feature_flags   JSONB NOT NULL DEFAULT '{}',
    limits          JSONB NOT NULL DEFAULT '{}',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenant_members_user ON tenant_members(user_id);
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `tenants.<function>`.
* **Telemetry Metrics:**
```
blueprint_tenants_operation_total          counter { function, result: success|failure }
blueprint_tenants_operation_duration_ms    histogram { function, p50, p95, p99 }
blueprint_tenants_errors_total             counter { function, error_code }
blueprint_tenants_active_total             gauge { status }
blueprint_tenants_members_total            gauge
blueprint_tenants_invites_sent_total       counter
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return ProviderError, do not retry indefinitely |
| Slug conflict on create | Return tenant_slug_conflict; caller must choose different slug |
| Invite email delivery fails | Return success; queue notification for retry |
| Delete blocked by active members | Return tenant_has_members with member count |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** users, billing
* **Emits To:** events
* **Recommends:** notifications, audit_log, feature_flags
