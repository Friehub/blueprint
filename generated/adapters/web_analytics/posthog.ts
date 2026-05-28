// posthog.ts
// Auto-generated adapter for posthog → web_analytics
// Do not edit manually

import type { WebAnalyticsContract } from '../interfaces/web_analytics';

export class PosthogAdapter implements WebAnalyticsContract {
  constructor(private config: {
  api_key: string;
  host: string;
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
