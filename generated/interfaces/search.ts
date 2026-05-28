// search.ts
// Auto-generated from contracts/search.md
// Do not edit manually

export interface Searchresult {
  hits: Hit[];
  total: unknown;
  tookMs: unknown;
}

export interface Hit {
  id: string;
  document: unknown;
  score: unknown;
}

export interface Searchoptions {

}

export interface Indexstats {
  documentCount: number;
  indexSize: unknown;
  lastUpdated: unknown;
}

export interface SearchContract {
  indexDocument(index: unknown, id: unknown, document: unknown): Promise<void>;
  indexBulk(index: unknown, documents: unknown): Promise<BulkIndexResult>;
  removeDocument(index: unknown, id: unknown): Promise<void>;
  search(index: unknown, query: unknown, options?: unknown): Promise<SearchResult>;
  suggest(index: unknown, partial: unknown, field: unknown, options?: unknown): Promise<Suggestion[]>;
  reindex(index: unknown): Promise<ReindexJob>;
  getIndexStats(index: unknown): Promise<IndexStats>;
  createIndex(name: unknown, config: unknown): Promise<Index>;
  deleteIndex(name: unknown): Promise<void>;
}
