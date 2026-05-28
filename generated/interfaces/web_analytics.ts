// web_analytics.ts
// Auto-generated from contracts/web_analytics.md
// Do not edit manually

export interface Pagemetrics {
  url: unknown;
  views: unknown;
  uniqueVisitors: unknown;
  bounceRate: unknown;
  avgTimeOnPage: unknown;
  period: unknown;
}

export interface Attributionreport {
  source: unknown;
  medium: unknown;
  conversions: unknown;
}

export interface Sessionreplay {
  sessionId: string;
  events: unknown;
  createdAt: Timestamp;
}

export interface WebAnalyticsContract {
  trackPageView(url: unknown, userId?: unknown, context?: unknown): Promise<void>;
  trackSessionStart(sessionId: unknown, context?: unknown): Promise<void>;
  trackSessionEnd(sessionId: unknown, context?: unknown): Promise<void>;
  trackConversion(eventName: unknown, userId?: unknown, context?: unknown): Promise<void>;
  getPageMetrics(input: unknown): Promise<PageMetrics>;
  getAttributionReport(input: unknown): Promise<AttributionReport>;
  getSessionReplay(sessionId: unknown): Promise<SessionReplay | undefined>;
}
