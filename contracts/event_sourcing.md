# Module Contract: `event_sourcing`

**Version:** 0.2.1

---

### `event_sourcing`
Event store append, projection, replay, and snapshot management.

**Functions**
```
appendEvent(stream_id, event) → EventRecord
appendEvents(stream_id, events) → EventRecord[]
readStream(stream_id, options?) → EventRecord[]
readStreamFrom(stream_id, after_version, options?) → EventRecord[]
buildProjection(projection_name, handler, options?) → Projection
rebuildProjection(projection_id) → void
createSnapshot(stream_id, version) → Snapshot
getSnapshot(stream_id) → Snapshot?
subscribeToStream(stream_id, handler) → Subscription
```

**Types**
```
EventRecord { id, stream_id, version, event_type, data, metadata, timestamp }
StreamId { type, id }
Projection { id, name, handler, current_version, status: building|active|stale }
Snapshot { stream_id, version, state, created_at }
ReplayOptions { from_version?, to_version?, batch_size?, parallel? }
ProjectionHandler { handle(event), reset(), getState() }
```

**Invariants**
- `appendEvent` must assign monotonically increasing version numbers per stream -- no version gaps are permitted within a stream
- A projection must process events in version order -- processing a version `N+1` event before version `N` is a contract violation
- `rebuildProjection` must reset the projection state and replay all events from the beginning of the stream, or from the latest snapshot if one exists
- A snapshot must store the complete stream state up to the snapshot's version -- replaying from a snapshot must produce the same projection as replaying all events from the beginning

**Dependencies:** event_bus

**Providers:** EventStoreDB, PostgreSQL, Kafka, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` for event append; `eventual` for projections
* **Details:** Events are appended with strong consistency. Projections are eventually consistent by nature.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for event delivery to projections.
* **Details:** Projections must be idempotent -- processing the same event twice must produce the same state.

### Worker Scaling
* **Policy:** Event append, projection building, and snapshot management must be independently scalable per stream.

### Multi-Region Behavior
* **Mode:** Event streams are single-region; cross-region event replication requires an event bus bridge.
* **Details:** A projection must run in the same region as the stream it reads from.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
appendEvent:
    stream_not_found:         Stream does not exist | create stream first
    version_conflict:         Event version does not match expected next version | retry with correct version
    event_type_unknown:       Event type not registered for this stream | use registered type

  buildProjection:
    projection_already_exists: Projection name already in use | use unique name
    handler_invalid:           Projection handler does not implement required interface | fix handler

  rebuildProjection:
    rebuild_in_progress:       Projection is already being rebuilt | wait for completion
    rebuild_timeout:           Rebuild exceeded maximum duration | retry; consider snapshot
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
appendEvent        → eventsourcing.event.appended  { stream_id, event_type, version }
  buildProjection    → eventsourcing.projection.built { projection_id, name }
  rebuildProjection  → eventsourcing.projection.rebuilt { projection_id, events_processed }
  createSnapshot     → eventsourcing.snapshot.created  { stream_id, version }
  subscribeToStream  → eventsourcing.subscription.created { stream_id, subscription_id }
```

### Temporal Constraints
```
Snapshot frequency:
    default:        every 100 events per stream
    on_threshold:   create snapshot automatically

  Projection rebuild timeout:
    default:        30 minutes
    on_expiry:      mark projection as failed; retry on next update

  Event retention:
    retention:      configurable per stream, default indefinite
    on_expiry:      compact older events when snapshot exists
```

### Storage Model
* **Model:** Append-only event store with snapshot cache.
* **Details:** Events are immutable after append. Snapshots are materialized views of stream state at a given version.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE es_streams (
  id                TEXT PRIMARY KEY,
  stream_type       TEXT NOT NULL,
  current_version   INT NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE es_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id         TEXT NOT NULL REFERENCES es_streams(id),
  version           INT NOT NULL CHECK (version > 0),
  event_type        TEXT NOT NULL,
  data              JSONB NOT NULL,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stream_id, version)
);

CREATE INDEX idx_es_events_stream_ver ON es_events(stream_id, version);
CREATE INDEX idx_es_events_stream_created ON es_events(stream_id, created_at);

CREATE TABLE es_projections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  handler           TEXT NOT NULL,
  current_version   INT NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('building', 'active', 'stale')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE es_snapshots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id         TEXT NOT NULL REFERENCES es_streams(id),
  version           INT NOT NULL,
  state             JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stream_id, version)
);

CREATE INDEX idx_es_snapshots_stream ON es_snapshots(stream_id, version DESC);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Event version conflict on append | `version_conflict` error | Client must read stream head and retry append |
| Projection rebuild timeout | `rebuild_timeout` error | Check snapshot exists; retry rebuild with snapshot |
| Snapshot out of sync with stream | Projection state diverges | Rebuild from zero; compare snapshot with event replay |
| Event stream compaction removes needed events | Projection cannot replay from beginning | Ensure snapshots exist before compaction; maintain archive |

**Breaking Changes:** Changing the event type schema is breaking. New event types are non-breaking. Removing an event type that a projection depends on is breaking. Projection handler interface changes are breaking for all projections.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `event_sourcing.<function>`.
* **Telemetry Metrics:**
```
blueprint_event_sourcing_events_appended_total          { stream_id, event_type }
  blueprint_event_sourcing_projections_building           gauge { projection_id }
  blueprint_event_sourcing_snapshot_count                  gauge { stream_id }
  blueprint_event_sourcing_rebuild_lag_ms                  gauge { projection_id }
  blueprint_event_sourcing_version_conflict_total          { stream_id }
  blueprint_event_sourcing_stream_size_bytes              gauge { stream_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** event_bus
* **Emits To:** events
* **Recommends:** snapshots (for Snapshot store), reporting (for projection querying)
