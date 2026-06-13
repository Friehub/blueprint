# Module Contract: `data_catalog`

**Version:** 0.2.0

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
- `addLineage` must not create cycles in the lineage graph -- upstream + downstream must be a DAG
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
### Module-Specific Errors
```
registerDataset:
    dataset_already_exists:     A dataset with this name already exists in the domain | use a different name
    invalid_schema:             Dataset schema has invalid field definitions | fix FieldDef entries

  getDataset:
    dataset_not_found:          No dataset with that ID | verify dataset_id
    dataset_archived:           Dataset is archived | use include_archived flag to access

  addLineage:
    cycle_detected:             Adding this lineage would create a cycle in the graph | verify upstream/downstream
    dataset_not_found:          One or more datasets in lineage are not found | verify all dataset IDs

  tagDataset:
    dataset_not_found:          No dataset with that ID | verify dataset_id
    tag_required:               PII datasets must have at least one governance tag | add governance tag

  archiveDataset:
    already_archived:           Dataset is already archived | no action needed
```

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
    on_expiry:      N/A -- lineage is never purged

  Dataset staleness:
    duration:       90 days without update
    on_expiry:      flag dataset as potentially stale; notify owner
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `data_catalog.<function>`.
* **Telemetry Metrics:**
```
blueprint_data_catalog_datasets_total            { status }
  blueprint_data_catalog_searches_total            { result_count }
  blueprint_data_catalog_pii_datasets_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Storage Model
* **Model:** Strongly consistent catalog store with append-only lineage graph.
* **Details:** Dataset metadata and governance tags must be immediately consistent. Lineage entries are append-only and must support graph traversal queries.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE dataset_status AS ENUM ('active', 'archived');

CREATE TABLE data_catalog_datasets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  domain          TEXT NOT NULL,
  description     TEXT,
  schema_def      JSONB NOT NULL DEFAULT '[]',
  owner           TEXT NOT NULL,
  tags            TEXT[] NOT NULL DEFAULT '{}',
  pii             BOOLEAN NOT NULL DEFAULT false,
  status          dataset_status NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_catalog_dataset_name_domain ON data_catalog_datasets(name, domain);
CREATE INDEX idx_catalog_dataset_domain ON data_catalog_datasets(domain);
CREATE INDEX idx_catalog_dataset_tags ON data_catalog_datasets USING gin(tags);
CREATE INDEX idx_catalog_dataset_pii ON data_catalog_datasets(pii) WHERE pii = true;

CREATE TABLE data_catalog_lineage (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id      UUID NOT NULL REFERENCES data_catalog_datasets(id) ON DELETE CASCADE,
  source_id       UUID NOT NULL REFERENCES data_catalog_datasets(id),
  target_id       UUID NOT NULL REFERENCES data_catalog_datasets(id),
  transformation  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT lineage_no_self_loop CHECK (source_id <> target_id)
);

CREATE INDEX idx_catalog_lineage_source ON data_catalog_lineage(source_id);
CREATE INDEX idx_catalog_lineage_target ON data_catalog_lineage(target_id);
```

### Module Dependencies
* **Depends On:** data_warehouse
* **Emits To:** events
* **Recommends:** search, users
