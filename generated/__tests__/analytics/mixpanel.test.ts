// mixpanel.test.ts
// Auto-generated conformance test for mixpanel → analytics
// Do not edit manually

import { MixpanelAdapter } from '../adapters/analytics/mixpanel';
import type { AnalyticsContract } from '../interfaces/analytics';

describe('MixpanelAdapter implements AnalyticsContract', () => {
  const adapter: AnalyticsContract = new MixpanelAdapter({
    project_token: 'test',
    secret: 'test'
  });

  it('has trackEvent method', () => {
    expect(typeof adapter.trackEvent).toBe('function');
  });

  it('has identifyUser method', () => {
    expect(typeof adapter.identifyUser).toBe('function');
  });

  it('has trackPageView method', () => {
    expect(typeof adapter.trackPageView).toBe('function');
  });

  it('has getMetrics method', () => {
    expect(typeof adapter.getMetrics).toBe('function');
  });

  it('has getFunnel method', () => {
    expect(typeof adapter.getFunnel).toBe('function');
  });

  it('has getCohort method', () => {
    expect(typeof adapter.getCohort).toBe('function');
  });

  it('has getRetention method', () => {
    expect(typeof adapter.getRetention).toBe('function');
  });

});
