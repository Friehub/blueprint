// riskified.ts
// Auto-generated adapter for riskified → fraud_detection
// Do not edit manually

import type { FraudDetectionContract } from '../interfaces/fraud_detection';

export class RiskifiedAdapter implements FraudDetectionContract {
  constructor(private config: {
  api_key: string;
  domain: string;
  }) {}

  scoreTransaction(transaction: unknown, context: unknown): Promise<RiskScore> {
    // TODO: Implement with scoreTransaction
    throw new Error('Not implemented');
  }
  scoreSignUp(data: unknown, context: unknown): Promise<RiskScore> {
    // TODO: Implement with scoreSignUp
    throw new Error('Not implemented');
  }
  scoreLogin(userId: unknown, context: unknown): Promise<RiskScore> {
    // TODO: Implement with scoreLogin
    throw new Error('Not implemented');
  }
  reportFraud(transactionId: unknown, reason: unknown): Promise<FraudReport> {
    // TODO: Implement with reportFraud
    throw new Error('Not implemented');
  }
  blockEntity(entityType: unknown, entityId: unknown, reason: unknown): Promise<void> {
    // TODO: Implement with blockEntity
    throw new Error('Not implemented');
  }
  unblockEntity(entityType: unknown, entityId: unknown): Promise<void> {
    // TODO: Implement with unblockEntity
    throw new Error('Not implemented');
  }
  isBlocked(entityType: unknown, entityId: unknown): Promise<boolean> {
    // TODO: Implement with isBlocked
    throw new Error('Not implemented');
  }
  getRiskHistory(entityType: unknown, entityId: unknown): Promise<RiskScore[]> {
    // TODO: Implement with getRiskHistory
    throw new Error('Not implemented');
  }
}
