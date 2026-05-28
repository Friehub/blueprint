// fraud_detection.ts
// Auto-generated from contracts/fraud_detection.md
// Do not edit manually

export interface Riskscore {
  score: unknown;
  level: low|medium|high|critical;
  signals: unknown;
  recommendation: allow|review|block;
}

export interface Fraudreport {
  id: string;
  entityType: string;
  entityId: string;
  reason: unknown;
  reporterId: string;
  createdAt: Timestamp;
}

export interface Riskcontext {
  ipAddress: unknown;
}

export interface FraudDetectionContract {
  scoreTransaction(transaction: unknown, context: unknown): Promise<RiskScore>;
  scoreSignUp(data: unknown, context: unknown): Promise<RiskScore>;
  scoreLogin(userId: unknown, context: unknown): Promise<RiskScore>;
  reportFraud(transactionId: unknown, reason: unknown): Promise<FraudReport>;
  blockEntity(entityType: unknown, entityId: unknown, reason: unknown): Promise<void>;
  unblockEntity(entityType: unknown, entityId: unknown): Promise<void>;
  isBlocked(entityType: unknown, entityId: unknown): Promise<boolean>;
  getRiskHistory(entityType: unknown, entityId: unknown): Promise<RiskScore[]>;
}
