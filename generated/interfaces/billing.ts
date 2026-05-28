// billing.ts
// Auto-generated from contracts/billing.md
// Do not edit manually

export interface Subscription Subscription { id, user_id, plan_id, status, current_period_start, current_period_end, cancel_at? }

export interface Plan Plan { id, name, price, currency, interval, features, limits }

export interface Invoice Invoice { id, user_id, amount, currency, status, line_items, due_at, paid_at? }

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
