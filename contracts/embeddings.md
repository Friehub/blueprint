# Module: embeddings

**Version:** 0.2.0
**Part:** III -- Data and State

## Purpose

Defines the interface for generating, storing, indexing, and querying vector embeddings. An embedding is a numerical vector representation of a piece of content (text, image, or structured data) produced by a machine learning model. Embeddings enable semantic similarity search, recommendation, clustering, and retrieval-augmented generation (RAG). This module owns the embedding lifecycle -- generation, upsert into the vector index, similarity query, and deletion -- independent of the embedding model or vector store used. It is a first-class infrastructure module for any system implementing AI-native features.

---

## Functions

### `createIndex(input: CreateIndexInput) → EmbeddingIndex`
Creates a named vector index with a specific dimensionality and distance metric. An index is bound to one embedding model family at creation.

### `getIndex(indexId: EmbeddingIndexId) → EmbeddingIndex`
Returns index metadata, vector count, and status.

### `listIndexes(input: ListIndexesInput) → PaginatedList<EmbeddingIndex>`
Lists all indexes.

### `deleteIndex(indexId: EmbeddingIndexId) → void`
Deletes an index and all its vectors. Irreversible.

### `embed(input: EmbedInput) → Embedding`
Generates a vector embedding for a given content payload using the model configured for the target index. Returns the embedding without storing it.

### `upsertVector(input: UpsertVectorInput) → Vector`
Generates an embedding for the content and stores it in the index, keyed by a caller-supplied `vectorId`. Idempotent: upserting an existing `vectorId` replaces the prior vector.

### `upsertVectorBatch(input: UpsertVectorBatchInput) → BatchUpsertResult`
Upserts multiple vectors in a single call. Returns success/failure per item.

### `getVector(indexId: EmbeddingIndexId, vectorId: VectorId) → Vector`
Returns a stored vector and its metadata by ID.

### `deleteVector(indexId: EmbeddingIndexId, vectorId: VectorId) → void`
Removes a vector from the index.

### `deleteVectorsByFilter(input: DeleteByFilterInput) → DeleteResult`
Removes all vectors matching a metadata filter. Used for bulk entity deletion (e.g. when a document is deleted, remove all its chunk embeddings).

### `querySimilar(input: SimilarityQueryInput) → SimilarityResult[]`
Performs approximate nearest-neighbour (ANN) search against the index. Returns the top-K most similar vectors with their distance scores.

### `queryByText(input: TextQueryInput) → SimilarityResult[]`
Generates an embedding for the query text on-the-fly and performs ANN search. Convenience method combining `embed` and `querySimilar`.

### `hybridQuery(input: HybridQueryInput) → SimilarityResult[]`
Combines vector similarity with keyword/metadata filters. Returns results where both the semantic similarity and the filter conditions are satisfied.

---

## Types

