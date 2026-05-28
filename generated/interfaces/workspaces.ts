// workspaces.ts
// Auto-generated from contracts/workspaces.md
// Do not edit manually

export interface Workspace {
  id: string;
  name: unknown;
  status: unknown;
  ownerId: string;
  createdAt: Timestamp;
}

export interface Workspacemember {
  workspaceId: string;
  userId: string;
  role: unknown;
  joinedAt: Timestamp;
}

export interface Workspaceresources {
  workspaceId: string;
  memberCount: number;
  docCount: number;
  storageBytesUsed: unknown;
}

export type Workspacestatus = WorkspaceStatus = active | suspended | archived;

export type Workspacerole = WorkspaceRole = owner | admin | editor | viewer;

export interface WorkspacesContract {
  createWorkspace(name: unknown, ownerId: unknown): Promise<Workspace>;
  addWorkspaceMember(workspaceId: unknown, userId: unknown, role: unknown): Promise<WorkspaceMember>;
  removeWorkspaceMember(workspaceId: unknown, userId: unknown): Promise<void>;
  getWorkspaceResources(workspaceId: unknown): Promise<WorkspaceResources>;
}
