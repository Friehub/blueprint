# Module Contract: `tasks`

**Version:** 0.1.0

---

### `tasks`
Task creation, assignment, lifecycle management, dependencies, and completion tracking.

**Functions**
```
createTask(project_id: any, data: any) → Task
getTask(task_id: any) → Task
listTasks(input: any, options?: any) → PaginatedResult<Task>
updateTask(task_id: any, data: any) → Task
assignTask(task_id: any, user_id: any) → Task
changeTaskStatus(task_id: any, status: string) → Task
addTaskDependency(task_id: any, depends_on_task_id: any) → void
removeTaskDependency(task_id: any, depends_on_task_id: any) → void
completeTask(task_id: any) → Task
archiveTask(task_id: any) → Task
```

**Types**
```
Task { id, project_id, title, description?, status, priority, assignee_id?, due_at?, created_at, updated_at }
TaskDependency { task_id, depends_on_task_id }
TaskStatus = backlog | todo | in_progress | blocked | done | archived
TaskPriority = low | medium | high | urgent
```

**Invariants**
- Dependency graphs must remain acyclic.
- Archived tasks must not be editable except for restoration.
- A task cannot be marked done while blocked dependencies remain open unless explicitly overridden.

**Providers:** Jira, Asana, Linear, Trello, Monday.com, custom task systems

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Task lifecycle and dependency writes must be durably recorded.
- **Idempotency:** `createTask`, `assignTask`, and `changeTaskStatus` must be idempotent on task identity.
- **Storage Model:** Durable task store with dependency history.
- **Dependencies:** `projects`, `users`, `audit_log`, `notifications`.
- **Errors:** `TASK_NOT_FOUND`, `TASK_NOT_EDITABLE`, `TASK_ALREADY_DONE`, `TASK_DEPENDENCY_CYCLE`, `ASSIGNEE_NOT_FOUND`, `TASK_ARCHIVED`.
