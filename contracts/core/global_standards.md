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
- If the key has been seen but with different parameters: return `422 Unprocessable` -- the key is bound to its first set of parameters

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
All events in this catalogue use **at-least-once** delivery. Consumers must be idempotent -- processing the same event twice must produce the same result. The `id` field is the deduplication key.

### Consumer Conventions
A module that consumes another module's events must declare its subscription in its adapter documentation. The consuming module must not call the emitting module's functions in response to events -- it must handle the event payload directly. This prevents circular dependencies at runtime.

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
  (all sagas -- deployed as orchestration services, not modules)
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

---

## 8. Transport Security

These requirements are inherited by every module in the catalog unless a specific exception is declared in the module's system-level integrations section.

### 8.1 TLS Requirement

All external-facing endpoints must be served exclusively over TLS 1.2 or higher. TLS 1.0 and 1.1 are not permitted. Connections received without TLS must either be rejected outright or redirected to the HTTPS counterpart with a `301 Moved Permanently` status.

### 8.2 Cipher Requirements

Implementations must support only ciphers that provide forward secrecy (ECDHE or DHE key exchange). Ciphers using static RSA key exchange, NULL encryption, or RC4 are not permitted.

### 8.3 Inter-Service Communication

All communication between services within the same deployment must use TLS. Mutual TLS (mTLS) is strongly recommended and is required for any service that handles PII, financial data, or authentication tokens on behalf of another service.

Where mTLS is not feasible (proxied environments, sidecar termination), the module must declare the mechanism by which service identity is verified (header-based tokens, network policy, or workload identity).

### 8.4 HSTS

Every browser-facing endpoint must send the `Strict-Transport-Security` header with a minimum `max-age` of 31536000 seconds (1 year) and the `includeSubDomains` directive. The `preload` directive should be included if the domain is submitted to browser preload lists.

API-only endpoints that are never consumed by browsers are exempt from the HSTS requirement but must still serve over TLS.

### 8.5 Certificate Requirements

Certificates must be issued by a trusted public Certificate Authority or, for internal services, by an internal CA whose root is distributed to all services in the deployment. Self-signed certificates are permitted only for development and test environments.

### 8.6 Exception Process

---

## 11. Deployment Permissions

### 11.1 Service Identity Isolation

Each module must have its own service identity and must not share credentials with other modules. Service identities must be scoped to the module's own data stores and resources.

### 11.2 Credential Separation

Each module's service identity must have access only to the data stores it owns. Modules must not have write access to tables or buckets owned by other modules even if they have read access for cross-module queries.

### 11.3 Minimum Permission Declaration

The deployment documentation for each module must declare the minimum permission set required: which databases, queues, caches, and external services the module needs access to, and whether each access is read or write. A module that fails to declare its permission set must be denied by default at deployment time.

A module may declare an exception to any transport security requirement by documenting the following in its system-level integrations section:

- The specific requirement being exempted
- The reason for the exemption (e.g. "TLS is terminated at the load balancer; internal traffic runs on a private network with network policies")
- The compensating control that replaces the exempted requirement
- The review date after which the exemption expires and must be reassessed

Exceptions must have a defined expiry and cannot be permanent.

---

## 9. Request Validation

The `request_validation` module defines universal payload validation requirements. Every module that accepts external input inherits the following by default:

- Payload size must be validated against a declared maximum before any processing
- String fields must be validated against an allowed character set
- Structured inputs must be validated against their declared type before business logic runs
- Inputs used in database queries, shell commands, template rendering, or HTML/XML output must pass through context-aware escaping or parameterisation

Modules may declare exceptions in their system-level integrations section with a documented compensating control.

---

## 10. Brute Force Protection

These requirements apply universally to every credential-checking function across all modules. A credential-checking function is any function that accepts a secret or token and returns a boolean pass/fail decision that gates access to a protected resource. This includes but is not limited to: password verification, API key validation, TOTP verification, recovery code use, backup code use, and password reset token submission.

### 10.1 Attempt Limits

Each credential-checking function must enforce a maximum of 5 failed attempts per identity within a rolling 15-minute window. The count must be per-function and per-identity -- a failure on `signIn` must not affect the limit on `verifyTotp` for the same identity.

### 10.2 Lockout

When the attempt limit is exceeded, the identity must be locked for a minimum of 15 minutes. During lockout, all credential-checking functions for that identity must return a generic `rate_limited` error. The lockout must not reveal whether the identity exists in the system.

### 10.3 Distributed Attacks

For distributed attacks where failed attempts originate from multiple IP addresses, the lockout must be based on identity, not source IP. A single identity locked out from one IP must be locked out from all IPs. Conversely, IP-based rate limiting (handled by the `rate_limiting` module) applies independently and must not be confused with credential lockout.

### 10.4 Notification

When a lockout is triggered, the module must emit an event consumable by the `notifications` and `security_monitoring` modules. The event must include the identity identifier, the function that triggered the lockout, and the lockout duration, but must not include the attempted credential value.

### 10.5 Administrator Override

An authorized administrator may unlock a locked identity before the lockout expiry. The override must be recorded in `audit_log` with the administrator identity, the target identity, the reason for override, and the timestamp. The override must not disable the lockout mechanism for future attempts.
