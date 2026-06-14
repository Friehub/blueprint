# Module Contract: `export_pipeline`

**Version:** 0.2.1

---

### `export_pipeline`
Scheduled bulk data export with format conversion and delivery to external destinations.

**Functions**
```
defineExport(name, config) → Export
getExport(export_id) → Export
listExports() → Export[]
runExport(export_id) → ExportRun
getRunHistory(export_id, options?) → PaginatedResult<ExportRun>
cancelExport(run_id) → void
getExportFormats() → Format[]
validateDestination(destination) → ValidationResult
```

**Types**
```
Export { id, name, source, destination, format, schedule?, options: ExportOptions, created_at }
ExportRun { id, export_id, status: running|completed|failed|cancelled, duration_ms, records_exported, size_bytes, started_at, completed_at? }
Format { name: csv|parquet|json|jsonl|avro|xlsx, supports_compression, max_file_size }
ExportOptions { compression?, batch_size?, include_header?, filter?, columns?, max_file_size?, partitioning? }
ExportDestination { type: s3|gcs|azure_blob|sftp|email|webhook, config }
ValidationResult { destination, reachable: bool, writable: bool, capacity_ok: bool, error? }
ManifestEntry { file_name, size_bytes, record_count, checksum, created_at }
```

**Invariants**
- An export with a `schedule` must not run overlapping executions -- a new run must not start if the previous run is still active
- Exported files must include a manifest record with checksums so consumers can verify integrity
- `cancelExport` must stop the current batch at the next file boundary, not mid-record

**Providers:** custom, AWS Glue, Airbyte, Fivetran, Stitch

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Export data reflects a point-in-time snapshot; subsequent exports will contain newer data

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for export delivery events.
* **Details:** Duplicate delivery must be detected by the consumer using the manifest checksum.

### Worker Scaling
* **Policy:** Export execution, format conversion, and delivery must be independently scalable.

### Multi-Region Behavior
* **Mode:** Exports originate from the region where the data resides; the destination may be in a different region.
* **Details:** Cross-region export costs must be tracked and reported.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
defineExport:
    export_name_taken:        Export name already exists | use unique name
    unsupported_format:       Format not available for this source | check getExportFormats
    invalid_destination:      Destination is not reachable or writable | check validateDestination

  runExport:
    export_not_found:         Export configuration not found | check export_id
    overlapping_run:          Previous run is still active for this scheduled export | wait for completion
    export_timeout:           Export exceeded maximum duration | check source and destination

  cancelExport:
    run_not_active:           Export run is not in progress | check run status
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
runExport         → export.run.started          { export_id, run_id, destination }
                   → export.run.completed        { export_id, run_id, records_exported, size_bytes }
                    OR export.run.failed          { export_id, run_id, reason }
  cancelExport      → export.run.cancelled        { export_id, run_id }
  defineExport      → export.defined              { export_id, name, format, destination }
```

### Temporal Constraints
```
Export timeout:
    default:        2 hours
    on_expiry:      cancel run and mark as failed

  Scheduled export cadence:
    minimum:        15 minutes
    on_due:         trigger new export run

  Export run retention:
    retention:      configurable, default 90 days
    on_expiry:      eligible for archival
```

### Storage Model
* **Model:** Durable export configuration and run history.
* **Details:** Export definitions, run history, and manifest records must remain queryable for the configured retention period.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE export_definitions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  source            TEXT NOT NULL,
  destination       JSONB NOT NULL,
  format            TEXT NOT NULL,
  schedule          JSONB,
  options           JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE export_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  export_id         UUID NOT NULL REFERENCES export_definitions(id),
  status            TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  duration_ms       INT,
  records_exported  BIGINT DEFAULT 0,
  size_bytes        BIGINT DEFAULT 0,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE INDEX idx_export_runs_export ON export_runs(export_id, started_at DESC);
CREATE INDEX idx_export_runs_status ON export_runs(status) WHERE status = 'running';

CREATE TABLE export_manifests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            UUID NOT NULL REFERENCES export_runs(id),
  file_name         TEXT NOT NULL,
  size_bytes        BIGINT NOT NULL,
  record_count      BIGINT NOT NULL DEFAULT 0,
  checksum          TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_export_manifests_run ON export_manifests(run_id);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Overlapping scheduled runs | `overlapping_run` error | Block new run; queue for next cycle |
| Export destination unreachable | `invalid_destination` or provider timeout | Retry with backoff; alert operator after N failures |
| Corruption detected via checksum mismatch | Manifest checksum does not match file | Re-export affected files; flag for investigation |
| Export timeout exceeded | `export_timeout` error | Cancel run; retry with larger timeout or smaller batch |
| Format conversion failure | Partial output or conversion error | Log error; preserve source data for retry |

**Breaking Changes:** Removing a supported export format is breaking for existing exports using that format. Format removal must be deprecated with 2 release cycles notice. Changes to the manifest schema are breaking for consumers parsing manifest files.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `export_pipeline.<function>`.
* **Telemetry Metrics:**
```
blueprint_export_pipeline_runs_total            { status }
  blueprint_export_pipeline_records_total         { export_id }
  blueprint_export_pipeline_bytes_total            { export_id, format }
  blueprint_export_pipeline_duration_ms            histogram { export_id }
  blueprint_export_pipeline_overlap_blocked_total  { export_id }
  blueprint_export_pipeline_destination_fail_total { destination }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** storage
* **Emits To:** events
* **Recommends:** scheduled_tasks, notifications, reporting
