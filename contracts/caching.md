# Module Contract: `caching`

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
- `getOrSet` must be atomic — concurrent calls with the same key must not invoke `factory` more than once (cache stampede prevention)

**Providers:** Redis, Memcached, Upstash, in-memory (node-cache)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** By definition — cache invalidation is asynchronous

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
CacheEntry:
    ttl:            set by caller in CacheOptions
    on_expiry:      evict silently — next get() returns null
    maximum_ttl:    24 hours — entries with longer TTL must use explicit invalidation instead
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `caching.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none — infrastructure primitive)
* **Emits To:** (none)
* **Recommends:** (none)
