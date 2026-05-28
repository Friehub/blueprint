// google-analytics.test.ts
// Auto-generated conformance test for google-analytics → web_analytics
// Do not edit manually

import { GoogleAnalyticsAdapter } from '../adapters/web_analytics/google-analytics';
import type { WebAnalyticsContract } from '../interfaces/web_analytics';

describe('GoogleAnalyticsAdapter implements WebAnalyticsContract', () => {
  const adapter: WebAnalyticsContract = new GoogleAnalyticsAdapter({
    measurement_id: 'test',
    api_secret: 'test'
  });

  it('has trackPageView method', () => {
    expect(typeof adapter.trackPageView).toBe('function');
  });

  it('has trackSessionStart method', () => {
    expect(typeof adapter.trackSessionStart).toBe('function');
  });

  it('has trackSessionEnd method', () => {
    expect(typeof adapter.trackSessionEnd).toBe('function');
  });

  it('has trackConversion method', () => {
    expect(typeof adapter.trackConversion).toBe('function');
  });

  it('has getPageMetrics method', () => {
    expect(typeof adapter.getPageMetrics).toBe('function');
  });

  it('has getAttributionReport method', () => {
    expect(typeof adapter.getAttributionReport).toBe('function');
  });

  it('has getSessionReplay method', () => {
    expect(typeof adapter.getSessionReplay).toBe('function');
  });

});
