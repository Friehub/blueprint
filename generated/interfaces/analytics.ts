// analytics.ts
// Auto-generated from contracts/analytics.md
// Do not edit manually

export interface Analyticsevent {
  name: unknown;
  properties: unknown;
  context: unknown;
  timestamp: unknown;
}

export interface Metricresult {
  value: unknown;
  series: DataPoint[];
}

export interface Funnelresult {
  steps: FunnelStep[];
  conversionRate: unknown;
}

export interface Funnelstep {
  name: unknown;
  count: unknown;
  conversionRate: unknown;
}

export interface Datapoint {
  timestamp: unknown;
  value: unknown;
}

export interface AnalyticsContract {
  trackEvent(eventName: unknown, userId?: unknown, properties?: unknown, context?: unknown): Promise<void>;
  identifyUser(userId: unknown, traits: unknown): Promise<void>;
  trackPageView(userId?: unknown, url: unknown, properties?: unknown): Promise<void>;
  getMetrics(metric: unknown, period: unknown, filters?: unknown): Promise<MetricResult>;
  getFunnel(steps: unknown, period: unknown, filters?: unknown): Promise<FunnelResult>;
  getCohort(definition: unknown, period: unknown): Promise<CohortResult>;
  getRetention(cohortStart: unknown, periods: unknown): Promise<RetentionResult>;
}
