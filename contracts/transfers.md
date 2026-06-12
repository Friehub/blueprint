# Module Contract: `transfers`

**Version:** 0.1.0

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

### Distributed System Patterns

**Saga: Transfer Flow (initiate → clear → settle)**

This saga orchestrates the multi-step transfer flow. If any step fails, compensating actions are executed in reverse order.

```
Step 1: reserveFunds(source_account_id, amount)
    Action: Debit ledger source account (pending state)
    Compensate: releaseFunds(source_account_id, amount) — reverse the pending debit
    Error: insufficient_balance → abort saga, return error

Step 2: validateRouting(routing_details)
    Action: Verify destination routing against bank directory
    Compensate: none (read-only validation)
    Error: invalid_counterparty → abort saga, execute compensate(Step 1)

Step 3: submitToClearing(transfer_id, routing_details, amount)
    Action: Submit to external clearing network (ACH/Wire/SEPA adapter)
    Compensate: cancelClearingSubmission(transfer_id) — request cancellation from clearing network
    Error: compliance_blocked → abort saga, execute compensate(Step 1)

Step 4: confirmSettlement(transfer_id, reference)
    Action: Final debit source account, credit destination account, mark settled
    Compensate: reverseSettlement(transfer_id) — post compensating ledger entry
    Error: settlement_failed → execute compensate(Step 3 → Step 1)
```

**Idempotency table:**
- `initiateTransfer`: idempotency key retained 7 days
- `transitionTransferStatus`: idempotent on `(transfer_id, to_status)` — duplicate transition to same status is a no-op

**Outbox pattern:**
- Transfer lifecycle events are written to an outbox table in the same transaction as the state change
- A separate dispatcher reads the outbox and publishes to the event bus

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `transfers.<function>`.
* **Telemetry Metrics:**
```
blueprint_transfers_total                    counter { method, status }
blueprint_transfers_volume_cents             counter { method }
blueprint_transfers_clearing_duration_sec    histogram { method }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

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

### Module Dependencies
* **Depends On:** ledger
* **Emits To:** events
* **Recommends:** notifications, audit_log, fraud_detection
