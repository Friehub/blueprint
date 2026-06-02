// stripe.ts
// Auto-generated adapter for stripe → payments
// Do not edit manually

import type { PaymentsContract } from '../interfaces/payments';

export class StripeAdapter implements PaymentsContract {
  constructor(private config: {
  api_key: string;
  webhook_secret: string;
  }) {}

  async initiatePayment(orderId: unknown, amount: unknown, currency: unknown, method: unknown): Promise<Payment> {
  // stripe.paymentIntents.create({ amount, currency, payment_method })
  return {} as any;
}
  async verifyPayment(paymentId: unknown): Promise<Payment> {
  throw new Error('Not implemented: verifyPayment');
}
  async getPaymentByOrder(orderId: unknown): Promise<Payment | undefined> {
  throw new Error('Not implemented: getPaymentByOrder');
}
  async getWallet(userId: unknown): Promise<Wallet> {
    throw new Error('Not supported by stripe: getWallet');
  }
  async creditWallet(userId: unknown, amount: unknown, currency: unknown, reference: unknown): Promise<WalletTransaction> {
    throw new Error('Not supported by stripe: creditWallet');
  }
  async debitWallet(userId: unknown, amount: unknown, currency: unknown, reference: unknown): Promise<WalletTransaction> {
    throw new Error('Not supported by stripe: debitWallet');
  }
  async getWalletTransactions(userId: unknown, options?: unknown): Promise<PaginatedResult<WalletTransaction>> {
    throw new Error('Not supported by stripe: getWalletTransactions');
  }
  async initiateRefund(paymentId: unknown, amount?: unknown, reason: unknown): Promise<Refund> {
  throw new Error('Not implemented: initiateRefund');
}
  async getRefundByOrder(orderId: unknown): Promise<Refund | undefined> {
  throw new Error('Not implemented: getRefundByOrder');
}
  async getRefund(refundId: unknown): Promise<Refund> {
  throw new Error('Not implemented: getRefund');
}
}