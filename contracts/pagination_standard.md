# Module Contract: `pagination_standard`

**Version:** 0.1.0

---

### `pagination_standard`
Canonical cursor-based pagination standard that all list operations implement.

**Functions**
```
createCursor(after: any, filters?: any) → Cursor
decodeCursor(cursor: Cursor) → CursorPayload
paginate(query: any, config: PaginationConfig) → PaginatedResult
```

**Types**
```
Cursor = string  // opaque base64-encoded payload
CursorPayload { reference_id: string, sort_value: any, filters?: any, created_at: timestamp }
PageInfo { has_next_page: bool, has_previous_page: bool, start_cursor?: Cursor, end_cursor?: Cursor }
PaginatedResult { data: T[], page_info: PageInfo, total_count?: int }
PaginationConfig { first: int, after?: Cursor, before?: Cursor, sort_field?: string, sort_dir?: asc | desc }
```

**Invariants**
- Cursor must be an opaque string; callers must never inspect or construct cursor values
- Max page size is 100 items per page; requests exceeding this must be capped silently
- Cursor expires 1 hour after creation; expired cursors return `CURSOR_EXPIRED`
- `before` and `after` cursors are mutually exclusive; providing both returns `MUTUALLY_EXCLUSIVE_CURSORS`
- `paginate` must return results consistent with the snapshot at cursor creation time
- `sort_field` must correspond to an indexed column; otherwise the operation fails with `INVALID_SORT_FIELD`

**Providers:** built-in, PostgreSQL keyset pagination, MongoDB ObjectId pagination, offset-based fallback

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` for cursor creation, `eventual` for long-running pagination across shards
* **Details:** Cursor encodes a point-in-time snapshot; results within a single page are strongly consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for cursor lifecycle
* **Details:** Cached cursors may be invalidated early under memory pressure

### Worker Scaling
* **Policy:** Pagination is stateless; each request must be independently servable by any worker

### Multi-Region Behavior
* **Mode:** Cursors are region-local; cross-region cursor usage returns `CURSOR_REGION_MISMATCH`
* **Details:** Each region encodes its identity in the cursor; decoding a cross-region cursor is rejected

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Pagination-specific errors: `CURSOR_EXPIRED`, `MUTUALLY_EXCLUSIVE_CURSORS`, `INVALID_SORT_FIELD`, `CURSOR_REGION_MISMATCH`, `PAGE_SIZE_EXCEEDED`

### Event Emission
```
paginate    → pagination.page.served    { page_size, has_next_page, query_duration_ms }
paginate    → pagination.cursor.expired { cursor_age_seconds }
```

### Temporal Constraints
```
Cursor TTL:
    ttl:     1 hour
    on_expire: return CURSOR_EXPIRED; caller must re-query without cursor
```

### Storage Model
* **Model:** Cursor payload is serialized and optionally signed; no dedicated storage required
* **Details:** Cursor values are stateless when used with keyset pagination; offset-based fallback requires stable row ordering

### Observability
* **Tracing Spans:** Every pagination call creates a span. Span names follow the pattern `pagination.<function>`.
* **Telemetry Metrics:**
```
blueprint_pagination_operation_total           counter { function, result }
blueprint_pagination_operation_duration_ms     histogram { function }
blueprint_pagination_page_size                 histogram { function }
blueprint_pagination_cursor_expired_total      counter { function }
blueprint_pagination_errors_total              counter { function, error_code }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** (none)
* **Pagination Sort Key:** Cursor-based pagination using `sort_field` and `sort_dir` from the calling module.

### Database Schema

#### PostgreSQL
```sql
-- No dedicated tables; pagination is a query-level concern.
-- Cursor payload is encoded and decoded at the application layer.
-- Recommended index pattern for keyset pagination:
-- CREATE INDEX idx_<table>_<sort_field> ON <table>(<sort_field>, id);
```

### Breaking Change Policy
- Changing cursor encoding format requires a MAJOR version bump.
- Reducing max page size is additive; increasing it requires a MINOR version bump.
- Adding new cursor fields is backward-compatible.
- Removing cursor fields requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Cursor expired | Request after 1-hour TTL | Return CURSOR_EXPIRED; client re-queries |
| Cursor tampered | Malformed or unsigned cursor | Return INVALID_CURSOR; log security event |
| Inconsistent page under write load | Concurrent writes shift sort position | Document that pagination is point-in-time; use repeatable read |
| Page size limit exceeded | Client requests >100 items | Silently cap at 100; log warning |
| Cross-region cursor | Cursor from one region used in another | Return CURSOR_REGION_MISMATCH; instruct client to re-query local |
