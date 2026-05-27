# Module Contract: `transfers`

---

### `transfers`
Financial routing, clearing, and settlement for internal ledger and external network transfers (ACH, Wire, SEPA).
This module also owns inbound bank transfer intake and matching.

**Functions**
```
initiateTransfer(source_account_id, dest_account_id, amount, routing_details) → Transfer
getTransfer(transfer_id) → Transfer
transitionTransferStatus(transfer_id, status, error_details?) → Transfer
registerCounterparty(details) → Counterparty
recordInboundTransfer(dest_account_id, amount, routing_details, external_reference, metadata?) → InboundTransfer
getInboundTransfer(inbound_transfer_id) → InboundTransfer
listInboundTransfers(input, options?) → PaginatedResult<InboundTransfer>
confirmInboundTransfer(inbound_transfer_id) → InboundTransfer
```

**Types**
```
Transfer { id, source_account_id, dest_account_id, amount, status, routing_details, created_at, settled_at?, error_details? }
Counterparty { id, name, type, bank_routing_number, bank_account_number, status, created_at }
RoutingDetails { method, bank_code?, country_code?, fee_cents? }
InboundTransfer { id, dest_account_id, amount, status, routing_details, external_reference, created_at, confirmed_at?, matched_at?, error_details? }

TransferStatus = initiated | clearing | settled | failed
InboundTransferStatus = received | matched | confirmed | failed | reversed
CounterpartyType = individual | corporate
CounterpartyStatus = active | suspended | pending_verification
TransferMethod = internal | ach | wire | sepa
```

**Invariants**
- **Clearing Phase**: External transfers (ACH, Wire, SEPA) must enter the `clearing` state and cannot be marked `settled` until confirmation is received from the clearing network adapter.
- **Rollback Compensation**: If an initiated transfer fails during the clearing or settlement phase, the transfer engine must execute a compensating transfer to reverse the initial debit on the source ledger account.
- **Verification**: Destination routing details must pass validation against external bank directories before transition to `clearing`.
- Inbound transfers must be idempotent on `(external_reference, dest_account_id)`.
- Inbound transfers may only be confirmed after provider validation and matching.

**Providers:** Stripe Treasury, Moov, Modern Treasury, Custom banking gateway

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong`
* **Details:** Transfer state transitions must be immediately visible to transaction history queries.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for transfer lifecycle events.
* **Details:** Duplicate initiation retries must not create duplicate transfers.

### Storage Model
* **Model:** Durable transfer state store with inbound and outbound histories.
* **Details:** Inbound matching records must remain queryable for audit and reconciliation.

### Worker Scaling
* **Policy:** Initiation, clearing, and reconciliation workflows must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether transfer processing is single-region or active/passive.
* **Details:** Cross-region transfer state must converge before settlement is accepted.

### Idempotency Requirements
* **Standard:** Idempotency keys must be accepted on transfer initiations and retained for 7 days.
* **Required Functions:**
  - `initiateTransfer(source_account_id, dest_account_id, amount, routing_details, idempotency_key?)`

### Backpressure
* If clearing adapters or risk checks are saturated, transfer initiation must defer or reject predictably rather than producing ambiguous state.

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

### Storage Model
* **Model:** Durable transfer state store with settlement history.
* **Details:** Clearing and settlement records must remain queryable for audit and reconciliation.

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
