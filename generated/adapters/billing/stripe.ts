// stripe.ts
// Auto-generated adapter for stripe → billing
// Do not edit manually

import type { BillingContract } from '../interfaces/billing';

export class StripeAdapter implements BillingContract {
  constructor(private config: {
  api_key: string;
  webhook_secret: string;
  }) {}

  createSubscription(userId: unknown, planId: unknown, paymentMethod: unknown): Promise<Subscription> {
    // TODO: Implement with createSubscription
    throw new Error('Not implemented');
  }
  getSubscription(userId: unknown): Promise<Subscription | undefined> {
    // TODO: Implement with getSubscription
    throw new Error('Not implemented');
  }
  upgradeSubscription(userId: unknown, planId: unknown): Promise<Subscription> {
    // TODO: Implement with upgradeSubscription
    throw new Error('Not implemented');
  }
  downgradeSubscription(userId: unknown, planId: unknown, atPeriodEnd?: unknown): Promise<Subscription> {
    // TODO: Implement with downgradeSubscription
    throw new Error('Not implemented');
  }
  cancelSubscription(userId: unknown, atPeriodEnd?: unknown): Promise<Subscription> {
    // TODO: Implement with cancelSubscription
    throw new Error('Not implemented');
  }
  reactivateSubscription(userId: unknown): Promise<Subscription> {
    // TODO: Implement with reactivateSubscription
    throw new Error('Not implemented');
  }
  getInvoices(userId: unknown, options?: unknown): Promise<PaginatedResult<Invoice>> {
    // TODO: Implement with getInvoices
    throw new Error('Not implemented');
  }
  getInvoice(invoiceId: unknown): Promise<Invoice> {
    // TODO: Implement with getInvoice
    throw new Error('Not implemented');
  }
  getPlans(): Promise<Plan[]> {
    // TODO: Implement with getPlans
    throw new Error('Not implemented');
  }
  getPlan(planId: unknown): Promise<Plan> {
    // TODO: Implement with getPlan
    throw new Error('Not implemented');
  }
}
