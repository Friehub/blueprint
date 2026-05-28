// tenants.ts
// Auto-generated from contracts/tenants.md
// Do not edit manually

export interface Tenant {
  id: string;
  name: unknown;
  slug: unknown;
  planId: string;
  status: unknown;
  ownerId: string;
  createdAt: Timestamp;
}

export interface Tenantmember {
  userId: string;
  tenantId: string;
  role: unknown;
  joinedAt: Timestamp;
}

export interface Tenantinvite {
  id: string;
  email: unknown;
  role: unknown;
  expiresAt: Timestamp;
  accepted: unknown;
}

export interface Tenantconfig {
  settings: Record<string;
  featureFlags: unknown;
  limits: unknown;
}

export type Tenantstatus = TenantStatus = active | suspended | deleted;

export interface TenantsContract {
  createTenant(name: unknown, ownerId: unknown, planId?: unknown): Promise<Tenant>;
  getTenant(tenantId: unknown): Promise<Tenant>;
  getTenantBySlug(slug: unknown): Promise<Tenant | undefined>;
  updateTenant(tenantId: unknown, data: unknown): Promise<Tenant>;
  suspendTenant(tenantId: unknown, reason: unknown): Promise<Tenant>;
  reactivateTenant(tenantId: unknown): Promise<Tenant>;
  deleteTenant(tenantId: unknown): Promise<void>;
  getTenantMembers(tenantId: unknown): Promise<TenantMember[]>;
  inviteMember(tenantId: unknown, email: unknown, role: unknown): Promise<TenantInvite>;
  removeMember(tenantId: unknown, userId: unknown): Promise<void>;
  getTenantConfig(tenantId: unknown): Promise<TenantConfig>;
  updateTenantConfig(tenantId: unknown, config: unknown): Promise<TenantConfig>;
}
