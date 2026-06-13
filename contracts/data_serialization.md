# Module Contract: `data_serialization`

**Version:** 0.2.1

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
### Module-Specific Errors
```
registerSchema:
    schema_already_exists:     A schema with this name and version already exists | use evolveSchema instead
    unsupported_format:        Serialization format is not supported | use json, protobuf, avro, msgpack, or yaml
    invalid_schema:            Schema definition failed validation | fix SchemaField entries

  evolveSchema:
    compatibility_violation:   Schema evolution violates the declared compatibility mode | adjust changes or relax mode
    field_number_conflict:     Protobuf field number reused after removal | mark removed field as reserved
    schema_not_found:          Base schema version not found | verify schema name and version

  validateCompatibility:
    schemas_not_comparable:    The two schemas are for different formats or unrelated | ensure same format and name

  migrateDocument:
    migration_not_supported:   Migration path from source to target version is not defined | ensure direct path exists
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
registerSchema     -> serialization.schema.registered  { name, version, format }
  evolveSchema       -> serialization.schema.evolved    { name, from_version, to_version, mode }
  validateCompatibility -> serialization.compatibility.checked { name, from, to, compatible }
```

### Temporal Constraints
```
Schema version retention:
    duration:       indefinite (schemas are immutable once registered)
    on_expiry:      N/A -- schemas are never deleted, only deprecated

  Schema deprecation grace period:
    default:        90 days
    on_expiry:      deprecated schema may be removed from active registry; existing data remains readable

  Compatibility cache TTL:
    default:        5 minutes
    on_expiry:      re-validate compatibility on next check
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `data_serialization.<function>`.
* **Telemetry Metrics:**
```
blueprint_data_serialization_schemas_total        { format }
  blueprint_data_serialization_evolutions_total     { mode, compatible }
  blueprint_data_serialization_validations_total    { mode, result }
  blueprint_data_serialization_migrations_total     { from_format, to_format }
  blueprint_data_serialization_validation_duration_ms histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** Strongly consistent schema registry with immutable version history.
* **Details:** Schema definitions are immutable once registered; each evolution creates a new version. The registry must support point-in-time queries for any schema version.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE serialization_format AS ENUM ('json', 'protobuf', 'avro', 'msgpack', 'yaml');
CREATE TYPE compatibility_mode AS ENUM ('backward', 'forward', 'full', 'none');

CREATE TABLE serialization_schemas (
  name              TEXT NOT NULL,
  version           INT NOT NULL,
  format            serialization_format NOT NULL,
  fields            JSONB NOT NULL,
  compatibility_mode compatibility_mode NOT NULL DEFAULT 'backward',
  checksum          TEXT NOT NULL,
  deprecated        BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (name, version)
);

CREATE INDEX idx_serialization_schemas_name ON serialization_schemas(name, version DESC);

CREATE TABLE serialization_reserved_field_numbers (
  schema_name   TEXT NOT NULL,
  version       INT NOT NULL,
  field_number  INT NOT NULL,
  PRIMARY KEY (schema_name, version, field_number),
  FOREIGN KEY (schema_name, version) REFERENCES serialization_schemas(name, version)
);

CREATE TABLE serialization_compatibility_cache (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schema_name     TEXT NOT NULL,
  from_version    INT NOT NULL,
  to_version      INT NOT NULL,
  mode            compatibility_mode NOT NULL,
  compatible      BOOLEAN NOT NULL,
  issues          JSONB NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '5 minutes'
);
```

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** config_schema, event_sourcing
