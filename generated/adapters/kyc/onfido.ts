// onfido.ts
// Auto-generated adapter for onfido → kyc
// Do not edit manually

import type { KycContract } from '../interfaces/kyc';

export class OnfidoAdapter implements KycContract {
  constructor(private config: {
  api_token: string;
  region: string;
  }) {}

  submitVerification(userId: unknown, documents: unknown, data: unknown): Promise<VerificationRequest> {
    // TODO: Implement with submitVerification
    throw new Error('Not implemented');
  }
  getVerification(requestId: unknown): Promise<VerificationRequest> {
    // TODO: Implement with getVerification
    throw new Error('Not implemented');
  }
  getUserVerification(userId: unknown): Promise<VerificationRequest | undefined> {
    // TODO: Implement with getUserVerification
    throw new Error('Not implemented');
  }
  getVerificationStatus(userId: unknown): Promise<VerificationStatus> {
    // TODO: Implement with getVerificationStatus
    throw new Error('Not implemented');
  }
  updateVerification(requestId: unknown, data: unknown): Promise<VerificationRequest> {
    // TODO: Implement with updateVerification
    throw new Error('Not implemented');
  }
  rejectVerification(requestId: unknown, reason: unknown): Promise<VerificationRequest> {
    // TODO: Implement with rejectVerification
    throw new Error('Not implemented');
  }
  approveVerification(requestId: unknown): Promise<VerificationRequest> {
    // TODO: Implement with approveVerification
    throw new Error('Not implemented');
  }
  listPendingVerifications(options?: unknown): Promise<PaginatedResult<VerificationRequest>> {
    // TODO: Implement with listPendingVerifications
    throw new Error('Not implemented');
  }
}
