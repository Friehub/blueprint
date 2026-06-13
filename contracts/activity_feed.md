# Module: activity_feed

**Version:** 0.2.1
**Part:** V -- Real-Time and Social

## Purpose

Defines the interface for aggregating and serving a cross-domain activity timeline. An activity feed is a chronological stream of significant events produced by other domain modules, projected into a human-readable feed for a specific audience -- a user's own actions, the actions of users they follow, or the activity within a shared workspace. This module is a read-optimised projection layer. It does not originate events -- it consumes events from other modules and stores denormalised feed entries for low-latency retrieval.

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
Accepts a domain event and writes one or more feed entries based on the registered activity type's audience strategy. This is the write path -- called by event consumers, not by end users.

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

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Feed writes are eventually consistent. The acceptable lag between a source event and feed entry availability is ≤ 2 seconds under normal load.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for event ingestion.
* **Details:** Duplicate source events must not create duplicate feed entries (idempotent on `idempotencyKey`).

### Worker Scaling
* **Policy:** Feed ingestion and feed query paths must be independently scalable.

### Multi-Region Behavior
* **Mode:** If feed ingestion is active/active, duplicate event processing across regions must be deduplicated by `idempotencyKey`.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `ingestEvent(input, idempotency_key?)`
  - `hideEntry(entryId, reason?, idempotency_key?)`
  - `unhideEntry(entryId, idempotency_key?)`
  - `deleteEntriesByActor(actorId, idempotency_key?)`
  - `deleteEntriesByEntity(entityRef, idempotency_key?)`

### Backpressure
* If ingestion capacity is saturated, event processing must defer or queue predictably rather than silently dropping events.

### Dead-Letter Handling
* Failed ingestion records must remain queryable until the retry or review window expires.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Domain errors: `ACTIVITY_TYPE_NOT_FOUND` (only for `ingestEvent` when strict mode is enabled), `ENTRY_NOT_FOUND`, `FEED_AUDIENCE_INVALID`, `FEED_ENTRY_HIDDEN`, `ACTOR_DELETION_IN_PROGRESS`.

### Event Emission
* This module consumes events from other modules; it does not emit new domain events to avoid recursive feed loops. Internal observability events (e.g. `feed.entry.ingested`) are emitted to the tracing layer only, not to the event bus.

### Temporal Constraints
```
Feed entry:
    retention:          90 days (configurable per tenant)
    on_expiry:          eligible for deletion

    hide_window:
        hide:           immediate visibility toggle
        hard_delete:    not supported; preserve for audit

Actor deletion:
    processing_window:  7 days
    on_expiry:          force-complete if entries remain; log for operator

Cursor:
    stability window:   24 hours
    on_expiry:          cursor may return stale results; retry from new cursor
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE activity_types (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name        TEXT NOT NULL UNIQUE,
  source_module     TEXT NOT NULL,
  display_template  TEXT NOT NULL,
  audience_strategy TEXT NOT NULL CHECK (audience_strategy IN ('ACTOR_ONLY', 'FOLLOWERS', 'WORKSPACE', 'ENTITY_WATCHERS', 'PUBLIC')),
  icon              TEXT,
  groupable         BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feed_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_type_id  UUID NOT NULL REFERENCES activity_types(id),
  event_name        TEXT NOT NULL,
  actor_id          UUID,
  actor_type        TEXT DEFAULT 'user',
  actor_display_name TEXT,
  entity_type       TEXT,
  entity_id         TEXT,
  workspace_id      UUID,
  rendered_text     TEXT NOT NULL,
  data              JSONB NOT NULL DEFAULT '{}',
  visible           BOOLEAN NOT NULL DEFAULT true,
  occurred_at       TIMESTAMPTZ NOT NULL,
  ingested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  group_key         TEXT,
  idempotency_key   TEXT NOT NULL
);

CREATE INDEX idx_feed_entries_actor ON feed_entries(actor_id, occurred_at DESC) WHERE visible AND actor_id IS NOT NULL;
CREATE INDEX idx_feed_entries_workspace ON feed_entries(workspace_id, occurred_at DESC) WHERE visible AND workspace_id IS NOT NULL;
CREATE INDEX idx_feed_entries_entity ON feed_entries(entity_type, entity_id, occurred_at DESC) WHERE visible;
CREATE INDEX idx_feed_entries_group ON feed_entries(group_key, occurred_at DESC) WHERE group_key IS NOT NULL;
CREATE UNIQUE INDEX idx_feed_entries_idempotency ON feed_entries(idempotency_key);
CREATE INDEX idx_feed_entries_ingested_at ON feed_entries(ingested_at) WHERE visible;

CREATE TABLE feed_entry_hides (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id          UUID NOT NULL REFERENCES feed_entries(id) ON DELETE CASCADE,
  reason            TEXT,
  hidden_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entry_id)
);
```

### Storage Model
* **Model:** Read-optimized durable projection with append-only feed entries.
* **Details:** Feed entries must be stored in a read-optimized durable projection, typically a sorted-set or append-only table with cursor pagination support. Indexed for audience-based queries (actor, workspace, entity).

### Observability
* **Tracing Spans:** `ingestEvent` spans must carry `eventName`, `actorId`, `entityType`, and `audienceStrategy` as attributes. Every function call creates a span following `activity_feed.<function>`.
* **Telemetry Metrics:**
```
blueprint_activity_feed_operation_total              counter { function, result }
blueprint_activity_feed_operation_duration_ms        histogram { function }
blueprint_activity_feed_errors_total                 counter { function, error_code }
blueprint_activity_feed_entries_ingested_total        counter { event_name, audience_strategy }
blueprint_activity_feed_entries_served_total          counter { audience }
blueprint_activity_feed_ingestion_lag_ms              gauge
blueprint_activity_feed_hidden_entries_total
```
* **SLO Targets:** Feed query P99 ≤ 50ms; ingestion write P99 ≤ 200ms; ingestion-to-read visibility ≤ 2 seconds.

### Module Dependencies
* **Depends On:** follows, workspaces, users, presence, permissions
* **Emits To:** (none — events consumed only)
* **Recommends:** notifications (digest generation), search (feed entry indexing)

### Breaking Change Policy
- Adding a new `AudienceStrategy` value is additive and backward-compatible.
- Removing or renaming an existing audience strategy requires a MAJOR version bump.
- Changing the `displayTemplate` rendering behavior for existing entries requires a MAJOR version bump (entries are immutable after render).
- Adding new required fields to `RegisterActivityTypeInput` requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Duplicate feed entry | Re-delivered event with same idempotencyKey | UNIQUE constraint on idempotency_key silently prevents duplicate |
| Template rendering error | Missing field in event payload | Render empty string for missing variable; log warning |
| Feed query timeout | Unindexed audience filter | Require index on query filter columns; log slow query |
| Actor deletion partial failure | Some entries fail to delete | Log failed entry IDs; retry with backoff; escalate after 3 attempts |
| Ingestion lag exceeds SLO | Event burst exceeds capacity | Buffer in queue; scale ingestion workers; emit lag alert |
