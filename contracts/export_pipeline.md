# Module Contract: `export_pipeline`

**Version:** 0.1.0

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
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
runExport         → export.run.started          { export_id, run_id, destination }
                   → export.run.completed        { export_id, run_id, records_exported, size_bytes }
                   OR export.run.failed          { export_id, run_id, reason }
  cancelExport      → export.run.cancelled        { export_id, run_id }
```

### Temporal Constraints
```
Export timeout:
    default:        2 hours
    on_expiry:      cancel run and mark as failed

  Scheduled export cadence:
    minimum:        15 minutes
    on_due:         trigger new export run
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `export_pipeline.<function>`.
* **Telemetry Metrics:**
```
gensense_export_pipeline_runs_total            { status }
  gensense_export_pipeline_records_total         { export_id }
  gensense_export_pipeline_bytes_total            { export_id, format }
  gensense_export_pipeline_duration_ms            histogram { export_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** storage
* **Emits To:** events
* **Recommends:** scheduled_tasks, notifications, reporting
