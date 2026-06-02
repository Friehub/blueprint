// payments.ts
// Auto-generated from contracts/payments.md
// Do not edit manually

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  providerReference: string;
  createdAt: Timestamp;
}

export interface Wallet {
  userId: string;
  balance: number;
  currency: string;
  lockedBalance: number;
}

export interface Wallettransaction {
  id: string;
  type: credit|debit;
  amount: number;
  balanceAfter: number;
  reference: string;
  createdAt: Timestamp;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  status: string;
  reason: string;
  createdAt: Timestamp;
}

export type Paymentmethod = PaymentMethod = card | bank_transfer | wallet | ussd | qr_code;

export type Paymentstatus = PaymentStatus = pending | processing | completed | failed | refunded | disputed;

export interface PaymentsContract {
  initiatePayment(orderId: string, amount: number, currency: string, method: string): Promise<Payment>;
  verifyPayment(paymentId: string): Promise<Payment>;
  getPaymentByOrder(orderId: string): Promise<Payment | undefined>;
  getWallet(userId: string): Promise<Wallet>;
  creditWallet(userId: string, amount: number, currency: string, reference: string): Promise<WalletTransaction>;
  debitWallet(userId: string, amount: number, currency: string, reference: string): Promise<WalletTransaction>;
  getWalletTransactions(userId: string, options?: Record<string, unknown>): Promise<PaginatedResult<WalletTransaction>>;
  initiateRefund(paymentId: string, amount?: number, reason: string): Promise<Refund>;
  getRefundByOrder(orderId: string): Promise<Refund | undefined>;
  getRefund(refundId: string): Promise<Refund>;
}