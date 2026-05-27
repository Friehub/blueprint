# Module Contract: `users`

---

### `users`
User identity and profile management.

**Functions**
```
getUser(user_id) → User
getUserByEmail(email) → User?
createUser(data) → User
updateUser(user_id, data) → User
deleteUser(user_id) → void
searchUsers(query, options?) → PaginatedResult<User>
getUsersByRole(role) → User[]
assignRole(user_id, role) → void
revokeRole(user_id, role) → void
getUserRoles(user_id) → Role[]
banUser(user_id, reason) → void
unbanUser(user_id) → void
```

**Types**
```
User { id, email, name, avatar_url?, roles, status, created_at, metadata }
Role { id, name, permissions }
UserStatus = active | banned | suspended | pending_verification
```

**Invariants**
- `deleteUser` must not physically delete — it must mark the record as deleted and anonymise PII
- `getUserByEmail` must be case-insensitive

**Providers:** any user table, Clerk, Auth0 Management API

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Permission changes must be visible before the response returns

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for user lifecycle events.
* **Details:** Duplicate updates must not create duplicate user records.

### Worker Scaling
* **Policy:** Search, profile update, and user moderation workloads must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether user writes are single-region or active/passive.
* **Details:** Cross-region write conflicts must be resolved deterministically.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If user write or moderation capacity is saturated, the module must defer or reject predictably rather than corrupting profile state.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createUser        → user.created               { user_id, email }
  updateUser        → user.updated               { user_id, changed_fields }
  deleteUser        → user.deleted               { user_id }
  banUser           → user.banned                { user_id, reason, banned_by }
  unbanUser         → user.unbanned              { user_id, unbanned_by }
  assignRole        → user.role.assigned         { user_id, role }
  revokeRole        → user.role.revoked          { user_id, role }
```

### Temporal Constraints
```
User soft-delete retention:
    retention:         configurable per compliance policy
    on_expiry:         anonymize or purge according to policy
```

### Storage Model
* **Model:** Durable user profile store.
* **Details:** User identity, role, and moderation state must be strongly consistent; deleted records must remain anonymizable for compliance.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `users.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — owns its own data)
* **Emits To:** events
* **Recommends:** audit_log, notifications, permissions
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `searchUsers`.
