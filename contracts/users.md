# Module Contract: `users`

**Version:** 0.2.0

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
- `deleteUser` must not physically delete -- it must mark the record as deleted and anonymise PII
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

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  avatar_url  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending_verification'
                CHECK (status IN ('active', 'banned', 'suspended', 'pending_verification')),
  metadata    JSONB DEFAULT '{}',
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_email ON users(LOWER(email)) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status) WHERE deleted_at IS NULL;

CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES users(id),
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_user ON user_roles(user_id);
```

### Storage Model
* **Model:** Durable user profile store.
* **Details:** User identity, role, and moderation state must be strongly consistent; deleted records must remain anonymizable for compliance.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `users.<function>`.
* **Telemetry Metrics:**
```
blueprint_users_operation_total           counter { function, result: success|failure }
blueprint_users_operation_duration_ms     histogram { function, p50, p95, p99 }
blueprint_users_errors_total              counter { function, error_code }
blueprint_users_registrations_total       counter { status: success|duplicate|pending_verification }
blueprint_users_deletions_total           counter { reason }
blueprint_users_active_total              gauge
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Email uniqueness conflict | Return validation_error with duplicate email info |
| Soft-delete race condition | Return not_found if record was already deleted; idempotent |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** (none -- owns its own data)
* **Emits To:** events
* **Recommends:** audit_log, notifications, permissions
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on `searchUsers`.
