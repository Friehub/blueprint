// honeycomb.ts
// Auto-generated adapter for honeycomb → trace_query
// Do not edit manually

import type { TraceQueryContract } from '../interfaces/trace_query';

export class HoneycombAdapter implements TraceQueryContract {
  constructor(private config: {
  api_key: string;
  dataset: string;
  }) {}

  queryTraces(input: unknown, options?: unknown): Promise<PaginatedResult<Trace>> {
    // TODO: Implement with queryTraces
    throw new Error('Not implemented');
  }
  getTrace(traceId: unknown): Promise<Trace> {
    // TODO: Implement with getTrace
    throw new Error('Not implemented');
  }
  getSpan(spanId: unknown): Promise<Span> {
    // TODO: Implement with getSpan
    throw new Error('Not implemented');
  }
  listServices(options?: unknown): Promise<ServiceTraceSummary[]> {
    // TODO: Implement with listServices
    throw new Error('Not implemented');
  }
  searchTraces(query: unknown, options?: unknown): Promise<PaginatedResult<Trace>> {
    // TODO: Implement with searchTraces
    throw new Error('Not implemented');
  }
  getTraceStats(input: unknown): Promise<TraceStats> {
    // TODO: Implement with getTraceStats
    throw new Error('Not implemented');
  }
  getErrorTraces(input: unknown, options?: unknown): Promise<PaginatedResult<Trace>> {
    // TODO: Implement with getErrorTraces
    throw new Error('Not implemented');
  }
}
