# Module Contract: `data_catalog`

**Version:** 0.1.0

---

### `data_catalog`
Dataset registration with schema description, lineage tracking, and governance tagging.

**Functions**
```
registerDataset(name, metadata) → Dataset
getDataset(dataset_id) → Dataset
listDatasets(tag?, domain?) → Dataset[]
updateDataset(dataset_id, changes) → Dataset
addLineage(dataset_id, upstream, downstream) → void
getLineage(dataset_id) → LineageGraph
tagDataset(dataset_id, tags) → void
searchDatasets(query) → DatasetSearchResult[]
archiveDataset(dataset_id, reason) → void
```

**Types**
```
Dataset { id, name, domain, description, schema: FieldDef[], owner, tags, status: active|archived, created_at, last_updated }
FieldDef { name, type, description, pii: bool, classification, nullable }
LineageGraph { dataset_id, upstream: DatasetRef[], downstream: DatasetRef[] }
DatasetRef { id, name, domain, transformation? }
DatasetSearchResult { dataset_id, name, domain, match_score, match_field }
LineageEntry { dataset_id, source, target, transformation, created_at }
```

**Invariants**
- A dataset marked as containing PII must have at least one governance tag specifying the data classification
- `addLineage` must not create cycles in the lineage graph — upstream + downstream must be a DAG
- Archived datasets must not appear in search results by default

**Providers:** Amundsen, DataHub, Atlan, Alation, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Dataset metadata and lineage must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for catalog lifecycle events.
* **Details:** Duplicate dataset registration must be idempotent (return existing dataset).

### Worker Scaling
* **Policy:** Dataset registration, search, and lineage traversal must be independently scalable.

### Multi-Region Behavior
* **Mode:** The catalog is typically global; datasets may have regional data residency tags.
* **Details:** A dataset's region tags must match the data_residency module's declared rules.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
registerDataset   → catalog.dataset.registered  { dataset_id, name, domain }
  addLineage        → catalog.lineage.added       { dataset_id, upstream_count, downstream_count }
  archiveDataset    → catalog.dataset.archived     { dataset_id, reason }
```

### Temporal Constraints
```
Lineage retention:
    duration:       indefinite (lineage is append-only)
    on_expiry:      N/A — lineage is never purged

  Dataset staleness:
    duration:       90 days without update
    on_expiry:      flag dataset as potentially stale; notify owner
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `data_catalog.<function>`.
* **Telemetry Metrics:**
```
gensense_data_catalog_datasets_total            { status }
  gensense_data_catalog_searches_total            { result_count }
  gensense_data_catalog_pii_datasets_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** data_warehouse
* **Emits To:** events
* **Recommends:** search, users
