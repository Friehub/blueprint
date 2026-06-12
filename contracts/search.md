# Module Contract: `search`

**Version:** 0.1.0

---

### `search`
Full-text and faceted search across documents.

**Functions**
```
indexDocument(index, id, document) → void
indexBulk(index, documents) → BulkIndexResult
removeDocument(index, id) → void
search(index, query, options?) → SearchResult
multiSearch(queries) → SearchResult[][]
suggest(index, partial, field, options?) → Suggestion[]
reindex(index) → ReindexJob
getIndexStats(index) → IndexStats
createIndex(name, config) → Index
deleteIndex(name) → void
```

**Types**
```
SearchResult { hits: Hit[], total, facets?, took_ms }
Hit { id, document, score, highlights? }
SearchOptions { filters?, facets?, sort?, page?, per_page?, geo? }
IndexStats { document_count, index_size, last_updated }
```

**Invariants**
- `indexDocument` must be idempotent -- re-indexing the same document must update, not duplicate
- Facet values in `search` must reflect the document state at index time; stale facet counts are acceptable within the index freshness window
- `multiSearch` must execute all queries within the same index snapshot; results across queries are consistent within a single point-in-time
- Filter values in `SearchOptions.filters` must use exact match semantics unless a wildcard or range operator is explicitly specified in the filter definition
- Index freshness SLA: indexed documents must be searchable within `max_lag` seconds (configurable per index, default 30s)

**Providers:** Typesense, Algolia, Meilisearch, Elasticsearch, PostgreSQL full-text

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Index updates are eventually reflected in search results

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for indexing pipelines.
* **Details:** Duplicate indexing requests must update existing documents rather than create duplicates.

### Worker Scaling
* **Policy:** Indexing, reindexing, and query serving must be independently scalable when the provider supports it.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If indexing lag or reindex pressure is high, the module must buffer or defer predictably rather than silently dropping documents.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Index freshness:
    max_lag:          configurable by deployment
    on_exceed:        surface stale-read condition in observability
```

### Storage Model
* **Model:** Search index / inverted index / vector-backed retrieval store.
* **Details:** The backing store may be managed or self-hosted, but queryability and refresh semantics must be documented by the adapter.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `search.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`blueprint_<module>_operation_total`, `blueprint_<module>_operation_duration_ms`, `blueprint_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** (none -- wraps external provider)
* **Emits To:** (none)
* **Recommends:** (none)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `score DESC` (relevance first) on `search`.
