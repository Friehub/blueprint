// stripe.ts
// Auto-generated adapter for stripe → payments
// Types are inferred from naming conventions. Review before production use.

import Stripe from 'stripe';
import type { PaymentsContract } from '../interfaces/payments';

export class StripeAdapter implements PaymentsContract {
  constructor(private config: {
  api_key: string;
  webhook_secret: string;
  }) {}

  async initiatePayment(orderId: string, amount: number, currency: string, method: string): Promise<Payment> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      payment_method: method,
      metadata: { orderId },
    });
    return this.toPayment(paymentIntent);
  }
  async verifyPayment(paymentId: string): Promise<Payment> {
    const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentId);
    return this.toPayment(paymentIntent);
  }
  async getPaymentByOrder(orderId: string): Promise<Payment | undefined> {
    const paymentIntents = await this.stripe.paymentIntents.list({
      limit: 1,
      query: `metadata['orderId']:'${orderId}'`,
    });
    if (paymentIntents.data.length === 0) return undefined;
    return this.toPayment(paymentIntents.data[0]);
  }
  async getWallet(userId: string): Promise<Wallet> {
    throw new Error('Not supported by stripe: getWallet');
  }
  async creditWallet(userId: string, amount: number, currency: string, reference: string): Promise<WalletTransaction> {
    throw new Error('Not supported by stripe: creditWallet');
  }
  async debitWallet(userId: string, amount: number, currency: string, reference: string): Promise<WalletTransaction> {
    throw new Error('Not supported by stripe: debitWallet');
  }
  async getWalletTransactions(userId: string, options?: Record<string, unknown>): Promise<PaginatedResult<WalletTransaction>> {
    throw new Error('Not supported by stripe: getWalletTransactions');
  }
  async initiateRefund(paymentId: string, amount?: number, reason: string): Promise<Refund> {
    const refund = await this.stripe.refunds.create({
      payment_intent: paymentId,
      amount: amount ? Math.round(amount * 100) : undefined,
      reason: reason as any,
    });
    return { id: refund.id, paymentId, amount: refund.amount / 100, status: refund.status, reason: reason || '', createdAt: new Date(refund.created * 1000).toISOString() };
  }
  async getRefundByOrder(orderId: string): Promise<Refund | undefined> {
    const payment = await this.getPaymentByOrder(orderId);
    if (!payment) return undefined;
    return this.getRefund(payment.id);
  }
  async getRefund(refundId: string): Promise<Refund> {
    const refund = await this.stripe.refunds.retrieve(refundId);
    return { id: refund.id, paymentId: refund.payment_intent as string, amount: refund.amount / 100, status: refund.status, reason: refund.reason || '', createdAt: new Date(refund.created * 1000).toISOString() };
  }
}