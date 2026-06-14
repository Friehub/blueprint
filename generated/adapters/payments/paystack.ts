// paystack.ts
// Auto-generated adapter for paystack → payments
// Do not edit manually

import type { PaymentsContract } from '../interfaces/payments';

export class PaystackAdapter implements PaymentsContract {
  constructor(private config: {
  api_key: string;
  webhook_secret: string;
  }) {}

  initiatePayment(orderId: unknown, amount: unknown, currency: unknown, method: unknown): Promise<Payment> {
    // TODO: Implement with initiatePayment
    throw new Error('Not implemented');
  }
  verifyPayment(paymentId: unknown): Promise<Payment> {
    // TODO: Implement with verifyPayment
    throw new Error('Not implemented');
  }
  getPaymentByOrder(orderId: unknown): Promise<Payment | undefined> {
    // TODO: Implement with getPaymentByOrder
    throw new Error('Not implemented');
  }
  initiateRefund(paymentId: unknown, amount?: unknown, reason: unknown): Promise<Refund> {
    // TODO: Implement with initiateRefund
    throw new Error('Not implemented');
  }
  getRefundByOrder(orderId: unknown): Promise<Refund | undefined> {
    // TODO: Implement with getRefundByOrder
    throw new Error('Not implemented');
  }
  getRefund(refundId: unknown): Promise<Refund> {
    // TODO: Implement with getRefund
    throw new Error('Not implemented');
  }
}
