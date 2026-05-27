# Module Contract: `search`

---

### `search`
Full-text and faceted search across documents.

**Functions**
```
indexDocument(index, id, document) → void
indexBulk(index, documents) → BulkIndexResult
removeDocument(index, id) → void
search(index, query, options?) → SearchResult
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
- `indexDocument` must be idempotent — re-indexing the same document must update, not duplicate

**Providers:** Typesense, Algolia, Meilisearch, Elasticsearch, PostgreSQL full-text

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Index updates are eventually reflected in search results

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `search.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — wraps external provider)
* **Emits To:** (none)
* **Recommends:** (none)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `score DESC` (relevance first) on `search`.
