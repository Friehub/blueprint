# Module Contract: `event_sourcing`

**Version:** 0.1.0

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
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
appendEvent        → eventsourcing.event.appended  { stream_id, event_type, version }
  buildProjection    → eventsourcing.projection.built { projection_id, name }
  rebuildProjection  → eventsourcing.projection.rebuilt { projection_id, events_processed }
```

### Temporal Constraints
```
Snapshot frequency:
    default:        every 100 events per stream
    on_threshold:   create snapshot automatically

  Projection rebuild timeout:
    default:        30 minutes
    on_expiry:      mark projection as failed; retry on next update
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `event_sourcing.<function>`.
* **Telemetry Metrics:**
```
gensense_event_sourcing_events_appended_total          { stream_id, event_type }
  gensense_event_sourcing_projections_building           gauge { projection_id }
  gensense_event_sourcing_snapshot_count                  gauge { stream_id }
  gensense_event_sourcing_rebuild_lag_ms                  gauge { projection_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** event_bus
* **Emits To:** events
* **Recommends:** snapshots (for Snapshot store), reporting (for projection querying)
