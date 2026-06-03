# Module Contract: `settlement`

**Version:** 0.1.0

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
- **Idempotency:** `createSettlementBatch`, `addSettlementItem`, and `confirmSettlement` must be idempotent on batch and item references.
- **Storage Model:** Durable batch settlement register with reconciliation history.
- **Dependencies:** `ledger`, `payments`, `transfers`, `reconciliation`, `audit_log`, `jobs`.
- **Errors:** `BATCH_NOT_FOUND`, `BATCH_NOT_OPEN`, `SETTLEMENT_ALREADY_CONFIRMED`, `ITEM_CONFLICT`, `SETTLEMENT_FAILED`, `RECONCILIATION_REQUIRED`.
