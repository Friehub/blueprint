// caching.ts
// Auto-generated from contracts/caching.md
// Do not edit manually

export interface Cacheoptions {

}

export interface Cachestats {
  hits: unknown;
  misses: unknown;
  keys: unknown;
  memoryUsed: unknown;
}

export interface CachingContract {
  del(key: unknown): Promise<void>;
  invalidateByTag(tag: unknown): Promise<void>;
  invalidateByPrefix(prefix: unknown): Promise<void>;
  mset(entries: unknown, options?: unknown): Promise<void>;
  increment(key: unknown, by?: unknown): Promise<number>;
  decrement(key: unknown, by?: unknown): Promise<number>;
}
