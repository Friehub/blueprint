// asana.test.ts
// Auto-generated conformance test for asana → tasks
// Do not edit manually

import { AsanaAdapter } from '../adapters/tasks/asana';
import type { TasksContract } from '../interfaces/tasks';

describe('AsanaAdapter implements TasksContract', () => {
  const adapter: TasksContract = new AsanaAdapter({
    access_token: 'test'
  });

  it('has createTask method', () => {
    expect(typeof adapter.createTask).toBe('function');
  });

  it('has getTask method', () => {
    expect(typeof adapter.getTask).toBe('function');
  });

  it('has listTasks method', () => {
    expect(typeof adapter.listTasks).toBe('function');
  });

  it('has updateTask method', () => {
    expect(typeof adapter.updateTask).toBe('function');
  });

  it('has assignTask method', () => {
    expect(typeof adapter.assignTask).toBe('function');
  });

  it('has changeTaskStatus method', () => {
    expect(typeof adapter.changeTaskStatus).toBe('function');
  });

  it('has addTaskDependency method', () => {
    expect(typeof adapter.addTaskDependency).toBe('function');
  });

  it('has removeTaskDependency method', () => {
    expect(typeof adapter.removeTaskDependency).toBe('function');
  });

  it('has completeTask method', () => {
    expect(typeof adapter.completeTask).toBe('function');
  });

  it('has archiveTask method', () => {
    expect(typeof adapter.archiveTask).toBe('function');
  });

});
