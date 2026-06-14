# Module Contract: `treasury_accounts`

**Version:** 0.1.0

---

### `treasury_accounts`
Treasury cash accounts, balances, account movements, and internal treasury controls.

**Functions**
```
createTreasuryAccount(name, currency, metadata?) → TreasuryAccount
getTreasuryAccount(account_id) → TreasuryAccount
listTreasuryAccounts(input, options?) → PaginatedResult<TreasuryAccount>
postTreasuryMovement(account_id, movement) → TreasuryMovement
getTreasuryMovements(account_id, options?) → PaginatedResult<TreasuryMovement>
freezeTreasuryAccount(account_id, reason) → TreasuryAccount
unfreezeTreasuryAccount(account_id) → TreasuryAccount
setTreasuryLimit(account_id, limits) → TreasuryLimit
```

**Types**
```
TreasuryAccount { id, name, currency, status, balance, created_at, updated_at }
TreasuryMovement { id, account_id, type, amount, reference, balance_after, created_at }
TreasuryLimit { account_id, daily_limit, single_movement_limit, reserve_limit }
TreasuryAccountStatus = active | frozen | closed
TreasuryMovementType = credit | debit | reserve | release | transfer
```

**Invariants**
- Treasury balances must be immediately consistent.
- Frozen accounts must not accept new debits.
- Movements must be append-only and auditable.

**Providers:** treasury management systems, internal cash ledgers, banking treasury tools, Stripe Treasury, Moov Treasury

---

## System-Level Integrations

- **Runtime Standards:** Inherits `contracts/core/runtime_standards.md`.
- **Consistency:** Balance-affecting movements must be strongly consistent.
- **Idempotency:** `postTreasuryMovement`, `freezeTreasuryAccount`, and `unfreezeTreasuryAccount` must be idempotent on account/movement identity.
- **Storage Model:** Durable treasury ledger with movement history and limits.
- **Dependencies:** `ledger`, `bank_accounts`, `transfers`, `payments`, `audit_log`, `fraud_detection`.
- **Errors:** `TREASURY_ACCOUNT_NOT_FOUND`, `TREASURY_LIMIT_EXCEEDED`, `ACCOUNT_FROZEN`, `MOVEMENT_DUPLICATE`, `INSUFFICIENT_TREASURY_BALANCE`.
