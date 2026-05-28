// payments.ts
// Auto-generated from contracts/payments.md
// Do not edit manually

export interface Payment {
  id: string;
  orderId: string;
  amount: unknown;
  currency: unknown;
  status: unknown;
  method: unknown;
  providerReference: unknown;
  createdAt: Timestamp;
}

export interface Wallet {
  userId: string;
  balance: unknown;
  currency: unknown;
  lockedBalance: unknown;
}

export interface Wallettransaction {
  id: string;
  type: credit|debit;
  amount: unknown;
  balanceAfter: unknown;
  reference: unknown;
  createdAt: Timestamp;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: unknown;
  status: unknown;
  reason: unknown;
  createdAt: Timestamp;
}

export type Paymentmethod = PaymentMethod = card | bank_transfer | wallet | ussd | qr_code;

export type Paymentstatus = PaymentStatus = pending | processing | completed | failed | refunded | disputed;

export interface PaymentsContract {
  initiatePayment(orderId: unknown, amount: unknown, currency: unknown, method: unknown): Promise<Payment>;
  verifyPayment(paymentId: unknown): Promise<Payment>;
  getPaymentByOrder(orderId: unknown): Promise<Payment | undefined>;
  getWallet(userId: unknown): Promise<Wallet>;
  creditWallet(userId: unknown, amount: unknown, currency: unknown, reference: unknown): Promise<WalletTransaction>;
  debitWallet(userId: unknown, amount: unknown, currency: unknown, reference: unknown): Promise<WalletTransaction>;
  getWalletTransactions(userId: unknown, options?: unknown): Promise<PaginatedResult<WalletTransaction>>;
  initiateRefund(paymentId: unknown, amount?: unknown, reason: unknown): Promise<Refund>;
  getRefundByOrder(orderId: unknown): Promise<Refund | undefined>;
  getRefund(refundId: unknown): Promise<Refund>;
}
