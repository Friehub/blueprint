// activity_feed.ts
// Auto-generated from contracts/activity_feed.md
// Do not edit manually

export type FeedEntryId = string;

export type ActivityTypeId = string;

export type EntityRef = {
entityType: string;
entityId: string;
};

export type RegisterActivityTypeInput = {
eventName: string;               // e.g. "order.status_changed", "comment.created"
sourceModule: string;            // e.g. "orders", "comments"
displayTemplate: string;         // e.g. "{{actor.name}} updated order #{{entity.id}} to {{data.newStatus}}"
audienceStrategy: AudienceStrategy;
icon?: string;
groupable: boolean;              // If true, consecutive similar entries can be grouped
};

export type ActivityType = RegisterActivityTypeInput & {

export type IngestEventInput = {
eventName: string;
actorId?: UserId;
actorType?: string;              // e.g. "user", "system", "api_key"
entityRef?: EntityRef;
workspaceId?: string;
data: Record<string, unknown>;  // Event payload; used for template rendering
occurredAt: Timestamp;
idempotencyKey: string;         // Source event ID; prevents duplicate entries
};

export type FeedEntry = {
entryId: FeedEntryId;
activityTypeId: ActivityTypeId;
eventName: string;
actorId?: UserId;
actorType?: string;
actorDisplayName?: string;
entityRef?: EntityRef;
workspaceId?: string;
renderedText: string;            // Pre-rendered from displayTemplate and data
data: Record<string, unknown>;
visible: boolean;
occurredAt: Timestamp;
ingestedAt: Timestamp;
groupKey?: string;               // Non-null for groupable activities; used to collapse related entries
};

export type GetFeedInput = {
audience: "PERSONAL" | "WORKSPACE" | "PUBLIC_PROFILE";
actorId?: UserId;                // For PERSONAL and PUBLIC_PROFILE audiences
workspaceId?: string;            // For WORKSPACE audience
eventNames?: string[];           // Filter to specific activity types
entityRef?: EntityRef;
fromDate?: Timestamp;
toDate?: Timestamp;
pagination: FeedPaginationInput;
};

export type FeedPaginationInput = {
cursor?: string;                 // Cursor-based pagination for real-time feeds
limit: number;
};

export interface ActivityFeedContract {
  registerActivityType(input: RegisterActivityTypeInput): Promise<ActivityType>;
  ingestEvent(input: IngestEventInput): Promise<void>;
  getFeed(input: GetFeedInput): Promise<PaginatedList<FeedEntry>>;
  getUserFeed(userId: UserId, input: FeedPaginationInput): Promise<PaginatedList<FeedEntry>>;
  getEntityFeed(entityRef: EntityRef, input: FeedPaginationInput): Promise<PaginatedList<FeedEntry>>;
  hideEntry(entryId: FeedEntryId, reason?: string): Promise<void>;
  unhideEntry(entryId: FeedEntryId): Promise<void>;
  deleteEntriesByActor(actorId: UserId): Promise<void>;
  deleteEntriesByEntity(entityRef: EntityRef): Promise<void>;
}
