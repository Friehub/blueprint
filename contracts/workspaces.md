# Module Contract: `workspaces`

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

### Consistency Model
* **Model:** `strong`
* **Details:** Workspace permission additions/removals must propagate immediately to prevent unauthorized operations.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createWorkspace(name, owner_id, idempotency_key?)`

### Error Taxonomy
### Module-Specific Errors
```
addWorkspaceMember:
    user_already_member:       The target user is already registered in this workspace | return existing membership
    max_members_exceeded:      The workspace has reached its plan's member quota | return 402 Payment Required
    user_not_found:            The user ID does not exist | return 404
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createWorkspace     → workspace.created      { workspace_id, owner_id }
addWorkspaceMember  → workspace.member.added  { workspace_id, user_id, role }
removeWorkspaceMember → workspace.member.removed { workspace_id, user_id }
```

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `workspaces.<function>`.
* **Telemetry Metrics:**
```
gensense_workspaces_active_total            gauge
gensense_workspaces_members_count           gauge { workspace_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications, audit_log, billing (to enforce member limit quotas)
