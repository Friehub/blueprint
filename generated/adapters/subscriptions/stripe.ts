// stripe.ts
// Auto-generated adapter for stripe → subscriptions
// Do not edit manually

import type { SubscriptionsContract } from '../interfaces/subscriptions';

export class StripeAdapter implements SubscriptionsContract {
  constructor(private config: {
  api_key: string;
  webhook_secret: string;
  }) {}

  getEntitlements(userId: unknown): Promise<Entitlement[]> {
    throw new Error('Not implemented by this adapter');
  }
  hasAccess(userId: unknown, resourceId: unknown): Promise<boolean> {
    throw new Error('Not implemented by this adapter');
  }
  grantEntitlement(userId: unknown, entitlementType: unknown, expiresAt?: unknown): Promise<Entitlement> {
    throw new Error('Not implemented by this adapter');
  }
  revokeEntitlement(userId: unknown, entitlementType: unknown): Promise<void> {
    throw new Error('Not implemented by this adapter');
  }
  getAccessHistory(userId: unknown, resourceId: unknown): Promise<AccessEvent[]> {
    throw new Error('Not implemented by this adapter');
  }
}
