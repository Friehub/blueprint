// ledger.ts
// Auto-generated from contracts/ledger.md
// Do not edit manually

export interface Ledger {
  id: string;
  name: unknown;
  currency: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export interface Ledgeraccount {
  id: string;
  ledgerId: string;
  type: unknown;
  currency: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export interface Ledgertransaction {
  id: string;
  ledgerId: string;
  postings: unknown;
  reference: unknown;
  postedAt: Timestamp;
  metadata: unknown;
}

export interface Posting {
  accountId: string;
  direction: unknown;
  amount: unknown;
}

export interface Ledgerbalance {
  accountId: string;
  balance: unknown;
  timestamp: unknown;
}

export type Ledgerstatus = LedgerStatus = active | suspended;

export type Accounttype = AccountType = asset | liability | equity | revenue | expense;

export type Accountstatus = AccountStatus = active | closed | frozen;

export type Postingdirection = PostingDirection = debit | credit;

export interface LedgerContract {
  createLedger(name: unknown, currency: unknown): Promise<Ledger>;
  createAccount(ledgerId: unknown, type: unknown, name?: unknown): Promise<LedgerAccount>;
  postTransaction(postings: unknown, reference: unknown, metadata?: unknown): Promise<LedgerTransaction>;
  getAccountBalance(accountId: unknown, timestamp?: unknown): Promise<LedgerBalance>;
  getLedgerTransactions(filters: unknown, options?: unknown): Promise<PaginatedResult<LedgerTransaction>>;
}
