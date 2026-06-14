// health.ts
// Auto-generated from contracts/health.md
// Do not edit manually

export interface Healthreport {
  status: unknown;
  checks: Record<string;
  timestamp: unknown;
}

export interface Checkresult {
  status: healthy|degraded|unhealthy;
}

export type Systemstatus = SystemStatus = operational | degraded | partial_outage | major_outage;

export interface Healthevent {
  service: unknown;
  status: unknown;
  message: unknown;
  timestamp: unknown;
}

export interface HealthContract {
  check(service?: unknown): Promise<HealthReport>;
  checkAll(): Promise<HealthReport>;
  registerCheck(name: unknown, checkFn: unknown, options?: unknown): Promise<void>;
  getStatus(): Promise<SystemStatus>;
  getHistory(service: unknown, options?: unknown): Promise<HealthEvent[]>;
}
