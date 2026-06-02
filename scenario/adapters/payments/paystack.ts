// paystack.ts
// Auto-generated adapter for paystack → payments
// Do not edit manually

import type { PaymentsContract } from '../interfaces/payments';

export class PaystackAdapter implements PaymentsContract {
  constructor(private config: {
  api_key: string;
  webhook_secret: string;
  }) {}

  async initiatePayment(orderId: string, amount: number, currency: string, method: string): Promise<Payment> {
  throw new Error('Not implemented: initiatePayment');
}
  async verifyPayment(paymentId: string): Promise<Payment> {
  throw new Error('Not implemented: verifyPayment');
}
  async getPaymentByOrder(orderId: string): Promise<Payment | undefined> {
  throw new Error('Not implemented: getPaymentByOrder');
}
  async getWallet(userId: string): Promise<Wallet> {
    throw new Error('Not supported by paystack: getWallet');
  }
  async creditWallet(userId: string, amount: number, currency: string, reference: string): Promise<WalletTransaction> {
    throw new Error('Not supported by paystack: creditWallet');
  }
  async debitWallet(userId: string, amount: number, currency: string, reference: string): Promise<WalletTransaction> {
    throw new Error('Not supported by paystack: debitWallet');
  }
  async getWalletTransactions(userId: string, options?: Record<string, unknown>): Promise<PaginatedResult<WalletTransaction>> {
    throw new Error('Not supported by paystack: getWalletTransactions');
  }
  async initiateRefund(paymentId: string, amount?: number, reason: string): Promise<Refund> {
  throw new Error('Not implemented: initiateRefund');
}
  async getRefundByOrder(orderId: string): Promise<Refund | undefined> {
  throw new Error('Not implemented: getRefundByOrder');
}
  async getRefund(refundId: string): Promise<Refund> {
  throw new Error('Not implemented: getRefund');
}
}