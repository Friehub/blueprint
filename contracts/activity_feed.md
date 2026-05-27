# Module: activity_feed

**Version:** 0.1.0
**Part:** V — Real-Time and Social

## Purpose

Defines the interface for aggregating and serving a cross-domain activity timeline. An activity feed is a chronological stream of significant events produced by other domain modules, projected into a human-readable feed for a specific audience — a user's own actions, the actions of users they follow, or the activity within a shared workspace. This module is a read-optimised projection layer. It does not originate events — it consumes events from other modules and stores denormalised feed entries for low-latency retrieval.

---

## State Machine

This module is projection-based and does not maintain per-entry state machines. Feed entries are immutable once written. The module exposes aggregate state only at the feed level:

```
Feed population: Event received → Entry written → Entry served
Entry visibility: VISIBLE → HIDDEN (via moderation or privacy change)
                 HIDDEN → VISIBLE
```

---

## Functions

### `registerActivityType(input: RegisterActivityTypeInput) → ActivityType`
Declares a named activity type that this feed recognises. Maps an event name from a source domain to a human-readable template and an audience strategy.

### `ingestEvent(input: IngestEventInput) → void`
Accepts a domain event and writes one or more feed entries based on the registered activity type's audience strategy. This is the write path — called by event consumers, not by end users.

### `getFeed(input: GetFeedInput) → PaginatedList<FeedEntry>`
Returns the activity feed for a given audience context (a user's personal feed, a workspace feed, or a public profile feed), ordered by most recent first.

### `getUserFeed(userId: UserId, input: FeedPaginationInput) → PaginatedList<FeedEntry>`
Convenience method: returns all activity entries where the actor is the given user.

### `getEntityFeed(entityRef: EntityRef, input: FeedPaginationInput) → PaginatedList<FeedEntry>`
Returns all activity entries related to a specific entity (e.g. all activity on a specific order, ticket, or document).

### `hideEntry(entryId: FeedEntryId, reason?: string) → void`
Hides a feed entry from all audiences. Used for moderation or privacy compliance.

### `unhideEntry(entryId: FeedEntryId) → void`
Restores a hidden feed entry.

### `deleteEntriesByActor(actorId: UserId) → void`
Deletes all feed entries where the actor is the given user. Used for GDPR account erasure.

### `deleteEntriesByEntity(entityRef: EntityRef) → void`
Deletes all feed entries related to a specific entity. Used when the source entity is hard-deleted.

---

## Types

```typescript
type FeedEntryId = string;
type ActivityTypeId = string;

type AudienceStrategy =
  | "ACTOR_ONLY"          // Only visible to the actor (personal activity log)
  | "FOLLOWERS"           // Visible to users following the actor
  | "WORKSPACE"           // Visible to all members of the actor's workspace
  | "ENTITY_WATCHERS"     // Visible to users watching the related entity
  | "PUBLIC";             // Visible to anyone

type EntityRef = {
  entityType: string;
  entityId: string;
};

type RegisterActivityTypeInput = {
  eventName: string;               // e.g. "order.status_changed", "comment.created"
  sourceModule: string;            // e.g. "orders", "comments"
  displayTemplate: string;         // e.g. "{{actor.name}} updated order #{{entity.id}} to {{data.newStatus}}"
  audienceStrategy: AudienceStrategy;
  icon?: string;
  groupable: boolean;              // If true, consecutive similar entries can be grouped
};

type ActivityType = RegisterActivityTypeInput & {
  activityTypeId: ActivityTypeId;
  createdAt: Timestamp;
};

type IngestEventInput = {
  eventName: string;
  actorId?: UserId;
  actorType?: string;              // e.g. "user", "system", "api_key"
  entityRef?: EntityRef;
  workspaceId?: string;
  data: Record<string, unknown>;  // Event payload; used for template rendering
  occurredAt: Timestamp;
  idempotencyKey: string;         // Source event ID; prevents duplicate entries
};

type FeedEntry = {
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

type GetFeedInput = {
  audience: "PERSONAL" | "WORKSPACE" | "PUBLIC_PROFILE";
  actorId?: UserId;                // For PERSONAL and PUBLIC_PROFILE audiences
  workspaceId?: string;            // For WORKSPACE audience
  eventNames?: string[];           // Filter to specific activity types
  entityRef?: EntityRef;
  fromDate?: Timestamp;
  toDate?: Timestamp;
  pagination: FeedPaginationInput;
};

type FeedPaginationInput = {
  cursor?: string;                 // Cursor-based pagination for real-time feeds
  limit: number;
};
```

---

## Invariants

1. `ingestEvent` is idempotent on `idempotencyKey`; duplicate event deliveries do not create duplicate feed entries.
2. `ingestEvent` for an unregistered `eventName` is silently discarded; it does not return an error. This allows event producers to emit freely without coordinating activity type registration.
3. `renderedText` is computed at ingest time using the `displayTemplate`, not at read time; template changes do not retroactively re-render historical entries.
4. Hidden entries must not appear in any `getFeed`, `getUserFeed`, or `getEntityFeed` response regardless of the caller's identity.
5. Feed entries are immutable after creation; the only mutable field is `visible`.
6. `deleteEntriesByActor` and `deleteEntriesByEntity` are permanent and must complete atomically; partial deletes are invalid.
7. Cursor-based pagination must remain stable; a cursor issued at time T must return the same relative position even if new entries are inserted after T.

---

## Events Emitted

This module consumes events from other modules; it does not emit new domain events to avoid recursive feed loops. Internal observability events (e.g. `feed.entry.ingested`) are emitted to the tracing layer only, not to the event bus.

---

## System-Level Integrations

- **Idempotency:** `ingestEvent` is idempotent on `idempotencyKey`.
- **Consistency:** Feed writes are eventually consistent. The acceptable lag between a source event and feed entry availability is ≤ 2 seconds under normal load.
- **Runtime delivery:** Feed ingestion consumes source events `at_least_once`; duplicate source events must not create duplicate feed entries.
- **Worker scaling:** Feed ingestion and feed query paths must be independently scalable.
- **Multi-region:** If feed ingestion is active/active, duplicate event processing across regions must be deduplicated by `idempotencyKey`.
- **Observability:** `ingestEvent` spans must carry `eventName`, `actorId`, `entityType`, and `audienceStrategy` as attributes.
- **Real-time delivery:** When new entries are ingested, the module must publish to the `presence` module's push channel for subscribed audiences to enable live feed updates.
- **Backpressure:** If ingestion capacity is saturated, event processing must defer or queue predictably rather than silently dropping events.
- **Dead-letter handling:** Failed ingestion records must remain queryable until the retry or review window expires.
- **Storage model:** Feed entries must be stored in a read-optimized durable projection, typically a sorted-set or append-only table with cursor pagination support.
- **Dependencies:** `follows` (FOLLOWERS audience resolution), `workspaces` (WORKSPACE audience resolution), `users` (actor display name resolution), `presence` (real-time push of new entries), `permissions` (PUBLIC_PROFILE visibility checks).
- **Errors:** `ACTIVITY_TYPE_NOT_FOUND` (only for `ingestEvent` when strict mode is enabled), `ENTRY_NOT_FOUND`, `FEED_AUDIENCE_INVALID`.
- **Providers (adapter examples):** Custom Redis-sorted-set implementation, Stream (GetStream.io), Knock, custom PostgreSQL fan-out with cursor pagination.
