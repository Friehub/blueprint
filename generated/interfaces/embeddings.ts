// embeddings.ts
// Auto-generated from contracts/embeddings.md
// Do not edit manually

export type EmbeddingIndexId = string;

export type VectorId = string;

export type DistanceMetric = "COSINE" | "EUCLIDEAN" | "DOT_PRODUCT";

export type IndexStatus = "CREATING" | "READY" | "UPDATING" | "DELETING";

export type CreateIndexInput = {
name: string;
dimensions: number;              // Must match the output dimensionality of the configured model
distanceMetric: DistanceMetric;
model: EmbeddingModel;
description?: string;
metadata?: Record<string, unknown>;
};

export type EmbeddingIndex = {
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

export type ContentPayload = {
type: "TEXT" | "IMAGE_URL";
value: string;
};

export type EmbedInput = {
indexId: EmbeddingIndexId;
content: ContentPayload;
};

export type Embedding = {
vector: number[];
model: EmbeddingModel;
dimensions: number;
tokenCount?: number;
};

export type UpsertVectorInput = {
indexId: EmbeddingIndexId;
vectorId: VectorId;
content: ContentPayload;         // Source content; the module generates the embedding
metadata?: Record<string, unknown>; // Arbitrary filterable metadata (e.g. entityType, entityId, locale)
};

export type Vector = {
vectorId: VectorId;
indexId: EmbeddingIndexId;
vector: number[];                // Stored embedding values
metadata?: Record<string, unknown>;
upsertedAt: Timestamp;
};

export type UpsertVectorBatchInput = {
indexId: EmbeddingIndexId;
vectors: Omit<UpsertVectorInput, "indexId">[];
};

export type BatchUpsertResult = {
succeeded: VectorId[];
failed: { vectorId: VectorId; error: string }[];
};

export type MetadataFilter = {
field: string;
operator: "eq" | "neq" | "in" | "gt" | "lt" | "exists";
value?: unknown;
};

export type SimilarityQueryInput = {
indexId: EmbeddingIndexId;
queryVector: number[];
topK: number;
minScore?: number;               // Minimum similarity score (0.0 – 1.0)
filter?: MetadataFilter[];
includeVector?: boolean;         // Whether to return the raw vector in results
includeMetadata?: boolean;
};

export type TextQueryInput = {
indexId: EmbeddingIndexId;
queryText: string;
topK: number;
minScore?: number;
filter?: MetadataFilter[];
includeMetadata?: boolean;
};

export type HybridQueryInput = TextQueryInput & {

export type SimilarityResult = {
vectorId: VectorId;
score: number;                   // Normalised similarity score (0.0 = least, 1.0 = most similar)
vector?: number[];
metadata?: Record<string, unknown>;
};

export type DeleteByFilterInput = {
indexId: EmbeddingIndexId;
filter: MetadataFilter[];
};

export type DeleteResult = {
deletedCount: number;
};

export type ListIndexesInput = {
pagination: PaginationInput;
};

export interface EmbeddingsContract {
  createIndex(input: CreateIndexInput): Promise<EmbeddingIndex>;
  getIndex(indexId: EmbeddingIndexId): Promise<EmbeddingIndex>;
  listIndexes(input: ListIndexesInput): Promise<PaginatedList<EmbeddingIndex>>;
  deleteIndex(indexId: EmbeddingIndexId): Promise<void>;
  embed(input: EmbedInput): Promise<Embedding>;
  upsertVector(input: UpsertVectorInput): Promise<Vector>;
  upsertVectorBatch(input: UpsertVectorBatchInput): Promise<BatchUpsertResult>;
  getVector(indexId: EmbeddingIndexId, vectorId: VectorId): Promise<Vector>;
  deleteVector(indexId: EmbeddingIndexId, vectorId: VectorId): Promise<void>;
  deleteVectorsByFilter(input: DeleteByFilterInput): Promise<DeleteResult>;
  querySimilar(input: SimilarityQueryInput): Promise<SimilarityResult[]>;
  queryByText(input: TextQueryInput): Promise<SimilarityResult[]>;
  hybridQuery(input: HybridQueryInput): Promise<SimilarityResult[]>;
}
