// google-analytics.ts
// Auto-generated adapter for google-analytics → web_analytics
// Do not edit manually

import type { WebAnalyticsContract } from '../interfaces/web_analytics';

export class GoogleAnalyticsAdapter implements WebAnalyticsContract {
  constructor(private config: {
  measurement_id: string;
  api_secret: string;
  }) {}

  trackPageView(url: unknown, userId?: unknown, context?: unknown): Promise<void> {
    // TODO: Implement with trackPageView
    throw new Error('Not implemented');
  }
  trackSessionStart(sessionId: unknown, context?: unknown): Promise<void> {
    throw new Error('Not implemented by this adapter');
  }
  trackSessionEnd(sessionId: unknown, context?: unknown): Promise<void> {
    throw new Error('Not implemented by this adapter');
  }
  trackConversion(eventName: unknown, userId?: unknown, context?: unknown): Promise<void> {
    throw new Error('Not implemented by this adapter');
  }
  getPageMetrics(input: unknown): Promise<PageMetrics> {
    throw new Error('Not implemented by this adapter');
  }
  getAttributionReport(input: unknown): Promise<AttributionReport> {
    throw new Error('Not implemented by this adapter');
  }
  getSessionReplay(sessionId: unknown): Promise<SessionReplay | undefined> {
    throw new Error('Not implemented by this adapter');
  }
}
