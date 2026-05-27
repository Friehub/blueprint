# Global Core Standards & Conventions

---

## 1. Error Contracts (Universal)

These apply to every function in every module unless explicitly overridden.

```
errors universal
  any_function:
    not_found:          The requested resource does not exist | return null or 404
    unauthorized:       The caller does not have permission | return 401, do not retry
    validation_error:   Input failed contract validation | return 400, do not retry
    rate_limited:       Too many requests | retry after retry_after seconds
    provider_error:     The underlying provider returned an unrecoverable error | alert and retry with backoff
    timeout:            The operation exceeded its time bound | retry with idempotency key
```

### Error Propagation Rule
When a saga step fails with a domain error, the error must propagate to the saga orchestrator with its full error code preserved. The orchestrator must not swallow error codes or reclassify them as generic failures. The caller of the saga receives the specific domain error from the step that failed, not a generic "order creation failed" message.

---

## 2. Idempotency Keys

An idempotency key is a caller-generated unique identifier attached to any state-mutating operation with external side effects. The module guarantees that multiple calls with the same key produce the same result and execute the side effect exactly once.

### Universal Idempotency Convention
All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument. If not provided, the operation is not idempotent and a duplicate call produces a duplicate effect.

When `idempotency_key` is provided:
- If the key has not been seen before: execute the operation, store the result, return the result
- If the key has been seen and the operation completed: return the stored result without re-executing
- If the key has been seen and the operation is in progress: return `409 Conflict` with `retry_after`
- If the key has been seen but with different parameters: return `422 Unprocessable` — the key is bound to its first set of parameters

### Key Retention Period
Idempotency keys must be retained for a minimum of 24 hours. For financial operations (`payments`, `wallet`), keys must be retained for 7 days.

---

## 3. Pagination Contract

All paginated functions must use cursor-based pagination. Offset-based pagination is not permitted in this catalogue because it produces incorrect results under concurrent inserts and is unsuitable for large datasets.

### Canonical Type Definition

```typescript
PaginatedResult<T> {
  data:        T[]
  cursor:      string?          ← opaque cursor for the next page; null means no more pages
  has_more:    boolean
  total:       number?          ← total count, omitted if expensive to compute
}

PaginationOptions {
  cursor?:     string           ← cursor from previous page; omit for first page
  limit?:      number           ← default 20, maximum 100
  order?:      asc | desc       ← default desc (newest first)
}
```

### Cursor Semantics
A cursor is opaque to the caller. It must not be parsed, constructed, or persisted beyond the immediate pagination session. Internally, a cursor encodes the sort key value of the last item returned, the sort direction, and a version identifier. This enables stable pagination under concurrent inserts.

The cursor is stable for the duration of a pagination session but is not guaranteed to remain valid across module restarts or schema migrations.

### Empty Result Convention
A function returning `PaginatedResult<T>` with no results must return `{ data: [], cursor: null, has_more: false }`. It must not return `null` or throw.

---

## 4. Event Envelope & Delivery Guarantee

All events share a common envelope regardless of module.

```typescript
DomainEvent<T> {
  id:           string         ← globally unique, UUID v4
  topic:        string         ← follows naming convention: <module>.<entity>.<past_tense_verb>
  version:      string         ← semver of the event schema, e.g. "1.0"
  timestamp:    ISO8601
  source:       string         ← module name
  actor:        EventActor
  payload:      T
  correlation_id: string?      ← saga or request ID for tracing
  idempotency_key: string?     ← key of the originating operation if applicable
}

EventActor {
  type:  user | system | api_key | service
  id:    string
}
```

### Delivery Guarantee
All events in this catalogue use **at-least-once** delivery. Consumers must be idempotent — processing the same event twice must produce the same result. The `id` field is the deduplication key.

### Consumer Conventions
A module that consumes another module's events must declare its subscription in its adapter documentation. The consuming module must not call the emitting module's functions in response to events — it must handle the event payload directly. This prevents circular dependencies at runtime.

All required data must be in the event payload to prevent secondary lookup cycles.

---

## 5. Observability Standards

### Distributed Tracing Convention
Every function call creates a span. Span names follow the pattern `<module>.<function>`. Spans must be children of the incoming request span when one exists.

**Required span attributes (all functions)**
```
module:           string    ← catalogue module name
function:         string    ← function name
result:           success | failure | not_found
duration_ms:      number
```

### Metrics Specification (Universal)
Every module must expose the following metrics. Metric names follow the pattern `gensense_<module>_<operation>_<measure>`.

```
gensense_<module>_operation_total          counter   { function, result: success|failure }
gensense_<module>_operation_duration_ms    histogram { function, p50, p95, p99 }
gensense_<module>_errors_total             counter   { function, error_code }
```

### Structured Log Fields
Every log line emitted by a module must include these fields in JSON-structured format:
```json
{
  "module": "payments",
  "function": "initiatePayment",
  "trace_id": "trace-id-from-context",
  "span_id": "span-id",
  "level": "info",
  "timestamp": "2026-05-27T10:29:03Z",
  "entity_type": "payment",
  "entity_id": "pay_123",
  "from_state": "pending",
  "to_state": "completed"
}
```

*Prohibited fields (never log these)*: `password`, `password_hash`, `access_token`, `refresh_token`, `card_number`, `cvv`, `expiry`, `raw_api_key`.

---

## 6. Deployment Order

From the dependency graph, the safe deployment order is:

```
Tier 0 (no dependencies):
  caching, queues, audit_log, analytics, storage, search,
  feature_flags, rate_limiting, usage_metering, fraud_detection

Tier 1 (depends on Tier 0 only):
  users, sessions, payments, catalog, notifications (needs users)

Tier 2 (depends on Tier 0-1):
  auth, permissions, api_keys, inventory, promotions, billing,
  ip_intelligence, consent

Tier 3 (depends on Tier 0-2):
  cart, shipping, kyc, tenants, messaging, subscriptions,
  loyalty, appointments

Tier 4 (depends on Tier 0-3):
  orders, reviews

Tier 5 (depends on Tier 0-4):
  (all sagas — deployed as orchestration services, not modules)
```

---

## 7. Contract Evolution Rules

Contract versions follow semantic versioning (`MAJOR.MINOR.PATCH`).
- **PATCH**: Clarifications, formatting. No update to adapters needed.
- **MINOR**: Add optional functions, optional fields, error codes, or events. Backward-compatible.
- **MAJOR**: Remove/rename functions, change signatures, add required fields. Requires explicit adapter updates.

### Adapter Version Declaration
Every adapter must declare which contract version it implements in its module metadata.

```typescript
export const metadata = {
  module: "payments",
  contract_version: "1.2.0",
  adapter: "stripe",
  adapter_version: "2.0.1",
}
```
