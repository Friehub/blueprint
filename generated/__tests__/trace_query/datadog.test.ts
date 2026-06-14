// datadog.test.ts
// Auto-generated conformance test for datadog → trace_query
// Do not edit manually

import { DatadogAdapter } from '../adapters/trace_query/datadog';
import type { TraceQueryContract } from '../interfaces/trace_query';

describe('DatadogAdapter implements TraceQueryContract', () => {
  const adapter: TraceQueryContract = new DatadogAdapter({
    api_key: 'test',
    app_key: 'test'
  });

  it('has queryTraces method', () => {
    expect(typeof adapter.queryTraces).toBe('function');
  });

  it('has getTrace method', () => {
    expect(typeof adapter.getTrace).toBe('function');
  });

  it('has getSpan method', () => {
    expect(typeof adapter.getSpan).toBe('function');
  });

  it('has listServices method', () => {
    expect(typeof adapter.listServices).toBe('function');
  });

  it('has searchTraces method', () => {
    expect(typeof adapter.searchTraces).toBe('function');
  });

  it('has getTraceStats method', () => {
    expect(typeof adapter.getTraceStats).toBe('function');
  });

  it('has getErrorTraces method', () => {
    expect(typeof adapter.getErrorTraces).toBe('function');
  });

});
