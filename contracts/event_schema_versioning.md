# Module Contract: `event_schema_versioning`

**Version:** 0.1.0

---

### `event_schema_versioning`
Event schema evolution standard for backward-compatible event format changes.

**Functions**
```
registerSchema(event_type: string, schema: EventSchema) → SchemaVersion
validateEvent(event_type: string, payload: any, version?: int) → ValidationResult
migrateEvent(payload: any, from_version: int, to_version: int) → any
getSchema(event_type: string, version?: int) → EventSchema
listVersions(event_type: string) → SchemaVersion[]
```

**Types**
```
EventSchema { event_type: string, version: int, fields: SchemaField[], required: string[], created_at: timestamp }
SchemaField { name: string, type: string, nullable?: bool, default?: any, deprecated?: bool, description?: string }
SchemaVersion { event_type: string, version: int, status: active | deprecated | sunset, changelog: string, created_at: timestamp }
ValidationResult { valid: bool, errors: ValidationError[] }
ValidationError { field: string, code: string, message: string }
```

**Invariants**
- Schema changes must be backward-compatible: only additive changes or new optional fields
- Consumers must declare supported version range; producers must emit within the range
- Removing a field requires deprecating it first for at least one minor version cycle
- `validateEvent` must reject events with unknown required fields or missing required fields
- `migrateEvent` must preserve all existing field values when migrating forward or backward
- Each event_type has exactly one active schema version at any time
- Deprecated schemas must remain valid for consumption until the sunset version

**Providers:** built-in schema registry, Schema Registry (Confluent), JSON Schema store, Protobuf descriptor registry

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Schema registration may take up to 5 seconds to propagate to all consumers

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once`
* **Details:** Schema validation occurs at both producer (write) and consumer (read) boundaries

### Worker Scaling
* **Policy:** Schema registry is read-heavy; reads are served from cache, writes go through leader

### Multi-Region Behavior
* **Mode:** Schema registry is global; all regions share the same schema versions
* **Details:** Writes are forwarded to the primary region; read replicas serve cached schemas

### Backpressure
* If the schema registry is unavailable, producers may emit events without validation using a cached schema; consumers reject unvalidatable events

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Schema-specific errors: `SCHEMA_NOT_FOUND`, `SCHEMA_BREAKING_CHANGE`, `VERSION_MISMATCH`, `MIGRATION_NOT_SUPPORTED`, `UNSUPPORTED_SCHEMA_VERSION`

### Event Emission
```
registerSchema    → schema.version.registered   { event_type, version, changelog }
validateEvent     → schema.event.validated      { event_type, version, valid }
validateEvent     → schema.event.rejected       { event_type, version, error_count }
migrateEvent      → schema.event.migrated       { event_type, from_version, to_version }
```

### Temporal Constraints
```
Schema version lifecycle:
    deprecation_after:   2 minor versions after replacement
    sunset_after:        4 minor versions after deprecation (or 90 days, whichever is longer)
    on_sunset:           reject events with sunset version; return VERSION_SUNSET
```

### Storage Model
* **Model:** Append-only schema registry with versioned entries
* **Details:** Schemas are stored as JSON Schema documents keyed by `(event_type, version)`

### Observability
* **Tracing Spans:** Every schema operation creates a span. Span names follow `schema.<function>`.
* **Telemetry Metrics:**
```
blueprint_schema_operation_total              counter { function, event_type, result }
blueprint_schema_operation_duration_ms        histogram { function }
blueprint_schema_active_versions             gauge { event_type }
blueprint_schema_deprecated_versions         gauge { event_type }
blueprint_schema_validation_errors_total     counter { event_type, error_code }
blueprint_schema_migrations_total            counter { event_type, from_version, to_version }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** audit_log

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE event_schemas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,
  version       INT NOT NULL,
  schema        JSONB NOT NULL,
  changelog     TEXT NOT NULL DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'sunset')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_type, version)
);

CREATE INDEX idx_schemas_event_type ON event_schemas(event_type, version DESC);
CREATE INDEX idx_schemas_status ON event_schemas(status);

CREATE TABLE consumer_schema_bindings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id   TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  min_version   INT NOT NULL,
  max_version   INT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (consumer_id, event_type)
);
```

### Breaking Change Policy
- Adding new optional fields is backward-compatible.
- Adding new required fields requires a MAJOR version bump.
- Removing a field requires deprecation for at least one release cycle, then MAJOR version bump.
- Changing a field type requires a MAJOR version bump.
- Deprecating a schema without providing a migration path is forbidden.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Breaking change detected | New schema removes or renames a field | Reject registration with SCHEMA_BREAKING_CHANGE |
| Consumer on unsupported version | Consumer declares range that excludes latest | Producer emits at consumer's max supported version; log warning |
| Missing schema | Event_type never registered | Reject with SCHEMA_NOT_FOUND; alert operator |
| Migration not supported | No migrator registered for version pair | Reject with MIGRATION_NOT_SUPPORTED; log audit event |
| Schema cache stale | Consumer reads old schema after new registration | Cache TTL of 30 seconds; force refresh on validation error |