```typescript
type EmbeddingIndexId = string;
type VectorId = string;

type DistanceMetric = "COSINE" | "EUCLIDEAN" | "DOT_PRODUCT";

type EmbeddingModel =
  | "text-embedding-3-small"
  | "text-embedding-3-large"
  | "text-embedding-ada-002"
  | string;                        // Open string to support custom / local models

type IndexStatus = "CREATING" | "READY" | "UPDATING" | "DELETING";

type CreateIndexInput = {
  name: string;
  dimensions: number;              // Must match the output dimensionality of the configured model
  distanceMetric: DistanceMetric;
  model: EmbeddingModel;
  description?: string;
  metadata?: Record<string, unknown>;
};

type EmbeddingIndex = {
  indexId: EmbeddingIndexId;
  name: string;
  dimensions: number;
  distanceMetric: DistanceMetric;
  model: EmbeddingModel;
  vectorCount: number;
  status: IndexStatus;
  description?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type ContentPayload = {
  type: "TEXT" | "IMAGE_URL";
  value: string;
};

type EmbedInput = {
  indexId: EmbeddingIndexId;
  content: ContentPayload;
};

type Embedding = {
  vector: number[];
  model: EmbeddingModel;
  dimensions: number;
  tokenCount?: number;
};

type UpsertVectorInput = {
  indexId: EmbeddingIndexId;
  vectorId: VectorId;
  content: ContentPayload;         // Source content; the module generates the embedding
  metadata?: Record<string, unknown>; // Arbitrary filterable metadata (e.g. entityType, entityId, locale)
};

type Vector = {
  vectorId: VectorId;
  indexId: EmbeddingIndexId;
  vector: number[];                // Stored embedding values
  metadata?: Record<string, unknown>;
  upsertedAt: Timestamp;
};

type UpsertVectorBatchInput = {
  indexId: EmbeddingIndexId;
  vectors: Omit<UpsertVectorInput, "indexId">[];
};

type BatchUpsertResult = {
  succeeded: VectorId[];
  failed: { vectorId: VectorId; error: string }[];
};

type MetadataFilter = {
  field: string;
  operator: "eq" | "neq" | "in" | "gt" | "lt" | "exists";
  value?: unknown;
};

type SimilarityQueryInput = {
  indexId: EmbeddingIndexId;
  queryVector: number[];
  topK: number;
  minScore?: number;               // Minimum similarity score (0.0 -- 1.0)
  filter?: MetadataFilter[];
  includeVector?: boolean;         // Whether to return the raw vector in results
  includeMetadata?: boolean;
};

type TextQueryInput = {
  indexId: EmbeddingIndexId;
  queryText: string;
  topK: number;
  minScore?: number;
  filter?: MetadataFilter[];
  includeMetadata?: boolean;
};

type HybridQueryInput = TextQueryInput & {
  keywordQuery?: string;           // Optional BM25/keyword component
  vectorWeight?: number;           // 0.0--1.0; weight given to semantic vs keyword score
};

type SimilarityResult = {
  vectorId: VectorId;
  score: number;                   // Normalised similarity score (0.0 = least, 1.0 = most similar)
  vector?: number[];
  metadata?: Record<string, unknown>;
};

type DeleteByFilterInput = {
  indexId: EmbeddingIndexId;
  filter: MetadataFilter[];
};

type DeleteResult = {
  deletedCount: number;
};

type ListIndexesInput = {
  pagination: PaginationInput;
};
```

---

## Invariants

1. The `dimensions` of a `UpsertVectorInput` vector must match the `dimensions` declared on the index; mismatched vectors return `DIMENSION_MISMATCH`.
2. `upsertVector` is idempotent on `(indexId, vectorId)`; upserting the same ID replaces the previous vector and metadata.
3. `querySimilar` with a `queryVector` whose dimension differs from the index dimension returns `DIMENSION_MISMATCH`.
4. `topK` must be between 1 and 1000 inclusive; values outside this range return `INVALID_TOP_K`.
5. Metadata values used in `MetadataFilter` must be of scalar types (string, number, boolean, or string array); nested objects as filter values are not supported.
6. `deleteIndex` must not be callable while the index status is `CREATING` or `DELETING`.
7. Vector values returned by `getVector` and `querySimilar` with `includeVector = true` must be identical to the values stored at upsert time; no lossy quantisation may be applied at the read layer.
8. `embed` does not store the resulting vector; callers who want persistence must follow with `upsertVector`.

---

## Events Emitted

- `index.created`
- `index.deleted`
- `vector.upserted` -- includes `indexId`, `vectorId` (no vector values)
- `vector.deleted`

---

## System-Level Integrations

