// kyc.ts
// Auto-generated from contracts/kyc.md
// Do not edit manually

export interface Verificationrequest {
  id: string;
  userId: string;
  status: unknown;
  documents: unknown;
  submittedAt: Timestamp;
}

export type Verificationstatus = VerificationStatus = not_started | pending | approved | rejected | expired;

export type Documenttype = DocumentType = passport | national_id | drivers_license | utility_bill | selfie;

export interface KycContract {
  submitVerification(userId: unknown, documents: unknown, data: unknown): Promise<VerificationRequest>;
  getVerification(requestId: unknown): Promise<VerificationRequest>;
  getUserVerification(userId: unknown): Promise<VerificationRequest | undefined>;
  getVerificationStatus(userId: unknown): Promise<VerificationStatus>;
  updateVerification(requestId: unknown, data: unknown): Promise<VerificationRequest>;
  rejectVerification(requestId: unknown, reason: unknown): Promise<VerificationRequest>;
  approveVerification(requestId: unknown): Promise<VerificationRequest>;
  listPendingVerifications(options?: unknown): Promise<PaginatedResult<VerificationRequest>>;
}
