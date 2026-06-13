# Module Contract: `projects`

**Version:** 0.2.0

---

### `projects`
Project planning, ownership, membership, and lifecycle tracking for work organized around a shared goal.

**Functions**
```
createProject(workspace_id, owner_id, name, description?, metadata?) → Project
getProject(project_id) → Project?
listProjects(workspace_id, options?) → PaginatedResult<Project>
updateProject(project_id, data) → Project
archiveProject(project_id) → Project
unarchiveProject(project_id) → Project
addProjectMember(project_id, user_id, role?) → ProjectMember
removeProjectMember(project_id, user_id) → void
changeProjectOwner(project_id, user_id) → Project
```

**Types**
```
Project { id, workspace_id, owner_id, name, description?, status, start_at?, end_at?, created_at, updated_at, metadata? }
ProjectMember { project_id, user_id, role, joined_at }
ProjectStatus = draft | active | paused | completed | archived
ProjectRole = owner | manager | contributor | viewer
```

**Invariants**
- A project must always have exactly one owner. `changeProjectOwner` must atomically transfer ownership; the old owner must not remain as owner
- Archived projects must not accept edits or membership changes until they are unarchived. `updateProject`, `addProjectMember`, `removeProjectMember` on an archived project must return `project_archived`
- Project names must be unique within the same workspace. Enforced via UNIQUE constraint on `(workspace_id, name)`
- `addProjectMember` must reject adding a user who is already a member of the project -- return `member_already_exists`
- `removeProjectMember` must not allow removing the sole owner of the project; transfer ownership first
- `listProjects` filtered by workspace must only return projects within that workspace

**Providers:** Jira, Asana, Monday.com, Linear, custom database-backed work management systems

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` for ownership and membership changes; `read_your_writes` for project lists.
* **Details:** A user added to a project must be visible immediately to subsequent access checks.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for project lifecycle and membership events.
* **Details:** Duplicate project creation events must be idempotent (return existing project for the same idempotency key). Duplicate membership change events are no-ops.

### Worker Scaling
* **Policy:** Project CRUD operations and membership management must be synchronous. Aggregation queries (listProjects, usage stats) may be served from read replicas with bounded staleness.

### Multi-Region Behavior
* **Mode:** Project data is single-region for write consistency. Read replicas may serve project list queries with bounded staleness of at most 5 seconds. Ownership changes must propagate to all regions before the change is considered complete.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createProject(workspace_id, owner_id, name, description?, metadata?, idempotency_key?)`
  - `addProjectMember(project_id, user_id, role?, idempotency_key?)`
  - `changeProjectOwner(project_id, user_id, idempotency_key?)`

### Backpressure
* If the database write path is saturated, project creation and membership changes must be queued with a clear timeout error rather than accepted silently. Read queries must be served from replicas during write contention.

### Storage Model
* **Model:** Relational database (PostgreSQL) for projects and project members.
* **Details:**
```sql
CREATE TABLE projects (
    id              UUID PRIMARY KEY,
    workspace_id    UUID NOT NULL,
    owner_id        UUID NOT NULL,
    name            TEXT NOT NULL,
    description     TEXT,
    status          TEXT NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
    start_at        TIMESTAMPTZ,
    end_at          TIMESTAMPTZ,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE project_members (
    project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL,
    role            TEXT NOT NULL DEFAULT 'contributor'
                        CHECK (role IN ('owner', 'manager', 'contributor', 'viewer')),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);

CREATE INDEX idx_projects_workspace ON projects (workspace_id, updated_at DESC);
```

### Error Taxonomy
### Module-Specific Errors
```
createProject:
    duplicate_name:            A project with the same name already exists in the workspace | choose another name
    workspace_not_found:       The target workspace does not exist | return 404

updateProject:
    project_archived:          Archived projects cannot be edited | unarchive first
    project_not_found:         The project ID does not exist | return 404

addProjectMember:
    member_already_exists:     The user is already a member of the project | return existing membership
    project_archived:          Archived projects cannot accept new members | unarchive first

removeProjectMember:
    cannot_remove_owner:       Cannot remove the sole project owner | transfer ownership first

changeProjectOwner:
    member_not_found:          Target user is not a member of the project | add them as a member first
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createProject       → projects.project.created         { project_id, workspace_id, owner_id }
updateProject       → projects.project.updated         { project_id, changed_fields }
archiveProject      → projects.project.archived        { project_id, archived_by }
unarchiveProject    → projects.project.unarchived      { project_id, unarchived_by }
addProjectMember    → projects.project.member.added    { project_id, user_id, role }
removeProjectMember → projects.project.member.removed  { project_id, user_id }
changeProjectOwner  → projects.project.owner.changed   { project_id, old_owner_id, new_owner_id }
```

### Temporal Constraints
```
Project archival retention:
    duration:       indefinite (archived projects are preserved)
    on_expiry:      N/A -- must be explicitly deleted or permanently removed

  Project stale detection:
    threshold:      no updates for 90 days (configurable)
    on_expiry:      flag for archival recommendation; no automatic action

  Membership change rate limit:
    limit:          100 membership changes per project per hour
    on_exceed:      reject with rate_limited
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `projects.<function>`.
* **Telemetry Metrics:**
```
blueprint_projects_total                    counter { status }
blueprint_projects_members_total            gauge { role }
blueprint_projects_updates_total            counter { function, result }
blueprint_projects_operation_duration_ms    histogram { function }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details). Project CRUD P99 must be < 100ms.

### Module Dependencies
* **Depends On:** workspaces, users
* **Emits To:** events
* **Recommends:** notifications, audit_log, permissions, scheduled_tasks (for stale detection)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `updated_at DESC` on list functions.
