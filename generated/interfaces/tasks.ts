// tasks.ts
// Auto-generated from contracts/tasks.md
// Do not edit manually

export interface Task {
  id: string;
  projectId: string;
  title: unknown;
  status: unknown;
  priority: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Taskdependency {
  taskId: string;
  dependsOnTaskId: string;
}

export type Taskstatus = TaskStatus = backlog | todo | in_progress | blocked | done | archived;

export type Taskpriority = TaskPriority = low | medium | high | urgent;

export interface TasksContract {
  createTask(projectId: unknown, data: unknown): Promise<Task>;
  getTask(taskId: unknown): Promise<Task>;
  listTasks(input: unknown, options?: unknown): Promise<PaginatedResult<Task>>;
  updateTask(taskId: unknown, data: unknown): Promise<Task>;
  assignTask(taskId: unknown, userId: unknown): Promise<Task>;
  changeTaskStatus(taskId: unknown, status: unknown): Promise<Task>;
  addTaskDependency(taskId: unknown, dependsOnTaskId: unknown): Promise<void>;
  removeTaskDependency(taskId: unknown, dependsOnTaskId: unknown): Promise<void>;
  completeTask(taskId: unknown): Promise<Task>;
  archiveTask(taskId: unknown): Promise<Task>;
}
