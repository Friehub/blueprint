// treasury_accounts.ts
// Auto-generated from contracts/treasury_accounts.md
// Do not edit manually

export interface Treasuryaccount {
  id: string;
  name: unknown;
  currency: unknown;
  status: unknown;
  balance: unknown;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Treasurymovement {
  id: string;
  accountId: string;
  type: unknown;
  amount: unknown;
  reference: unknown;
  balanceAfter: unknown;
  createdAt: Timestamp;
}

export interface Treasurylimit {
  accountId: string;
  dailyLimit: unknown;
  singleMovementLimit: unknown;
  reserveLimit: unknown;
}

export type Treasuryaccountstatus = TreasuryAccountStatus = active | frozen | closed;

export type Treasurymovementtype = TreasuryMovementType = credit | debit | reserve | release | transfer;

export interface TreasuryAccountsContract {
  createTreasuryAccount(name: unknown, currency: unknown, metadata?: unknown): Promise<TreasuryAccount>;
  getTreasuryAccount(accountId: unknown): Promise<TreasuryAccount>;
  listTreasuryAccounts(input: unknown, options?: unknown): Promise<PaginatedResult<TreasuryAccount>>;
  postTreasuryMovement(accountId: unknown, movement: unknown): Promise<TreasuryMovement>;
  getTreasuryMovements(accountId: unknown, options?: unknown): Promise<PaginatedResult<TreasuryMovement>>;
  freezeTreasuryAccount(accountId: unknown, reason: unknown): Promise<TreasuryAccount>;
  unfreezeTreasuryAccount(accountId: unknown): Promise<TreasuryAccount>;
  setTreasuryLimit(accountId: unknown, limits: unknown): Promise<TreasuryLimit>;
}
