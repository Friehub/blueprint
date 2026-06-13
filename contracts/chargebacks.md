# Module Contract: `chargebacks`

**Version:** 0.2.0

---

### `chargebacks`
Card network chargeback lifecycle, evidence management, and dispute response tracking. Chargebacks are a specific type of dispute — they are **provider-initiated** (triggered by the card network or issuing bank). For **user-initiated** disputes (e.g., customer requests merchant mediation before contacting their bank), see `disputes.md`.

**Distinction from `disputes`:**
- `chargebacks` are initiated externally by the card network or payment processor via webhook
- `disputes` can be initiated internally by a customer or merchant, or externally via chargeback
- `disputes` is the comprehensive module; `chargebacks` is a convenience interface for provider-specific chargeback handling
- When a chargeback is received, the adapter should create a `disputes.openDispute` record if one does not already exist for the transaction

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
- **Dependencies:** `payments`, `ledger`, `disputes` (every chargeback creates or updates a dispute record), `notifications`, `audit_log`.
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

- **Errors:** `CHARGEBACK_NOT_FOUND`, `EVIDENCE_NOT_ACCEPTABLE`, `CHARGEBACK_CLOSED`, `DEADLINE_EXPIRED`, `CHARGEBACK_ALREADY_EXISTS`, `STATUS_INVALID`.
