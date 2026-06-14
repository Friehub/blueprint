// permissions.ts
// Auto-generated from contracts/permissions.md
// Do not edit manually

export interface Permission {
  action: unknown;
  resource: unknown;
}

export interface Role {
  id: string;
  name: unknown;
  permissions: unknown;
}

export type Accessdecision = AccessDecision = allowed | denied;

export interface PermissionsContract {
  can(userId: unknown, action: unknown, resource: unknown): Promise<boolean>;
  canAll(userId: unknown, actions: unknown, resource: unknown): Promise<boolean>;
  canAny(userId: unknown, actions: unknown, resource: unknown): Promise<boolean>;
  grantPermission(userId: unknown, action: unknown, resource: unknown): Promise<void>;
  revokePermission(userId: unknown, action: unknown, resource: unknown): Promise<void>;
  getPermissions(userId: unknown): Promise<Permission[]>;
  createRole(name: unknown, permissions: unknown): Promise<Role>;
  assignRole(userId: unknown, roleId: unknown): Promise<void>;
}
