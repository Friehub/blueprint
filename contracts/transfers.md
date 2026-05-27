# Module Contract: `transfers`

---

### `transfers`
Financial routing, clearing, and settlement for internal ledger and external network transfers (ACH, Wire, SEPA).

**Functions**
```
initiateTransfer(source_account_id, dest_account_id, amount, routing_details) → Transfer
getTransfer(transfer_id) → Transfer
transitionTransferStatus(transfer_id, status, error_details?) → Transfer
registerCounterparty(details) → Counterparty
```

**Types**
```
Transfer { id, source_account_id, dest_account_id, amount, status, routing_details, created_at, settled_at?, error_details? }
Counterparty { id, name, type, bank_routing_number, bank_account_number, status, created_at }
RoutingDetails { method, bank_code?, country_code?, fee_cents? }

TransferStatus = initiated | clearing | settled | failed
CounterpartyType = individual | corporate
CounterpartyStatus = active | suspended | pending_verification
TransferMethod = internal | ach | wire | sepa
```

**Invariants**
- **Clearing Phase**: External transfers (ACH, Wire, SEPA) must enter the `clearing` state and cannot be marked `settled` until confirmation is received from the clearing network adapter.
- **Rollback Compensation**: If an initiated transfer fails during the clearing or settlement phase, the transfer engine must execute a compensating transfer to reverse the initial debit on the source ledger account.
- **Verification**: Destination routing details must pass validation against external bank directories before transition to `clearing`.

**Providers:** Stripe Treasury, Moov, Modern Treasury, Custom banking gateway

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Transfer state transitions must be immediately visible to transaction history queries.

### Idempotency Requirements
* **Standard:** Idempotency keys must be accepted on transfer initiations and retained for 7 days.
* **Required Functions:**
  - `initiateTransfer(source_account_id, dest_account_id, amount, routing_details, idempotency_key?)`

### Error Taxonomy
### Module-Specific Errors
```
initiateTransfer:
    insufficient_balance:      The source account has insufficient cleared balance | reject
    invalid_counterparty:      Target routing or account numbers are invalid | return 400
    compliance_blocked:        Blocked due to risk limit or AML freeze | transition status to failed, alert compliance
    duplicate_transfer:        Idempotency key match found | return original transfer
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
initiateTransfer         → transfer.initiated          { transfer_id, amount, method }
transitionTransferStatus → transfer.status.transitioned { transfer_id, from_status, to_status }
```

### Temporal Constraints
```
Transfer (clearing state):
    max_duration:   2 business days (ACH), 2 hours (Wire)
    on_expiry:      transition to failed, initiate ledger rollback, alert operations
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `transfers.<function>`.
* **Telemetry Metrics:**
```
gensense_transfers_total                    counter { method, status }
gensense_transfers_volume_cents             counter { method }
gensense_transfers_clearing_duration_sec    histogram { method }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** ledger
* **Emits To:** events
* **Recommends:** notifications, audit_log, fraud_detection
