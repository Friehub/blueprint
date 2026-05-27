# Module: disputes

**Version:** 0.1.0
**Part:** VII — Security and Compliance

## Purpose

Defines the interface for managing payment dispute and chargeback lifecycles. A dispute is initiated when a payer challenges a completed transaction — either through their bank (chargeback) or through a direct merchant mediation process. This module owns the dispute record, evidence submission, decision tracking, and financial resolution. It does not initiate refunds directly — resolution triggers a saga that coordinates with `payments` and `ledger`.

---

## State Machine

```
OPEN → EVIDENCE_REQUIRED → UNDER_REVIEW → WON
                                        → LOST
                                        → ACCEPTED
OPEN → ACCEPTED            (merchant accepts immediately)
WON  → CLOSED
LOST → CLOSED
ACCEPTED → CLOSED
```

Transitions:
- `OPEN`: dispute received from payment provider or customer
- `OPEN → EVIDENCE_REQUIRED`: provider requests merchant response; deadline set
- `EVIDENCE_REQUIRED → UNDER_REVIEW`: evidence submitted by merchant
- `OPEN → ACCEPTED`: merchant calls `acceptDispute` before evidence deadline
- `UNDER_REVIEW → WON`: adjudicator rules in merchant's favor; funds released
- `UNDER_REVIEW → LOST`: adjudicator rules in payer's favor; funds debited
- `ACCEPTED → CLOSED`: refund saga completes
- `WON / LOST → CLOSED`: financial resolution confirmed by `ledger`

---

## Functions

### `openDispute(input: OpenDisputeInput) → Dispute`
Records a newly received dispute. Typically called by a webhook handler receiving a chargeback notification from a payment provider.

### `getDispute(disputeId: DisputeId) → Dispute`
Returns the full dispute record including evidence and timeline.

### `getDisputeByTransactionId(transactionId: string) → Dispute`
Looks up the active dispute for a given payment transaction. Returns `DISPUTE_NOT_FOUND` if none exists.

### `listDisputes(input: ListDisputesInput) → PaginatedList<Dispute>`
Returns disputes filtered by status, date range, or amount.

### `submitEvidence(input: SubmitEvidenceInput) → Dispute`
Attaches evidence documents and a rebuttal narrative to the dispute. Transitions from `EVIDENCE_REQUIRED` to `UNDER_REVIEW`.

### `acceptDispute(disputeId: DisputeId, reason?: string) → Dispute`
Merchant accepts the dispute, forfeiting the transaction amount. Initiates the refund saga. Only valid while dispute is `OPEN` or `EVIDENCE_REQUIRED`.

### `recordDecision(input: RecordDecisionInput) → Dispute`
Records the final adjudication outcome (`WON` or `LOST`). Typically called by a webhook handler receiving a resolution from the payment provider. Triggers financial settlement saga.

### `closeDispute(disputeId: DisputeId) → Dispute`
Marks the dispute as `CLOSED` after financial settlement is confirmed.

### `getDisputeStats(input: DisputeStatsInput) → DisputeStats`
Returns aggregate dispute metrics for a given period: volume, win rate, total funds recovered, total funds lost.

---

## Types

