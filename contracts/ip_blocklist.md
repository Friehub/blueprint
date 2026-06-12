# Module Contract: `ip_blocklist`

**Version:** 0.1.0

---

### `ip_blocklist`
IP address blocklist management with CIDR and ASN support, expiry, and threat intelligence feed ingestion.

**Functions**
```
blockIp(ip, reason, options?) → BlocklistEntry
blockCidr(cidr, reason, options?) → BlocklistEntry
blockAsn(asn, reason, options?) → BlocklistEntry
unblock(entry_id) → void
isBlocked(ip) → BlockStatus
listEntries(status?, options?) → PaginatedResult<BlocklistEntry>
importFeed(source, format) → ImportResult
getStats() → BlocklistStats
```

**Types**
```
BlocklistEntry { id, target, type: ip|cidr|asn, reason, source: manual|feed, severity, expires_at?, created_at }
BlockStatus { blocked: bool, entries: BlocklistEntry[], enforcement: hard|soft }
ImportResult { feed, entries_added, entries_updated, errors[], duration_ms }
BlocklistStats { total_entries, active_entries, expired_entries, by_type, by_severity }
BlocklistOptions { expires_at?, severity?, enforcement?: hard|soft, tags? }
EnforcementMode = hard | soft
Severity = low | medium | high | critical
```

**Invariants**
- A blocked IP must be rejected before any authentication or business logic runs -- the block check must be the first operation in the request pipeline
- `isBlocked` must complete in sub-millisecond time for hot-path requests -- it must not make external network calls or database queries that add measurable latency
- An entry with `enforcement: hard` must reject the request with no further processing; `enforcement: soft` must allow the request but log and alert
- `blockIp` with an IP already covered by an existing CIDR range entry must succeed (the specific IP entry overrides the range for observability)
- Entries with `expires_at` in the past must be treated as expired and must not affect `isBlocked` results

**Providers:** custom, Cloudflare IP Lists, AWS WAF IP Sets, GCP Cloud Armor

**Dependencies:** ip_intelligence, rate_limiting

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Blocklist state must be immediately consistent to prevent a blocked IP from being served

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for blocklist changes.
* **Details:** Duplicate block operations must be idempotent (update the existing entry, not create a duplicate).

### Worker Scaling
* **Policy:** Blocklist reads must be served from a local cache replicated across instances; writes are serialized through a single writer.

### Multi-Region Behavior
* **Mode:** Blocklist state must be replicated across all regions within a bounded propagation delay (default 60 seconds).
* **Details:** During propagation delay, a region may serve a request from a recently blocked IP -- this is acceptable as long as the delay is documented and the region converges within the declared window.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
blockIp           → blocklist.ip.added           { target, reason, severity }
  blockCidr         → blocklist.cidr.added          { target, reason, severity }
  blockAsn          → blocklist.asn.added           { target, reason, severity }
  unblock           → blocklist.entry.removed        { entry_id, target }
  isBlocked         → blocklist.check.blocked        { ip, entries_matched }
                   OR blocklist.check.passed         { ip }
```

### Temporal Constraints
```
Block entry expiry:
    default:        indefinite (manual review required)
    feed imports:   configurable per feed, default 24 hours
    on_expiry:      entry is removed from active blocklist; logged for audit

  Cache TTL for blocklist:
    default:        60 seconds
    on_expiry:      refresh from source of truth
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `ip_blocklist.<function>`.
* **Telemetry Metrics:**
```
gensense_ip_blocklist_entries_total             { type, severity }
  gensense_ip_blocklist_checks_total              { result }
  gensense_ip_blocklist_imports_total              { feed, entries_added }
  gensense_ip_blocklist_cache_hit_ratio
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** ip_intelligence, rate_limiting
* **Emits To:** events
* **Recommends:** notifications (for critical severity blocks), caching (for blocklist read cache)
