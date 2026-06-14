// subscriptions.ts
// Auto-generated from contracts/subscriptions.md
// Do not edit manually

export interface Entitlement {
  userId: string;
  type: unknown;
  grantedAt: Timestamp;
  source: plan|gift|trial|purchase;
}

export interface Accessevent {
  userId: string;
  resourceId: string;
  granted: unknown;
  reason: unknown;
  timestamp: unknown;
}

export interface SubscriptionsContract {
  getEntitlements(userId: unknown): Promise<Entitlement[]>;
  hasAccess(userId: unknown, resourceId: unknown): Promise<boolean>;
  grantEntitlement(userId: unknown, entitlementType: unknown, expiresAt?: unknown): Promise<Entitlement>;
  revokeEntitlement(userId: unknown, entitlementType: unknown): Promise<void>;
  getAccessHistory(userId: unknown, resourceId: unknown): Promise<AccessEvent[]>;
}
