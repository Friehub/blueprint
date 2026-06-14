// bank_accounts.ts
// Auto-generated from contracts/bank_accounts.md
// Do not edit manually

export interface Bankaccount {
  id: string;
  ownerId: string;
  institutionName: string;
  accountType: string;
  last4: unknown;
  routingMasked: unknown;
  status: unknown;
  isDefault: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type Verificationstatus = VerificationStatus = unverified | pending | verified | failed | disabled;

export type Accounttype = AccountType = checking | savings | virtual | wallet;

export interface BankAccountsContract {
  linkBankAccount(ownerId: unknown, accountDetails: unknown): Promise<BankAccount>;
  getBankAccount(bankAccountId: unknown): Promise<BankAccount>;
  listBankAccounts(ownerId: unknown, options?: unknown): Promise<PaginatedResult<BankAccount>>;
  verifyBankAccount(bankAccountId: unknown, verificationData: unknown): Promise<BankAccount>;
  setDefaultBankAccount(ownerId: unknown, bankAccountId: unknown): Promise<BankAccount>;
  disableBankAccount(bankAccountId: unknown, reason: unknown): Promise<BankAccount>;
  getVerificationStatus(bankAccountId: unknown): Promise<VerificationStatus>;
}
