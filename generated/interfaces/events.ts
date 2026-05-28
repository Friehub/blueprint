// events.ts
// Auto-generated from contracts/events.md
// Do not edit manually

export interface Subscription {
  id: string;
  topic: unknown;
  handler: unknown;
}

export interface EventsContract {
  publish(topic: unknown, event: unknown): Promise<void>;
  subscribe(topic: unknown, handler: unknown): Promise<Subscription>;
  unsubscribe(subscriptionId: unknown): Promise<void>;
  publishBulk(topic: unknown, events: unknown): Promise<void>;
  getTopics(): Promise<string[]>;
  replay(topic: unknown, from: unknown, to: unknown, handler: unknown): Promise<void>;
}
