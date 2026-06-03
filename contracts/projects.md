# Module Contract: `projects`

**Version:** 0.1.0

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
- A project must always have exactly one owner.
- Archived projects must not accept edits or membership changes until they are unarchived.
- Project names must be unique within the same workspace.

**Providers:** Jira, Asana, Monday.com, Linear, custom database-backed work management systems

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` for ownership and membership changes; `read_your_writes` for project lists.
* **Details:** A user added to a project must be visible immediately to subsequent access checks.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createProject(workspace_id, owner_id, name, description?, metadata?, idempotency_key?)`
  - `addProjectMember(project_id, user_id, role?, idempotency_key?)`
  - `changeProjectOwner(project_id, user_id, idempotency_key?)`

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
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `projects.<function>`.
* **Telemetry Metrics:**
```
gensense_projects_total                    counter { status }
gensense_projects_members_total            gauge { role }
gensense_projects_updates_total            counter { function, result }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** workspaces, users
* **Emits To:** events
* **Recommends:** notifications, audit_log, permissions
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `updated_at DESC` on list functions.
