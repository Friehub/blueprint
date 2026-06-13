# Module Contract: `transaction_isolation`

**Version:** 0.2.1

---

### `transaction_isolation`
Transaction isolation level configuration, deadlock prevention, and distributed transaction coordination.

**Functions**
```
configureIsolation(module, level) → void
getIsolationLevel(module) → IsolationLevel
executeWithIsolation(operation, level) → OperationResult
setLockTimeout(timeout_ms) → void
setDeadlockPriority(priority) → void
detectDeadlocks() → DeadlockReport
distributedTransaction(steps, options?) → DistributedTxResult
```

**Types**
```
IsolationLevel = read_uncommitted | read_committed | repeatable_read | serializable | snapshot
OperationResult { success, result?, retryable: bool, error? }
DeadlockReport { detected: bool, victims: VictimInfo[], timestamp }
VictimInfo { transaction_id, table, operation, rolled_back_at }
DistributedTxStep { name, transaction_fn, compensation_fn, timeout_ms }
DistributedTxResult { success, completed_steps, failed_step?, compensation_results }
DistributedTxOptions { timeout_ms, retry_policy, coordinator }
DeadlockPriority = normal | low | high
```

**Invariants**
- `executeWithIsolation` with level `serializable` must guarantee that concurrent transactions produce the same result as if they executed sequentially -- violations must be detected and reported
- A deadlock victim must be selected based on `deadlock_priority` -- the lowest priority transaction must be rolled back. If priorities are equal, the transaction with the least work done must be selected
- `distributedTransaction` must coordinate all steps via the configured coordinator -- the coordinator must maintain durable state to recover from crashes
- If a distributed transaction step fails, all prior steps must have their compensation executed before the transaction returns a failure
- `setLockTimeout` must apply to all subsequent transactions in the current session -- changing lock timeout mid-transaction is a contract violation

**Dependencies:** distributed_lock

**Providers:** PostgreSQL, MySQL, SQL Server, Oracle, YugabyteDB, CockroachDB

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` (varies by configured isolation level)
* **Details:** The isolation level determines the consistency guarantee. Read uncommitted provides no consistency guarantees.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for transaction operations.
* **Details:** Transaction boundaries must be respected; retry within a transaction is the caller's responsibility.

### Worker Scaling
* **Policy:** Transaction isolation configuration is per-session; distributed transaction coordination must be scalable.

### Multi-Region Behavior
* **Mode:** Isolation levels are per-database; distributed transactions across regions require a coordinator with consensus.
* **Details:** Cross-region distributed transactions are strongly discouraged -- prefer saga patterns.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
executeWithIsolation:
    deadlock_detected:       Transaction was chosen as a deadlock victim | rollback and retry
    serialization_failure:   Serialization check failed, retry recommended | retry the entire transaction
    lock_timeout:            Lock could not be acquired within timeout | retry or escalate

  distributedTransaction:
    coordinator_unavailable: Distributed transaction coordinator is unreachable | check coordinator health
    compensation_failed:     Step succeeded but compensation failed | manual intervention required
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
deadlock_detected → tx.isolation.deadlock    { victim_count, tables }
  distributedTransaction → tx.distributed.completed { steps, result }
                        OR tx.distributed.failed    { steps_completed, failed_step }
```

### Temporal Constraints
```
Lock timeout:
    default:        5 seconds
    on_expiry:      return lock_timeout error

  Distributed transaction timeout:
    default:        30 seconds
    on_expiry:      abort all steps, execute compensation

  Deadlock detection interval:
    default:        1 second
    on_expiry:      run deadlock detector
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `transaction_isolation.<function>`.
* **Telemetry Metrics:**
```
blueprint_transaction_isolation_deadlocks_total    { table }
  blueprint_transaction_isolation_retries_total     { reason }
  blueprint_transaction_isolation_duration_ms        histogram { level }
  blueprint_transaction_isolation_distributed_total   { result }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Coordinator unreachable | Distributed transaction fails with coordinator_unavailable; retry with backoff |
| Compensation step fails | Log error, alert operator; manual intervention required for orphaned resources |
| Deadlock detected | Lowest-priority or least-work transaction is rolled back; caller receives deadlock_detected error |
| Serialization failure | Transaction must be retried entirely by the caller |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

### Module Dependencies
* **Depends On:** distributed_lock
* **Emits To:** events
* **Recommends:** audit_log, telemetry
