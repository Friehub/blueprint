// billing.ts
// Auto-generated from contracts/billing.md
// Do not edit manually

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: unknown;
  currentPeriodStart: unknown;
  currentPeriodEnd: unknown;
}

export interface Plan {
  id: string;
  name: unknown;
  price: unknown;
  currency: unknown;
  interval: unknown;
  features: unknown;
  limits: unknown;
}

export interface Invoice {
  id: string;
  userId: string;
  amount: unknown;
  currency: unknown;
  status: unknown;
  lineItems: unknown;
  dueAt: Timestamp;
}

export type Subscriptionstatus = SubscriptionStatus = active | trialing | past_due | cancelled | paused;

export interface BillingContract {
  createSubscription(userId: unknown, planId: unknown, paymentMethod: unknown): Promise<Subscription>;
  getSubscription(userId: unknown): Promise<Subscription | undefined>;
  upgradeSubscription(userId: unknown, planId: unknown): Promise<Subscription>;
  downgradeSubscription(userId: unknown, planId: unknown, atPeriodEnd?: unknown): Promise<Subscription>;
  cancelSubscription(userId: unknown, atPeriodEnd?: unknown): Promise<Subscription>;
  reactivateSubscription(userId: unknown): Promise<Subscription>;
  getInvoices(userId: unknown, options?: unknown): Promise<PaginatedResult<Invoice>>;
  getInvoice(invoiceId: unknown): Promise<Invoice>;
  getPlans(): Promise<Plan[]>;
  getPlan(planId: unknown): Promise<Plan>;
}
