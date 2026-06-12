# Module Contract: `bank_accounts`

**Version:** 0.1.0

---

### `bank_accounts`
External bank account linking, verification, masking, and payout destination management.

**Functions**
```
linkBankAccount(owner_id, account_details) → BankAccount
getBankAccount(bank_account_id) → BankAccount
listBankAccounts(owner_id, options?) → PaginatedResult<BankAccount>
verifyBankAccount(bank_account_id, verification_data) → BankAccount
setDefaultBankAccount(owner_id, bank_account_id) → BankAccount
disableBankAccount(bank_account_id, reason) → BankAccount
getVerificationStatus(bank_account_id) → VerificationStatus
```

**Types**
```
BankAccount { id, owner_id, institution_name, account_type, last4, routing_masked, status, is_default, created_at, updated_at }
VerificationStatus = unverified | pending | verified | failed | disabled
AccountType = checking | savings | virtual | wallet
```

**Invariants**
- Sensitive bank account numbers must never be returned in plaintext after linking.
- Only verified accounts may be set as default payout destinations if verification is required.
- A disabled bank account cannot receive new payouts.

**Providers:** Plaid, Tink, TrueLayer, Stripe Financial Connections, open banking APIs, custom bank linking systems

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Verification status, default-account assignment, and disablement must be immediately consistent to prevent payout routing errors

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for bank account lifecycle events.
* **Details:** Duplicate verification events must not double-count verification attempts.

### Worker Scaling
* **Policy:** Verification (micro-deposit, instant verification) and account linking must be independently scalable.

### Multi-Region Behavior
* **Mode:** Bank account data is global; verification status must converge across all regions before payout eligibility.
* **Details:** Payout routing must reject accounts whose verification status has not propagated.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `linkBankAccount(owner_id, account_details, idempotency_key?)`
  - `verifyBankAccount(bank_account_id, verification_data, idempotency_key?)`
  - `setDefaultBankAccount(owner_id, bank_account_id, idempotency_key?)`
  - `disableBankAccount(bank_account_id, reason, idempotency_key?)`

### Backpressure
* If verification requests are saturated, new verification attempts must be queued with a pending status rather than silently dropped.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).
* Domain errors: `BANK_ACCOUNT_NOT_FOUND`, `BANK_ACCOUNT_UNVERIFIED`, `BANK_ACCOUNT_DISABLED`, `VERIFICATION_FAILED`, `DEFAULT_ACCOUNT_CONFLICT`, `INSTITUTION_UNSUPPORTED`, `ACCOUNT_ALREADY_LINKED`, `VERIFICATION_EXPIRED`, `VERIFICATION_ATTEMPT_LIMIT_EXCEEDED`.

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
linkBankAccount       → bank_accounts.account.linked      { bank_account_id, owner_id, institution }
verifyBankAccount     → bank_accounts.account.verified    { bank_account_id, method }
                     OR bank_accounts.account.verification_failed { bank_account_id, reason }
setDefaultBankAccount → bank_accounts.default.changed     { bank_account_id, owner_id }
disableBankAccount    → bank_accounts.account.disabled    { bank_account_id, reason }
```

### Temporal Constraints
```
Verification:
    micro_deposit_timeout:  5 business days
    on_exceed:              status → failed; owner must re-initiate

    instant_verification_ttl: 300 seconds
    on_exceed:              token expired; new verification required

    attempt_limit:          3 per account per 24 hours
    on_exceed:              VERIFICATION_ATTEMPT_LIMIT_EXCEEDED

Disabled account cool-off:
    duration:               30 days before permanent deletion
    on_expiry:              eligible for hard-delete; audit trail preserved
```

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE bank_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL,
  institution_name  TEXT NOT NULL,
  account_type      TEXT NOT NULL CHECK (account_type IN ('checking', 'savings', 'virtual', 'wallet')),
  last4             TEXT NOT NULL,
  routing_masked    TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'unverified'
                      CHECK (status IN ('unverified', 'pending', 'verified', 'failed', 'disabled')),
  is_default        BOOLEAN NOT NULL DEFAULT false,
  verification_method TEXT,
  metadata          JSONB DEFAULT '{}',
  disabled_at       TIMESTAMPTZ,
  disabled_reason   TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_accounts_owner ON bank_accounts(owner_id, is_default DESC);
CREATE INDEX idx_bank_accounts_status ON bank_accounts(status);

CREATE TABLE bank_account_verifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  method          TEXT NOT NULL,
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  error_reason    TEXT,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_verifications_account ON bank_account_verifications(bank_account_id, created_at DESC);

CREATE TABLE bank_account_audit (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_account_id UUID NOT NULL,
  action          TEXT NOT NULL,
  actor_id        UUID,
  details         JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bank_account_audit_acc ON bank_account_audit(bank_account_id, created_at DESC);
```

### Storage Model
* **Model:** Durable bank account registry with masking and verification history.
* **Details:** Sensitive account numbers are never stored in plaintext; only masked/last4 data is persisted. Verification tokens and micro-deposit amounts are encrypted at rest.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `bank_accounts.<function>`.
* **Telemetry Metrics:**
```
blueprint_bank_accounts_operation_total              counter { function, result }
blueprint_bank_accounts_operation_duration_ms        histogram { function }
blueprint_bank_accounts_errors_total                 counter { function, error_code }
blueprint_bank_accounts_verifications_total           counter { method, status }
blueprint_bank_accounts_verification_duration_ms      histogram { method }
blueprint_bank_accounts_disabled_total                counter { reason }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** encryption, payments
* **Emits To:** events
* **Recommends:** transfers, payouts, audit_log, fraud_detection

### Breaking Change Policy
- Adding a new account type or verification method is additive and backward-compatible.
- Removing or renaming an existing status value requires a MAJOR version bump.
- Changing the verification attempt limit requires a MINOR version bump.
- Adding new required fields to `linkBankAccount` input requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Verification micro-deposit timeout | Provider delay or incorrect account details | Retry with new verification; escalate after 3 failures |
| Instant verification token expiry | User did not complete flow within TTL | Return VERIFICATION_EXPIRED; user re-initiates |
| Default account conflict | Multiple accounts set as default simultaneously | Enforce single-default constraint per owner_id |
| Institution unsupported | Provider does not support the bank | Return INSTITUTION_UNSUPPORTED; log for provider expansion |
| Payout routed to unverified account | Race condition in verification propagation | Reject payout; surface BANK_ACCOUNT_UNVERIFIED |
