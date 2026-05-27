# Module Contract: `tenants`

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

### Consistency Model
* **Model:** `strong`
* **Details:** Suspension must be immediately enforced

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createTenant      → tenant.created             { tenant_id, name, owner_id }
  suspendTenant     → tenant.suspended           { tenant_id, reason }
  reactivateTenant  → tenant.reactivated         { tenant_id }
  inviteMember      → tenant.member.invited      { tenant_id, email, role }
  removeMember      → tenant.member.removed      { tenant_id, user_id }
```

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `tenants.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users, billing
* **Emits To:** events
* **Recommends:** notifications, audit_log, feature_flags
