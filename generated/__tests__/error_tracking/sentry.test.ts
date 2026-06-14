// sentry.test.ts
// Auto-generated conformance test for sentry → error_tracking
// Do not edit manually

import { SentryAdapter } from '../adapters/error_tracking/sentry';
import type { ErrorTrackingContract } from '../interfaces/error_tracking';

describe('SentryAdapter implements ErrorTrackingContract', () => {
  const adapter: ErrorTrackingContract = new SentryAdapter({
    dsn: 'test',
    org: 'test',
    project: 'test'
  });

  it('has recordError method', () => {
    expect(typeof adapter.recordError).toBe('function');
  });

  it('has getErrorEvent method', () => {
    expect(typeof adapter.getErrorEvent).toBe('function');
  });

  it('has listErrorEvents method', () => {
    expect(typeof adapter.listErrorEvents).toBe('function');
  });

  it('has getIssue method', () => {
    expect(typeof adapter.getIssue).toBe('function');
  });

  it('has listIssues method', () => {
    expect(typeof adapter.listIssues).toBe('function');
  });

  it('has updateIssue method', () => {
    expect(typeof adapter.updateIssue).toBe('function');
  });

  it('has assignIssue method', () => {
    expect(typeof adapter.assignIssue).toBe('function');
  });

  it('has muteIssue method', () => {
    expect(typeof adapter.muteIssue).toBe('function');
  });

  it('has unmuteIssue method', () => {
    expect(typeof adapter.unmuteIssue).toBe('function');
  });

  it('has createAlertRule method', () => {
    expect(typeof adapter.createAlertRule).toBe('function');
  });

  it('has getAlertRule method', () => {
    expect(typeof adapter.getAlertRule).toBe('function');
  });

  it('has listAlertRules method', () => {
    expect(typeof adapter.listAlertRules).toBe('function');
  });

});
