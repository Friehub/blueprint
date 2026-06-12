# Module Contract: `vector_store`

**Version:** 0.1.0

---

### `vector_store`
Vector embedding storage and retrieval with similarity search and metadata filtering.

**Functions**
```
upsertCollection(name, config) → Collection
deleteCollection(collection_id) → void
upsertVectors(collection_id, vectors) → IndexResult
deleteVectors(collection_id, ids) → void
search(collection_id, query_vector, options?) → SearchResult[]
getVector(collection_id, id) → VectorRecord?
getCollectionStats(collection_id) → CollectionStats
listCollections() → Collection[]
```

**Types**
```
Collection { id, name, dimension, metric: cosine|euclidean|dot_product, metadata_schema?, created_at }
VectorRecord { id, collection_id, vector: number[], metadata: Record<string, any>, created_at }
SearchResult { id, score, metadata, vector? }
IndexResult { collection_id, vectors_indexed, errors[] }
CollectionStats { name, vector_count, dimension, index_status: ready|building|failed, memory_usage_bytes }
SearchOptions { top_k?, min_score?, filter?, include_vector?, ef_search?, probes? }
CollectionConfig { dimension, metric, index_type: hnsw|ivf|flat, index_params? }
```

**Invariants**
- `search` must return results ordered by descending similarity score -- every result must include its score
- Vectors upserted to a collection must match the collection's declared dimension -- mismatched dimensions must be rejected
- A vector deleted from the store must be removed from the search index before the next search query returns

**Providers:** Chroma, Pinecone, Weaviate, Qdrant, Milvus, pgvector

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Vector index updates are asynchronous; search results reflect the most recent indexed state

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for vector upsert and deletion events.
* **Details:** Duplicate upserts with the same vector ID must update the existing vector (upsert semantics).

### Worker Scaling
* **Policy:** Vector ingestion, indexing, and search must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether the vector index is single-region or multi-region replicated.
* **Details:** Search queries must be routed to the nearest region; cross-region sync is eventual.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
upsertVectors:
    dimension_mismatch:      Vector dimension does not match collection dimension | reshape or use different collection

  search:
    collection_not_ready:    Index is building; search is not yet available | retry after index completion
    index_not_found:         No index exists for this collection | upsert vectors first
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Index build timeout:
    default:        30 minutes (for initial build)
    on_expiry:      mark index as failed; retry on next upsert

  Vector retention:
    default:        indefinite
    on_expiry:      collection-level configuration for automatic cleanup
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `vector_store.<function>`.
* **Telemetry Metrics:**
```
gensense_vector_store_collections_total           { status }
  gensense_vector_store_vectors_total              { collection_id }
  gensense_vector_store_search_latency_ms           histogram { collection_id }
  gensense_vector_store_index_memory_bytes          gauge { collection_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** embeddings
* **Emits To:** (none)
* **Recommends:** rag_pipeline, search
