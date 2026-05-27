# Module Contract: `chargebacks`

---

### `chargebacks`
Card network chargeback lifecycle, evidence management, and dispute response tracking.

**Functions**
```
createChargeback(payment_id, reason, metadata?) → Chargeback
getChargeback(chargeback_id) → Chargeback
listChargebacks(input, options?) → PaginatedResult<Chargeback>
submitEvidence(chargeback_id, evidence) → Chargeback
updateChargebackStatus(chargeback_id, status, metadata?) → Chargeback
closeChargeback(chargeback_id) → Chargeback
```

**Types**
```
Chargeback { id, payment_id, reason, status, amount, currency, opened_at, due_at?, closed_at?, metadata? }
Evidence { type, url?, text?, submitted_at }
ChargebackStatus = open | evidence_due | submitted | won | lost | reversed | closed
```

**Invariants**
- Evidence submitted for a chargeback must be immutable once accepted.
- Chargeback deadlines must be enforced from the network due date.
- A closed chargeback cannot be re-opened without a new case identifier.

**Providers:** card network dispute integrations, processor dispute APIs, chargeback management tools

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Chargeback status transitions and evidence submissions must be strongly consistent.
- **Idempotency:** `createChargeback`, `submitEvidence`, and `closeChargeback` must be idempotent on chargeback identity.
- **Storage Model:** Durable chargeback case store with evidence history.
- **Dependencies:** `payments`, `ledger`, `disputes`, `notifications`, `audit_log`.
- **Errors:** `CHARGEBACK_NOT_FOUND`, `EVIDENCE_NOT_ACCEPTABLE`, `CHARGEBACK_CLOSED`, `DEADLINE_EXPIRED`, `CHARGEBACK_ALREADY_EXISTS`, `STATUS_INVALID`.
