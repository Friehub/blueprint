# Module Contract: `settlement`

**Version:** 0.2.1

---

### `settlement`
Clearing, batching, and final settlement of financial transactions between processors, ledgers, and financial institutions.

**Functions**
```
createSettlementBatch(source, period) → SettlementBatch
getSettlementBatch(batch_id) → SettlementBatch
listSettlementBatches(input, options?) → PaginatedResult<SettlementBatch>
addSettlementItem(batch_id, item) → SettlementItem
closeSettlementBatch(batch_id) → SettlementBatch
confirmSettlement(batch_id, reference, settled_at?) → SettlementBatch
failSettlement(batch_id, reason) → SettlementBatch
reconcileBatch(batch_id) → SettlementBatch
```

**Types**
```
SettlementBatch { id, source, period, status, gross_amount, net_amount, item_count, created_at, closed_at?, settled_at? }
SettlementItem { id, batch_id, reference, amount, currency, status, metadata? }
SettlementStatus = open | closing | closed | settled | failed | disputed
```

**Invariants**
- A closed batch must not accept new items.
- Settlement totals must be auditable and derived from the underlying items.
- A failed settlement must retain enough context for reconciliation and replay.

**Providers:** card settlement backends, ACH settlement systems, payment processor settlement exports, treasury systems

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Batch closure and settlement confirmation must be strongly consistent.
- **Idempotency:**
  - `createSettlementBatch`: idempotent on `(source, period)` — returns existing batch if already created
  - `addSettlementItem`: idempotent on `(batch_id, reference)` — duplicate item returns existing item
  - `confirmSettlement`: idempotent on `(batch_id, reference)` — confirming twice is a no-op
  - Keys retained for 7 days (financial operation per global standard)
- **Storage Model:** Durable batch settlement register with reconciliation history.
- **Dependencies:** `ledger`, `payments`, `transfers`, `reconciliation`, `audit_log`, `jobs`.
- **Errors:** `BATCH_NOT_FOUND`, `BATCH_NOT_OPEN`, `SETTLEMENT_ALREADY_CONFIRMED`, `ITEM_CONFLICT`, `SETTLEMENT_FAILED`, `RECONCILIATION_REQUIRED`.

### Distributed System Patterns

**Outbox Pattern:**
- Settlement lifecycle events are written to an outbox table in the same transaction as the batch state change
- A dispatcher reads the outbox and publishes to the event bus
- Prevents dual-write problem between DB state and event emission

**Saga: Settlement Batch Closure**
```
Step 1: closeSettlementBatch(batch_id)
    Action: Transition batch to closing, compute gross/net totals
    Compensate: reopenSettlementBatch(batch_id) — revert to open, recompute totals
    Error: item_in_transit → wait and retry; manual override may force close

Step 2: reconcileBatch(batch_id)
    Action: Verify batch totals match underlying transaction records
    Compensate: none (reconciliation is read-only)
    Error: totals_mismatch → abort saga, execute compensate(Step 1)

Step 3: confirmSettlement(batch_id, reference)
    Action: Record settlement confirmation, transition to settled
    Compensate: reverseSettlement(batch_id) — post compensating journal entries
    Error: settlement_failed → execute compensate(Step 2 → Step 1)
```

**Retry Policy:**
- Settlement confirmation: 3 attempts with exponential backoff (2^attempt seconds, max 32s)
### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

- Failed settlements move to dead-letter state for operator review
