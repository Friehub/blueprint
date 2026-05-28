// meilisearch.ts
// Auto-generated adapter for meilisearch → search
// Do not edit manually

import type { SearchContract } from '../interfaces/search';

export class MeilisearchAdapter implements SearchContract {
  constructor(private config: {
  host: string;
  api_key: string;
  }) {}

  indexDocument(index: unknown, id: unknown, document: unknown): Promise<void> {
    // TODO: Implement with indexDocument
    throw new Error('Not implemented');
  }
  indexBulk(index: unknown, documents: unknown): Promise<BulkIndexResult> {
    // TODO: Implement with indexBulk
    throw new Error('Not implemented');
  }
  removeDocument(index: unknown, id: unknown): Promise<void> {
    // TODO: Implement with removeDocument
    throw new Error('Not implemented');
  }
  search(index: unknown, query: unknown, options?: unknown): Promise<SearchResult> {
    // TODO: Implement with search
    throw new Error('Not implemented');
  }
  suggest(index: unknown, partial: unknown, field: unknown, options?: unknown): Promise<Suggestion[]> {
    // TODO: Implement with suggest
    throw new Error('Not implemented');
  }
  reindex(index: unknown): Promise<ReindexJob> {
    // TODO: Implement with reindex
    throw new Error('Not implemented');
  }
  getIndexStats(index: unknown): Promise<IndexStats> {
    // TODO: Implement with getIndexStats
    throw new Error('Not implemented');
  }
  createIndex(name: unknown, config: unknown): Promise<Index> {
    // TODO: Implement with createIndex
    throw new Error('Not implemented');
  }
  deleteIndex(name: unknown): Promise<void> {
    // TODO: Implement with deleteIndex
    throw new Error('Not implemented');
  }
}
