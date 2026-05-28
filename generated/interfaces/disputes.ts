// disputes.ts
// Auto-generated from contracts/disputes.md
// Do not edit manually

export type DisputeId = string;

export type DisputeEvidenceId = string;

export type DisputeOutcome = "WON" | "LOST";

export type DisputeEvidence = {
evidenceId: DisputeEvidenceId;
type: EvidenceType;
description: string;
storageRef: string;              // Reference to file in storage module
uploadedAt: Timestamp;
};

export type Dispute = {
disputeId: DisputeId;
transactionId: string;
paymentProvider: string;
providerDisputeId?: string;      // Provider's own reference for the dispute
amount: number;
currency: string;
reason: DisputeReason;
status: DisputeStatus;
evidenceDeadline?: Timestamp;    // Deadline for submitting evidence
evidence: DisputeEvidence[];
rebuttalNarrative?: string;
outcome?: DisputeOutcome;
outcomeReason?: string;
openedAt: Timestamp;
resolvedAt?: Timestamp;
closedAt?: Timestamp;
};

export type OpenDisputeInput = {
transactionId: string;
paymentProvider: string;
providerDisputeId?: string;
amount: number;
currency: string;
reason: DisputeReason;
evidenceDeadline?: Timestamp;
metadata?: Record<string, unknown>;
};

export type SubmitEvidenceInput = {
disputeId: DisputeId;
evidence: {
type: EvidenceType;
description: string;
storageRef: string;
}[];
rebuttalNarrative: string;
};

export type RecordDecisionInput = {
disputeId: DisputeId;
outcome: DisputeOutcome;
outcomeReason?: string;
resolvedAt?: Timestamp;
};

export type ListDisputesInput = {
status?: DisputeStatus;
reason?: DisputeReason;
fromDate?: Timestamp;
toDate?: Timestamp;
minAmount?: number;
maxAmount?: number;
currency?: string;
pagination: PaginationInput;
};

export type DisputeStatsInput = {
fromDate: Timestamp;
toDate: Timestamp;
currency?: string;
};

export type DisputeStats = {
totalDisputes: number;
openDisputes: number;
won: number;
lost: number;
accepted: number;
winRate: number;                 // won / (won + lost) * 100
totalAmountDisputed: number;
totalAmountRecovered: number;
totalAmountLost: number;
currency: string;
};

export interface DisputesContract {
  openDispute(input: OpenDisputeInput): Promise<Dispute>;
  getDispute(disputeId: DisputeId): Promise<Dispute>;
  getDisputeByTransactionId(transactionId: string): Promise<Dispute>;
  listDisputes(input: ListDisputesInput): Promise<PaginatedList<Dispute>>;
  submitEvidence(input: SubmitEvidenceInput): Promise<Dispute>;
  acceptDispute(disputeId: DisputeId, reason?: string): Promise<Dispute>;
  recordDecision(input: RecordDecisionInput): Promise<Dispute>;
  closeDispute(disputeId: DisputeId): Promise<Dispute>;
  getDisputeStats(input: DisputeStatsInput): Promise<DisputeStats>;
}
