# Module Contract: `workspaces`

**Version:** 0.2.0

---

### `workspaces`
Multi-member workspace structures, collaborative resource partitioning, and organization scopes.

**Functions**
```
createWorkspace(name, owner_id) → Workspace
addWorkspaceMember(workspace_id, user_id, role) → WorkspaceMember
removeWorkspaceMember(workspace_id, user_id) → void
getWorkspaceResources(workspace_id) → WorkspaceResources
```

**Types**
```
Workspace { id, name, status, owner_id, created_at }
WorkspaceMember { workspace_id, user_id, role, joined_at }
WorkspaceResources { workspace_id, member_count, doc_count, storage_bytes_used }

WorkspaceStatus = active | suspended | archived
WorkspaceRole = owner | admin | editor | viewer
```

**Invariants**
- **Owner Minimum Requirement**: Every workspace must have at least one user with the `owner` role at all times. The last owner cannot be removed or downgraded unless the workspace is explicitly archived.
- **Access Partitioning**: Members cannot see or access resources (documents, uploads, metrics) associated with workspaces they do not belong to.
- **Idempotency**: Adding a member who is already a member with the same role must be a no-op (idempotent).

**Providers:** custom SQL schemas, Notion-like workspace structures, Slack-like organizations

---

## System-Level Integrations & Constraints

### Invariants
- `createWorkspace` with the same `name` and `owner_id` must be idempotent via idempotency_key — same name with different idempotency_key creates a new workspace
- The last `owner` of a workspace cannot be removed or downgraded unless the workspace is archived
- A workspace with status `archived` must not accept new members or resource modifications — viewing the workspace is permitted for members
- `addWorkspaceMember` on an existing `(workspace_id, user_id)` pair with the same role must be a no-op — idempotent
- A user must not be able to access resources belonging to a workspace they are not a member of — enforced at the query layer

### Consistency Model
* **Model:** `strong`
* **Details:** Workspace permission additions/removals must propagate immediately to prevent unauthorized operations.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for workspace lifecycle and membership events.
* **Details:** Duplicate workspace creation must be idempotent by idempotency_key.

### Worker Scaling
* **Policy:** Workspace CRUD is low-volume; membership lookups scale with workspace size.

### Multi-Region Behavior
* **Mode:** Workspace data is global; writes are directed to the primary region.
* **Details:** Read replicas must propagate membership changes within 5 seconds to prevent stale permission checks.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createWorkspace(name, owner_id, idempotency_key?)`
  - `addWorkspaceMember(workspace_id, user_id, role, idempotency_key?)`

### Error Taxonomy
### Module-Specific Errors
```
createWorkspace:
    workspace_name_conflict:   A workspace with this name already exists for this owner | use a different name

addWorkspaceMember:
    user_already_member:       The target user is already registered in this workspace | return existing membership
    max_members_exceeded:      The workspace has reached its plan's member quota | return 402 Payment Required
    user_not_found:            The user ID does not exist | return 404

removeWorkspaceMember:
    last_owner_cannot_be_removed:  The last owner cannot be removed | transfer ownership first
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createWorkspace         → workspace.created      { workspace_id, owner_id }
addWorkspaceMember      → workspace.member.added  { workspace_id, user_id, role }
removeWorkspaceMember   → workspace.member.removed { workspace_id, user_id }
updateWorkspace         → workspace.updated       { workspace_id, changes }
archiveWorkspace        → workspace.archived      { workspace_id }
```

### Temporal Constraints
```
Workspace archival retention:
    duration:         configurable, minimum 30 days before hard delete
    on_expiry:        notify owner; if not restored, permanently delete

  Membership inactivity:
    duration:         configurable, default 90 days
    on_expiry:        flag for review; may result in removal
```

### Storage Model
* **Model:** Durable workspace and membership store.

```sql
CREATE TABLE workspaces (
    id              UUID PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    owner_id        UUID NOT NULL,
    status          VARCHAR(50) NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'suspended', 'archived')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(name, owner_id)
);

CREATE TABLE workspace_members (
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    user_id         UUID NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE workspace_resources (
    workspace_id    UUID NOT NULL REFERENCES workspaces(id),
    resource_type   VARCHAR(100) NOT NULL,
    resource_id     UUID NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (workspace_id, resource_type, resource_id)
);

CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `workspaces.<function>`.
* **Telemetry Metrics:**
```
blueprint_workspaces_operation_total          counter { function, result: success|failure }
blueprint_workspaces_operation_duration_ms    histogram { function, p50, p95, p99 }
blueprint_workspaces_errors_total             counter { function, error_code }
blueprint_workspaces_active_total             gauge { status }
blueprint_workspaces_members_count            gauge { workspace_id }
blueprint_workspaces_created_total            counter
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return ProviderError, do not retry indefinitely |
| Name conflict on create | Return workspace_name_conflict; caller must choose different name |
| Last owner removal attempt | Return last_owner_cannot_be_removed; transfer ownership first |
| Max members exceeded | Return max_members_exceeded with 402 Payment Required |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications, audit_log, billing (to enforce member limit quotas)
