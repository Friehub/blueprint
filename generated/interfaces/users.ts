// users.ts
// Auto-generated from contracts/users.md
// Do not edit manually

export interface User {
  id: string;
  email: unknown;
  name: unknown;
  roles: unknown;
  status: unknown;
  createdAt: Timestamp;
  metadata: unknown;
}

export interface Role {
  id: string;
  name: unknown;
  permissions: unknown;
}

export type Userstatus = UserStatus = active | banned | suspended | pending_verification;

export interface UsersContract {
  getUser(userId: unknown): Promise<User>;
  getUserByEmail(email: unknown): Promise<User | undefined>;
  createUser(data: unknown): Promise<User>;
  updateUser(userId: unknown, data: unknown): Promise<User>;
  deleteUser(userId: unknown): Promise<void>;
  searchUsers(query: unknown, options?: unknown): Promise<PaginatedResult<User>>;
  getUsersByRole(role: unknown): Promise<User[]>;
  assignRole(userId: unknown, role: unknown): Promise<void>;
  revokeRole(userId: unknown, role: unknown): Promise<void>;
  getUserRoles(userId: unknown): Promise<Role[]>;
  banUser(userId: unknown, reason: unknown): Promise<void>;
  unbanUser(userId: unknown): Promise<void>;
}
