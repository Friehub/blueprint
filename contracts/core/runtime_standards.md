# Runtime Standards & Delivery Constraints

---

## 1. Queue Runtime Model

These rules apply to any module or adapter that uses asynchronous delivery, background workers, or delayed execution.

### Queue Semantics
- Queue names are logical contracts, not provider names.
- The implementation may wrap Kafka, RabbitMQ, SQS, Redis streams, BullMQ, Sidekiq, or an equivalent broker.
- The contract must declare the delivery guarantee used by each queue: `at_least_once`, `at_most_once`, or `exactly_once` if the provider truly supports it.
- When the guarantee is `at_least_once`, consumers must be idempotent.

### Worker Scaling
- Worker concurrency must be configurable per queue.
- CPU-bound jobs and IO-bound jobs must not share the same scaling policy unless the module explicitly documents that they do.
- If a queue experiences sustained lag, the adapter must support horizontal scaling without changing the contract.

### Multi-Region Behavior
- Each queue or worker-backed module must declare whether it is single-region, active/passive, or active/active.
- If active/active is supported, duplicate delivery across regions must be handled by idempotency or deduplication keys.
- Cross-region failover must preserve durability for committed jobs and deliveries.

---

## 2. Failure Semantics

### Retry Budget
- Every retriable operation must declare `max_attempts`, backoff strategy, and whether retries are synchronous or deferred.
- Default retry policy for asynchronous delivery is 3 attempts with exponential backoff and jitter unless the module overrides it.

### Dead-Letter Behavior
- After the retry budget is exhausted, the message or job must move to a dead-letter queue or dead-letter store.
- Dead-letter entries must retain the original payload, failure reason, attempt count, and first/last failure timestamps.
- Dead-letter items must be queryable for operational review and replay.

### Poison Message Handling
- A message that fails repeatedly due to deterministic payload issues is a poison message.
- Poison messages must be quarantined, not endlessly retried.
- Replay must require either corrected payload data or an explicit operator action.

### Replay Rules
- Replay of a dead-letter item must be idempotent.
- Replay must preserve the original correlation context where available.
- Replay must never silently bypass validation that already failed unless the payload has been corrected.

---

## 3. Payload and Timeout Budgets

### In-Band Payload Limits
- Queue payloads should remain small and self-contained.
- Default maximum in-band payload size is 256 KiB unless the module documents a higher limit.
- Larger payloads must be stored out-of-band and referenced by pointer, key, or signed URL.

### Webhook Timeout Rules
- Outbound webhook delivery must define both connect timeout and total request timeout.
- Default connect timeout is 2 seconds.
- Default total request timeout is 30 seconds maximum; tighter timeouts are preferred for user-facing flows.
- If a target does not respond within the timeout budget, the attempt is failed and retried according to policy.

### Concurrency Per Endpoint
- Public endpoints that can trigger fan-out work must declare concurrency limits.
- Modules must specify whether concurrency is bounded per user, per tenant, per endpoint, or globally.
- If concurrency is saturated, the system must shed load predictably rather than allowing unbounded queue growth.

---

## 4. Backpressure and Rate Limiting

### Endpoint Policy
- Every externally reachable function or API route must document its rate policy.
- The policy must include: scope, window, burst limit, sustained limit, and retry-after behavior.
- Rate limiting may be applied per user, per IP, per tenant, per API key, or per endpoint, but the scope must be explicit.

### Backpressure Strategy
- When capacity is exceeded, the system must prefer backpressure over silent loss.
- Acceptable backpressure responses include `429`, deferred scheduling, bounded queue rejection, or explicit `retry_after` values.
- The module must declare whether excess load is dropped, delayed, or rejected.

---

## 5. Storage and Retention Rules

### Storage Model Declaration
- Every state-owning module must declare whether its primary store is relational, document, key-value, event-log, or object-storage backed.
- The contract must describe the consistency assumption of the primary store.

### Indexing Requirements
- If a module exposes search, list, or lookup operations at scale, it must document the access paths that require indexes.
- Indexes must be chosen around query patterns, not only around entity shape.

### Partitioning and Scale
- Large append-only tables must declare their partitioning strategy when scale matters.
- Partition keys should reflect the most common isolation axis: tenant, user, region, or time.

### Retention Policies
- High-volume operational records such as deliveries, jobs, and retries must declare a retention period.
- If records are purged, the module must state whether summaries or audit trails are retained separately.
- Failed payloads and dead-letter entries must not be retained indefinitely without an explicit reason.

---

## 6. Contract Rule

If a module uses queues, workers, webhooks, retries, or high-volume operational storage, these runtime standards must be documented in the module contract. If a module cannot satisfy one of these rules, it must explicitly state the exception and the reason.

## 7. Inheritance Rule

All module contracts inherit this file by default. Module docs should reference it explicitly and only restate the runtime rules that differ from the shared standard.
