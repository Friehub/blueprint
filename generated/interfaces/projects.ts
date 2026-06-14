// projects.ts
// Auto-generated from contracts/projects.md
// Do not edit manually

export interface Project {
  id: string;
  workspaceId: string;
  ownerId: string;
  name: unknown;
  status: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Projectmember {
  projectId: string;
  userId: string;
  role: unknown;
  joinedAt: Timestamp;
}

export type Projectstatus = ProjectStatus = draft | active | paused | completed | archived;

export type Projectrole = ProjectRole = owner | manager | contributor | viewer;

export interface ProjectsContract {
  createProject(workspaceId: unknown, ownerId: unknown, name: unknown, description?: unknown, metadata?: unknown): Promise<Project>;
  getProject(projectId: unknown): Promise<Project | undefined>;
  listProjects(workspaceId: unknown, options?: unknown): Promise<PaginatedResult<Project>>;
  updateProject(projectId: unknown, data: unknown): Promise<Project>;
  archiveProject(projectId: unknown): Promise<Project>;
  unarchiveProject(projectId: unknown): Promise<Project>;
  addProjectMember(projectId: unknown, userId: unknown, role?: unknown): Promise<ProjectMember>;
  removeProjectMember(projectId: unknown, userId: unknown): Promise<void>;
  changeProjectOwner(projectId: unknown, userId: unknown): Promise<Project>;
}
