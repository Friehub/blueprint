// presence.ts
// Auto-generated from contracts/presence.md
// Do not edit manually

export interface Presencestate {
  userId: string;
  online: unknown;
  lastSeenAt: Timestamp;
}

export type Unsubscribe = Unsubscribe = () => void;

export interface PresenceContract {
  setOnline(userId: unknown, channel?: unknown, metadata?: unknown): Promise<void>;
  setOffline(userId: unknown, channel?: unknown): Promise<void>;
  getPresence(userId: unknown): Promise<PresenceState>;
  getPresenceMultiple(userIds: unknown): Promise<Record<string, PresenceState>>;
  subscribeToPresence(userId: unknown, callback: unknown): Promise<Unsubscribe>;
  setCustomStatus(userId: unknown, status: unknown): Promise<void>;
}
