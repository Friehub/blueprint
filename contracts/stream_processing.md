# Module Contract: `stream_processing`

**Version:** 0.1.0

---

### `stream_processing`
Real-time stream transformation with window aggregation and output sinks.

**Functions**
```
defineStream(name, source, config) → Stream
getStream(stream_id) → Stream
listStreams() → Stream[]
startStream(stream_id) → void
stopStream(stream_id) → void
applyTransformation(stream_id, transform) → void
addSink(stream_id, sink_config) → void
getStreamMetrics(stream_id) → StreamMetrics
getLag(stream_id) → LagReport
```

**Types**
```
Stream { id, name, source, status: stopped|running|degraded|failed, transforms: TransformDef[], sinks: SinkDef[], created_at }
TransformDef { name, type: filter|map|aggregate|window, config, parallelism }
SinkDef { name, destination, type, config, batch_size? }
WindowConfig { type: tumbling|sliding|session, duration, slide?, grace_period? }
StreamMetrics { events_in, events_out, events_failed, throughput, avg_latency_ms }
LagReport { stream_id, source_lag_ms, sink_lag_ms, per_partition: PartitionLag[] }
PartitionLag { partition, current_offset, latest_offset, lag }
StreamConfig { checkpoint_interval?, max_parallelism?, error_handling?, exactly_once? }
```

**Invariants**
- A stopped stream must checkpoint its current offset before shutdown so it can resume from the correct position
- `applyTransformation` on a running stream must not affect in-flight events -- the new transform applies only to events received after activation
- Events that fail processing must be sent to a dead-letter sink, not silently dropped

**Providers:** Kafka Streams, Flink, Spark Streaming, Kinesis Data Analytics, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Stream processing state is distributed; checkpoint offsets are eventually consistent across workers

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` by default; `exactly_once` if configured and supported by the provider.
* **Details:** Output sinks must be idempotent to handle at-least-once delivery.

### Worker Scaling
* **Policy:** Stream parallelism must be independently scalable per stream and per transform.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether stream processing is single-region or multi-region replicated.
* **Details:** Cross-region stream processing requires source replication or a global event bus.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If a sink is slower than the source, the stream must apply backpressure and report increased lag rather than dropping events.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* The stream is a consumer and producer of events; its lifecycle events are emitted.

### Temporal Constraints
```
Checkpoint interval:
    default:        10 seconds
    on_expiry:      force checkpoint; resuming from last checkpoint may reprocess events

  Window grace period:
    default:        5 minutes
    on_expiry:      late events for the window are discarded
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `stream_processing.<function>`.
* **Telemetry Metrics:**
```
gensense_stream_processing_events_in_total        { stream_id }
  gensense_stream_processing_events_out_total       { stream_id }
  gensense_stream_processing_lag_ms                 gauge { stream_id, partition }
  gensense_stream_processing_latency_ms             histogram { stream_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** event_bus
* **Emits To:** events
* **Recommends:** storage, reporting
