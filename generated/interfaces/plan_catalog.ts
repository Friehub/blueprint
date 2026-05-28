// plan_catalog.ts
// Auto-generated from contracts/plan_catalog.md
// Do not edit manually

export interface Plan {
  id: string;
  name: unknown;
  status: unknown;
  currency: unknown;
  interval: unknown;
  price: unknown;
  features: unknown;
  limits: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Feature {
  key: unknown;
  enabled: unknown;
}

export interface Plancomparison {
  planIds: unknown;
  differences: unknown;
}

export type Planstatus = PlanStatus = active | deprecated | archived;

export interface PlanCatalogContract {
  createPlan(data: unknown): Promise<Plan>;
  getPlan(planId: unknown): Promise<Plan>;
  listPlans(options?: unknown): Promise<PaginatedResult<Plan>>;
  updatePlan(planId: unknown, data: unknown): Promise<Plan>;
  archivePlan(planId: unknown): Promise<Plan>;
  getPlanFeatures(planId: unknown): Promise<Feature[]>;
  comparePlans(planIds: unknown): Promise<PlanComparison>;
}
