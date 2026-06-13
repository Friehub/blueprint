# Module Contract: `rag_pipeline`

**Version:** 0.2.1

---

### `rag_pipeline`
Full retrieval-augmented generation pipeline: chunking, embedding, storage, retrieval with reranking.

**Functions**
```
ingestDocument(source, content, options?) → DocumentRecord
chunkDocument(document_id, strategy) → Chunk[]
embedChunk(chunk_id) → EmbeddingResult
indexDocument(document_id) → IndexResult
search(query, options?) → PaginatedResult<SearchResult>
rerank(query, results, top_n) → RankedResult[]
getDocument(document_id) → DocumentRecord?
deleteDocument(document_id) → void
getIndexStats() → IndexStats
```

**Types**
```
DocumentRecord { id, source, content_type, title, chunk_count, status: pending|indexed|failed, created_at }
Chunk { id, document_id, index, content, token_count, embedding_id }
EmbeddingResult { chunk_id, embedding_id, model, dimensions, duration_ms }
IndexResult { document_id, chunks_indexed, duration_ms }
SearchResult { chunk_id, document_id, content, score, source }
RankedResult { chunk_id, score, rerank_score, content, source }
SearchOptions { top_k?, min_score?, filter?, strategy: semantic|hybrid, rerank?, include_content? }
RerankOptions { model?, top_n }
IndexStats { total_documents, total_chunks, indexed_chunks, failed_chunks, last_indexed_at }
ChunkStrategy = fixed_size | recursive | semantic | sentence
```

**Invariants**
- `search` must return results ordered by descending relevance score -- it must never return results without a score
- A document must be fully chunked and embedded before it appears in search results
- `rerank` must not return more results than were provided; it may return fewer

**Providers:** custom, LangChain, LlamaIndex, Chroma, Pinecone, Weaviate, Qdrant, Cohere (rerank)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Document ingestion is asynchronous; search results reflect the most recent indexed state, not the most recent ingested state

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for document ingestion and indexing events.
* **Details:** Duplicate ingestion of the same document must be idempotent (replace existing).

### Worker Scaling
* **Policy:** Document ingestion, chunking, embedding, and search must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether the vector index is single-region or multi-region replicated.
* **Details:** Search queries must be routed to the nearest region; cross-region sync is eventual.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If the embedding API is saturated, ingestion must queue and retry rather than dropping documents.

### Error Taxonomy
### Module-Specific Errors
```
ingestDocument:
    unsupported_content_type:  Document content type is not supported | convert to supported format
    document_too_large:        Document exceeds maximum size | split before ingestion

  search:
    index_not_ready:           Vector index has not been initialized | wait for indexing to complete
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
ingestDocument   → rag.document.ingested       { document_id, source, chunk_count }
  indexDocument    → rag.document.indexed        { document_id, chunks_indexed }
                 OR rag.document.index_failed   { document_id, reason }
  deleteDocument   → rag.document.deleted        { document_id }
```

### Temporal Constraints
```
Ingestion timeout per document:
    default:        5 minutes
    on_expiry:      mark document as failed

  Embedding cache TTL:
    duration:       24 hours  (cached embeddings for unchanged chunks)
    on_expiry:      re-embed on next search or scheduled refresh
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `rag_pipeline.<function>`.
* **Telemetry Metrics:**
```
blueprint_rag_pipeline_documents_ingested_total    { status }
  blueprint_rag_pipeline_chunks_indexed_total       { status }
  blueprint_rag_pipeline_search_latency_ms           histogram
  blueprint_rag_pipeline_search_results_total        histogram
  blueprint_rag_pipeline_rerank_latency_ms           histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** embeddings, vector_store
* **Emits To:** events
* **Recommends:** llm_gateway (for generation), prompt_registry (for prompt templates)