- **Idempotency:** `upsertVector` and `upsertVectorBatch` are idempotent on `vectorId` per index.
- **Consistency:** Vector upserts are eventually consistent; queries immediately following an upsert may not reflect the new vector. The acceptable propagation lag is ≤ 5 seconds.
- **Runtime delivery:** Vector ingest and reindex events are delivered `at_least_once`.
- **Worker scaling:** Indexing and query workloads must be independently scalable.
- **Multi-region:** The deployment must declare whether the vector index is single-region or active/active; duplicate writes across regions must be deduplicated by vector ID.
- **Observability:** `querySimilar` and `queryByText` must emit spans annotated with `indexId`, `topK`, `resultCount`, and `queryLatencyMs`.
- **Telemetry Metrics:**
  ```
  blueprint_embeddings_index_count                gauge { status }
  blueprint_embeddings_vector_count               gauge { index_id }
  blueprint_embeddings_upsert_total               { index_id, result }
  blueprint_embeddings_query_total                { index_id }
  blueprint_embeddings_query_duration_ms          histogram { index_id }
  blueprint_embeddings_embed_total                { model }
  blueprint_embeddings_embed_tokens_total         { model }
  ```
- **Backpressure:** If indexing or query load is saturated, requests must be buffered or rejected predictably rather than silently dropped.
- **Storage model:** Vector indexes must be durably stored; the provider must document replication and rebuild behavior.

### Database Schema (pgvector / PostgreSQL variant)

```sql
CREATE TABLE embedding_indexes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL UNIQUE,
  dimensions        INT NOT NULL CHECK (dimensions > 0),
  distance_metric   TEXT NOT NULL CHECK (distance_metric IN ('COSINE', 'EUCLIDEAN', 'DOT_PRODUCT')),
  model             TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'CREATING' CHECK (status IN ('CREATING', 'READY', 'UPDATING', 'DELETING')),
  description       TEXT,
  metadata          JSONB DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE embedding_vectors (
  vector_id         TEXT NOT NULL,
  index_id          UUID NOT NULL REFERENCES embedding_indexes(id) ON DELETE CASCADE,
  embedding         vector(1536),        -- dimension set at index creation
  metadata          JSONB DEFAULT '{}',
  upserted_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (index_id, vector_id)
);

CREATE INDEX idx_vectors_index ON embedding_vectors(index_id);

-- Supports filtering queries using GIN index on metadata
CREATE INDEX idx_vectors_metadata ON embedding_vectors USING GIN (metadata jsonb_path_ops);

-- Supports deleteVectorsByFilter lookups
CREATE INDEX idx_vectors_metadata_entity ON embedding_vectors ((metadata->>'entityType'), (metadata->>'entityId'))
  WHERE metadata ? 'entityType';
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Dimension mismatch on upsert | `DIMENSION_MISMATCH` error | Validate dimensions against index definition before ingest |
| Model unavailable for embedding | `MODEL_UNAVAILABLE` error | Retry with backoff; fall back to cached embedding if available |
| Index not ready for query | `INDEX_NOT_READY` error | Queue query; retry when status transitions to READY |
| Vector index rebuild required | Index corruption detected | Rebuild from source data; maintain secondary index during rebuild |
| Content too large for embedding | `CONTENT_TOO_LARGE` error | Chunk content before embedding; recommend max token limit |

**Breaking Changes:** Changing the distance metric on an existing index requires a new index and data migration. Reducing dimensions is breaking for existing vectors. Adding new required fields to metadata is breaking for query filters. The `DistanceMetric` enum is extensible; removing a value is breaking. Model family changes require index recreation.

- **Dependencies:** `storage` (if source content exceeds inline payload limits), `search` (hybrid queries use the keyword layer from `search`), `config` (model endpoint and API key references via the secrets module).
- **Errors:** `INDEX_NOT_FOUND`, `VECTOR_NOT_FOUND`, `DIMENSION_MISMATCH`, `INVALID_TOP_K`, `MODEL_UNAVAILABLE`, `CONTENT_TOO_LARGE`, `INDEX_NOT_READY`.
- **Providers (adapter examples):** Pinecone, Weaviate, Qdrant, pgvector (PostgreSQL extension), Chroma, Milvus, OpenAI Embeddings API (generation), Cohere Embed.
