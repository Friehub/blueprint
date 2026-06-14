// asana.ts
// Auto-generated adapter for asana → projects
// Do not edit manually

import type { ProjectsContract } from '../interfaces/projects';

export class AsanaAdapter implements ProjectsContract {
  constructor(private config: {
  access_token: string;
  }) {}

  createProject(workspaceId: unknown, ownerId: unknown, name: unknown, description?: unknown, metadata?: unknown): Promise<Project> {
    // TODO: Implement with createProject
    throw new Error('Not implemented');
  }
  getProject(projectId: unknown): Promise<Project | undefined> {
    // TODO: Implement with getProject
    throw new Error('Not implemented');
  }
  listProjects(workspaceId: unknown, options?: unknown): Promise<PaginatedResult<Project>> {
    // TODO: Implement with listProjects
    throw new Error('Not implemented');
  }
  updateProject(projectId: unknown, data: unknown): Promise<Project> {
    // TODO: Implement with updateProject
    throw new Error('Not implemented');
  }
  archiveProject(projectId: unknown): Promise<Project> {
    // TODO: Implement with archiveProject
    throw new Error('Not implemented');
  }
  unarchiveProject(projectId: unknown): Promise<Project> {
    // TODO: Implement with unarchiveProject
    throw new Error('Not implemented');
  }
  addProjectMember(projectId: unknown, userId: unknown, role?: unknown): Promise<ProjectMember> {
    // TODO: Implement with addProjectMember
    throw new Error('Not implemented');
  }
  removeProjectMember(projectId: unknown, userId: unknown): Promise<void> {
    // TODO: Implement with removeProjectMember
    throw new Error('Not implemented');
  }
  changeProjectOwner(projectId: unknown, userId: unknown): Promise<Project> {
    // TODO: Implement with changeProjectOwner
    throw new Error('Not implemented');
  }
}
