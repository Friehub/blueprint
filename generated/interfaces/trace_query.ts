// trace_query.ts
// Auto-generated from contracts/trace_query.md
// Do not edit manually

export interface Trace {
  id: string;
  traceId: string;
  service: unknown;
  operation: unknown;
  status: unknown;
  durationMs: unknown;
  startAt: Timestamp;
  endAt: Timestamp;
  spansCount: number;
}

export interface Span {
  id: string;
  traceId: string;
  service: unknown;
  operation: unknown;
  status: unknown;
  durationMs: unknown;
  startAt: Timestamp;
  endAt: Timestamp;
}

export interface Servicetracesummary {
  service: unknown;
  traceCount: number;
  errorCount: number;
  p95Ms: unknown;
  lastSeenAt: Timestamp;
}

export interface Tracestats {
  traceCount: number;
  errorCount: number;
  p50Ms: unknown;
  p95Ms: unknown;
  p99Ms: unknown;
}

export type Tracestatus = TraceStatus = success | failure | not_found | timeout;

export interface TraceQueryContract {
  queryTraces(input: unknown, options?: unknown): Promise<PaginatedResult<Trace>>;
  getTrace(traceId: unknown): Promise<Trace>;
  getSpan(spanId: unknown): Promise<Span>;
  listServices(options?: unknown): Promise<ServiceTraceSummary[]>;
  searchTraces(query: unknown, options?: unknown): Promise<PaginatedResult<Trace>>;
  getTraceStats(input: unknown): Promise<TraceStats>;
  getErrorTraces(input: unknown, options?: unknown): Promise<PaginatedResult<Trace>>;
}
