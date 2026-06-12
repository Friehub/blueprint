# Module Contract: `data_serialization`

**Version:** 0.1.0

---

### `data_serialization`
Schema evolution rules, backward/forward compatibility, and wire format versioning.

**Functions**
```
registerSchema(name, schema, format) → SchemaVersion
getSchema(name, version?) → SchemaVersion?
evolveSchema(name, changes, compatibility) → SchemaVersion
validateCompatibility(old_schema, new_schema, mode) → CompatibilityReport
detectFieldNumberConflict(proto_schema) → ConflictReport
migrateDocument(doc, from_version, to_version) → MigratedDocument
```

**Types**
```
SchemaVersion { name, version, fields: SchemaField[], format, compatibility_mode, checksum }
SchemaField { name, number?, type, required, deprecated?, description }
CompatibilityReport { compatible: bool, issues: CompatibilityIssue[], mode }
CompatibilityIssue { field, type: removed|renamed|type_changed|required_added, severity: break|warning }
MigratedDocument { document, from_version, to_version, warnings[] }
SerializationFormat = json | protobuf | avro | msgpack | yaml
SchemaEvolutionMode = backward | forward | full | none
ProtobufFieldRule = optional | required | repeated
```

**Invariants**
- `evolveSchema` with mode `backward` must not remove any field that existing consumers depend on -- adding new fields is permitted, removing or changing existing fields is not
- `evolveSchema` with mode `forward` must not add any required field -- consumers written against the old schema must be able to read data written with the new schema
- A protobuf field number must never be reused after a field is removed -- the removed field number must be marked as `reserved` in the schema definition
- `validateCompatibility` with mode `full` must pass both backward AND forward checks -- a schema that passes both can safely evolve in either direction

**Providers:** Protobuf, Apache Avro, MessagePack, JSON Schema, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Schema definitions must be immediately consistent per registry

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for schema lifecycle events.
* **Details:** Duplicate schema registration must be idempotent (update existing).

### Worker Scaling
* **Policy:** Schema validation is CPU-bound and should be cached per schema.

### Multi-Region Behavior
* **Mode:** Schema registry is global; all regions must use the same schema version.
* **Details:** Schema evolution must be coordinated across regions before deployment.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
registerSchema     -> serialization.schema.registered  { name, version, format }
  evolveSchema       -> serialization.schema.evolved    { name, from_version, to_version, mode }
  validateCompatibility -> serialization.compatibility.checked { name, from, to, compatible }
```

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `data_serialization.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** config_schema, event_sourcing
