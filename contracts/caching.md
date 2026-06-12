# Module Contract: `caching`

**Version:** 0.1.0

---

### `caching`
Key-value caching with TTL and tag-based invalidation.

**Functions**
```
get<T>(key) → T?
set<T>(key, value, options?) → void
del(key) → void
getOrSet<T>(key, factory, options?) → T
invalidateByTag(tag) → void
invalidateByPrefix(prefix) → void
mget<T>(keys) → Record<string, T?>
mset(entries, options?) → void
increment(key, by?) → number
decrement(key, by?) → number
```

**Types**
```
CacheOptions { ttl?, tags?, compress? }
CacheStats { hits, misses, keys, memory_used }
```

**Invariants**
- `getOrSet` must be atomic -- concurrent calls with the same key must not invoke `factory` more than once (cache stampede prevention)
- `del` on a non-existent key must be a no-op; it must not throw or return an error
- `invalidateByTag` must purge all keys that were set with the given tag, regardless of TTL; keys without the matching tag must not be affected
- `increment` and `decrement` must be atomic; concurrent calls must not produce lost updates
- `mget` must return partial results if some keys are missing -- a missing key must be `null` in the result map, not an error

**Providers:** Redis, Memcached, Upstash, in-memory (node-cache)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** By definition -- cache invalidation is asynchronous

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for invalidation-triggering events.
* **Details:** Duplicate invalidation events must be safe because cache purges are idempotent.

### Worker Scaling
* **Policy:** Bulk invalidation and read/write cache traffic must be independently scalable where the implementation uses workers.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If invalidation load is saturated, the module must defer or batch purges predictably rather than dropping them silently.

### Caching Pattern
* **Cache-Aside (recommended):** Application reads from cache first, falls back to database on miss, populates cache on read. Suitable for read-heavy workloads with tolerable staleness.
* **Write-Through:** Application writes to cache and database synchronously. Suitable for write-heavy workloads where cache must always reflect the latest write.
* **Write-Behind:** Application writes to cache synchronously, database asynchronously. Offers best write performance but risks data loss on cache failure.
* **Cache invalidation strategy:** Tag-based invalidation is recommended over key-based. Tags allow batch invalidation of related entries without tracking individual keys. The module must document its invalidation strategy.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
set               → caching.key.set               { key, ttl?, tags? }
del               → caching.key.deleted            { key }
invalidateByTag   → caching.tag.invalidated        { tag, keys_affected? }
invalidateByPrefix → caching.prefix.invalidated     { prefix, keys_affected? }
```

Note: High-cardinality cache operations may sample event emission to avoid overwhelming the event bus. Sampling rate must be documented by the adapter.

### Temporal Constraints
```
CacheEntry:
    ttl:            set by caller in CacheOptions
    on_expiry:      evict silently -- next get() returns null
    maximum_ttl:    24 hours -- entries with longer TTL must use explicit invalidation instead
```

### Storage Model
* **Model:** Ephemeral key-value store.
* **Details:** The implementation may use Redis, Memcached, or an in-memory cache; data is not durable by contract.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `caching.<function>`.
* **Telemetry Metrics:**
```
gensense_caching_operation_total                counter { function, result }
gensense_caching_operation_duration_ms          histogram { function }
gensense_caching_errors_total                   counter { function, error_code }
gensense_caching_hits_total                      counter { function }
gensense_caching_misses_total                    counter { function }
gensense_caching_keys_total                      gauge
gensense_caching_memory_used_bytes               gauge
gensense_caching_tag_invalidations_total         counter
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive)
* **Emits To:** events
* **Recommends:** (none)

### Breaking Change Policy
- Adding new cache operations is additive and backward-compatible.
- Removing or renaming an existing operation requires a MAJOR version bump.
- Changing the maximum TTL (24 hours) requires a MAJOR version bump.
- Changing the `getOrSet` atomicity guarantee (lock vs CAS strategy) requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Cache stampede | Multiple concurrent misses for same key | getOrSet uses distributed lock or CAS; factory invoked exactly once |
| Tag invalidation misses some keys | Tag index corruption | Rebuild tag index from full scan; log discrepancy |
| Increment lost update | Concurrent atomic operations on same key | Use Redis INCR or equivalent atomic primitive |
| Memcached value size exceeded | Large payload ( > 1MB ) | Compress or split; reject with PAYLOAD_TOO_LARGE |
| Connection pool exhausted | Burst of concurrent operations | Queue operations; apply circuit breaker; emit warning at 80% pool usage |
