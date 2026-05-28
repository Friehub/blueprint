// linear.ts
// Auto-generated adapter for linear → tasks
// Do not edit manually

import type { TasksContract } from '../interfaces/tasks';

export class LinearAdapter implements TasksContract {
  constructor(private config: {
  api_key: string;
  }) {}

  createTask(projectId: unknown, data: unknown): Promise<Task> {
    // TODO: Implement with createTask
    throw new Error('Not implemented');
  }
  getTask(taskId: unknown): Promise<Task> {
    // TODO: Implement with getTask
    throw new Error('Not implemented');
  }
  listTasks(input: unknown, options?: unknown): Promise<PaginatedResult<Task>> {
    // TODO: Implement with listTasks
    throw new Error('Not implemented');
  }
  updateTask(taskId: unknown, data: unknown): Promise<Task> {
    // TODO: Implement with updateTask
    throw new Error('Not implemented');
  }
  assignTask(taskId: unknown, userId: unknown): Promise<Task> {
    // TODO: Implement with assignTask
    throw new Error('Not implemented');
  }
  changeTaskStatus(taskId: unknown, status: unknown): Promise<Task> {
    // TODO: Implement with changeTaskStatus
    throw new Error('Not implemented');
  }
  addTaskDependency(taskId: unknown, dependsOnTaskId: unknown): Promise<void> {
    // TODO: Implement with addTaskDependency
    throw new Error('Not implemented');
  }
  removeTaskDependency(taskId: unknown, dependsOnTaskId: unknown): Promise<void> {
    // TODO: Implement with removeTaskDependency
    throw new Error('Not implemented');
  }
  completeTask(taskId: unknown): Promise<Task> {
    // TODO: Implement with completeTask
    throw new Error('Not implemented');
  }
  archiveTask(taskId: unknown): Promise<Task> {
    // TODO: Implement with archiveTask
    throw new Error('Not implemented');
  }
}
