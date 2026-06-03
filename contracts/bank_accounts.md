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

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Verification and default-account changes must be strongly consistent.
- **Idempotency:** `linkBankAccount`, `verifyBankAccount`, and `setDefaultBankAccount` must be idempotent on account identity.
- **Storage Model:** Durable bank account registry with masking and verification history.
- **Dependencies:** `encryption`, `payments`, `transfers`, `payouts`, `audit_log`, `fraud_detection`.
- **Errors:** `BANK_ACCOUNT_NOT_FOUND`, `BANK_ACCOUNT_UNVERIFIED`, `BANK_ACCOUNT_DISABLED`, `VERIFICATION_FAILED`, `DEFAULT_ACCOUNT_CONFLICT`, `INSTITUTION_UNSUPPORTED`.
