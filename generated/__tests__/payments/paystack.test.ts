// paystack.test.ts
// Auto-generated conformance test for paystack → payments
// Do not edit manually

import { PaystackAdapter } from '../adapters/payments/paystack';
import type { PaymentsContract } from '../interfaces/payments';

describe('PaystackAdapter implements PaymentsContract', () => {
  const adapter: PaymentsContract = new PaystackAdapter({
    api_key: 'test',
    webhook_secret: 'test'
  });

  it('has initiatePayment method', () => {
    expect(typeof adapter.initiatePayment).toBe('function');
  });

  it('has verifyPayment method', () => {
    expect(typeof adapter.verifyPayment).toBe('function');
  });

  it('has getPaymentByOrder method', () => {
    expect(typeof adapter.getPaymentByOrder).toBe('function');
  });

  it('has getWallet method', () => {
    expect(typeof adapter.getWallet).toBe('function');
  });

  it('has creditWallet method', () => {
    expect(typeof adapter.creditWallet).toBe('function');
  });

  it('has debitWallet method', () => {
    expect(typeof adapter.debitWallet).toBe('function');
  });

  it('has getWalletTransactions method', () => {
    expect(typeof adapter.getWalletTransactions).toBe('function');
  });

  it('has initiateRefund method', () => {
    expect(typeof adapter.initiateRefund).toBe('function');
  });

  it('has getRefundByOrder method', () => {
    expect(typeof adapter.getRefundByOrder).toBe('function');
  });

  it('has getRefund method', () => {
    expect(typeof adapter.getRefund).toBe('function');
  });

});
