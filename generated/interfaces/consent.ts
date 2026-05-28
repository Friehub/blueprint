// consent.ts
// Auto-generated from contracts/consent.md
// Do not edit manually

export interface Consentrecord {
  userId: string;
  purposes: ConsentPurpose[];
  version: unknown;
  createdAt: Timestamp;
}

export type Consentpurpose = ConsentPurpose = analytics | marketing | personalisation | functional;

export interface Dataexportjob {
  id: string;
  userId: string;
  status: unknown;
}

export interface Datadeletionjob {
  id: string;
  userId: string;
  status: unknown;
}

export interface ConsentContract {
  recordConsent(userId: unknown, purposes: unknown, version: unknown): Promise<ConsentRecord>;
  getConsent(userId: unknown): Promise<ConsentRecord | undefined>;
  withdrawConsent(userId: unknown, purposes?: unknown): Promise<void>;
  hasConsented(userId: unknown, purpose: unknown): Promise<boolean>;
  getConsentHistory(userId: unknown): Promise<ConsentRecord[]>;
  exportUserData(userId: unknown): Promise<DataExportJob>;
  deleteUserData(userId: unknown): Promise<DataDeletionJob>;
  getJob(jobId: unknown): Promise<ExportOrDeletionJob>;
}
