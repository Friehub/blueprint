// sessions.ts
// Auto-generated from contracts/sessions.md
// Do not edit manually

export interface Session {
  id: string;
  userId: string;
  device: unknown;
  createdAt: Timestamp;
  lastActiveAt: Timestamp;
  expiresAt: Timestamp;
}

export interface SessionsContract {
  createSession(userId: unknown, deviceInfo?: unknown): Promise<Session>;
  getSession(sessionId: unknown): Promise<Session | undefined>;
  getSessions(userId: unknown): Promise<Session[]>;
  revokeSession(sessionId: unknown): Promise<void>;
  revokeAllSessions(userId: unknown): Promise<void>;
  extendSession(sessionId: unknown): Promise<Session>;
}