```typescript
type DisputeId = string;
type DisputeEvidenceId = string;

type DisputeStatus =
  | "OPEN"
  | "EVIDENCE_REQUIRED"
  | "UNDER_REVIEW"
  | "WON"
  | "LOST"
  | "ACCEPTED"
  | "CLOSED";

type DisputeReason =
  | "FRAUDULENT"
  | "NOT_AS_DESCRIBED"
  | "DUPLICATE"
  | "SUBSCRIPTION_CANCELLED"
  | "CREDIT_NOT_PROCESSED"
  | "PRODUCT_NOT_RECEIVED"
  | "UNRECOGNIZED"
  | "OTHER";

type DisputeOutcome = "WON" | "LOST";

type EvidenceType =
  | "RECEIPT"
  | "CUSTOMER_COMMUNICATION"
  | "SHIPPING_DOCUMENTATION"
  | "SERVICE_DOCUMENTATION"
  | "REFUND_POLICY"
  | "OTHER";

type DisputeEvidence = {
  evidenceId: DisputeEvidenceId;
  type: EvidenceType;
  description: string;
  storageRef: string;              // Reference to file in storage module
  uploadedAt: Timestamp;
};

type Dispute = {
  disputeId: DisputeId;
  transactionId: string;
  paymentProvider: string;
  providerDisputeId?: string;      // Provider's own reference for the dispute
  amount: number;
  currency: string;
  reason: DisputeReason;
  status: DisputeStatus;
  evidenceDeadline?: Timestamp;    // Deadline for submitting evidence
  evidence: DisputeEvidence[];
  rebuttalNarrative?: string;
  outcome?: DisputeOutcome;
  outcomeReason?: string;
  openedAt: Timestamp;
  resolvedAt?: Timestamp;
  closedAt?: Timestamp;
};

type OpenDisputeInput = {
  transactionId: string;
  paymentProvider: string;
  providerDisputeId?: string;
  amount: number;
  currency: string;
  reason: DisputeReason;
  evidenceDeadline?: Timestamp;
  metadata?: Record<string, unknown>;
};

type SubmitEvidenceInput = {
  disputeId: DisputeId;
  evidence: {
    type: EvidenceType;
    description: string;
    storageRef: string;
  }[];
  rebuttalNarrative: string;
};

type RecordDecisionInput = {
  disputeId: DisputeId;
  outcome: DisputeOutcome;
  outcomeReason?: string;
  resolvedAt?: Timestamp;
};

type ListDisputesInput = {
  status?: DisputeStatus;
  reason?: DisputeReason;
  fromDate?: Timestamp;
  toDate?: Timestamp;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  pagination: PaginationInput;
};

type DisputeStatsInput = {
  fromDate: Timestamp;
  toDate: Timestamp;
  currency?: string;
};

type DisputeStats = {
  totalDisputes: number;
  openDisputes: number;
  won: number;
  lost: number;
  accepted: number;
  winRate: number;                 // won / (won + lost) * 100
  totalAmountDisputed: number;
  totalAmountRecovered: number;
  totalAmountLost: number;
  currency: string;
};
```

---

## Invariants

1. At most one active (non-`CLOSED`) dispute may exist per `transactionId`. Attempting to open a second dispute returns the existing one.
2. `submitEvidence` is only valid when dispute is in `EVIDENCE_REQUIRED` state; calling it in any other state returns `DISPUTE_NOT_IN_EVIDENCE_PHASE`.
3. `acceptDispute` is only valid while dispute is `OPEN` or `EVIDENCE_REQUIRED`; it is never valid after `UNDER_REVIEW` has begun.
4. `recordDecision` is only valid while dispute is `UNDER_REVIEW`.
5. Financial settlement (refund or fund release) must be triggered by the saga, never directly by this module.
6. Evidence files must be validated for existence in `storage` before `submitEvidence` returns successfully.
7. `evidenceDeadline` must be enforced; a dispute with an elapsed deadline and no evidence submission must auto-transition to `UNDER_REVIEW` with an empty evidence set, logged as `deadline_missed`.

---

## Events Emitted

- `dispute.opened`
- `dispute.evidence_required` — includes `evidenceDeadline`
- `dispute.evidence_submitted`
- `dispute.accepted` — merchant forfeited
- `dispute.won` — merchant prevailed
- `dispute.lost` — merchant lost; refund to be issued
- `dispute.closed` — financial settlement confirmed
- `dispute.deadline_missed` — evidence deadline elapsed with no submission

---

## System-Level Integrations

- **Idempotency:** `openDispute` is idempotent on `(transactionId, providerDisputeId)`; duplicate webhook deliveries return the existing dispute.
- **Consistency:** `recordDecision` and the resulting financial saga must be wrapped in an outbox pattern; the decision must be persisted before the saga trigger is published.
- **Observability:** Each dispute is a trace root; spans cover evidence submission, decision receipt, and settlement confirmation.
- **Dependencies:** `payments` (original transaction lookup), `ledger` (financial settlement), `storage` (evidence files), `fraud_detection` (chargeback pattern analysis), `notifications` (merchant alerts on new disputes and deadlines).
- **Errors:** `DISPUTE_NOT_FOUND`, `TRANSACTION_NOT_FOUND`, `DUPLICATE_DISPUTE`, `DISPUTE_NOT_IN_EVIDENCE_PHASE`, `DISPUTE_NOT_ACCEPTABLE`, `DISPUTE_ALREADY_RESOLVED`, `EVIDENCE_FILE_NOT_FOUND`.
- **Providers (adapter examples):** Stripe Disputes API, Adyen Disputes, Braintree Disputes, custom chargeback management platforms.
