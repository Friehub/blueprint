// secrets.ts
// Auto-generated from contracts/secrets.md
// Do not edit manually

export type SecretId = string;

export type SecretGrantId = string;

export type RotationToken = string;

export type SecretStatus = "ACTIVE" | "ROTATING" | "DEPRECATED" | "REVOKED" | "DELETED";

export type SecretType = "OPAQUE" | "API_KEY" | "DATABASE_URL" | "CERTIFICATE" | "RSA_KEY" | "OAUTH_TOKEN";

export type SecretMetadata = {
secretId: SecretId;
name: string;
namespace: string;
type: SecretType;
description?: string;
status: SecretStatus;
currentVersion: number;
tags?: Record<string, string>;
rotationSchedule?: string;       // Cron expression if auto-rotation configured
lastRotatedAt?: Timestamp;
expiresAt?: Timestamp;
createdAt: Timestamp;
updatedAt: Timestamp;
};

export type SecretValue = {
secretId: SecretId;
version: number;
value: string;                   // Plaintext secret; handle with care
retrievedAt: Timestamp;
};

export type SecretVersion = {
version: number;
status: "CURRENT" | "DEPRECATED" | "REVOKED";
createdAt: Timestamp;
deprecatedAt?: Timestamp;
revokedAt?: Timestamp;
};

export type SecretGrant = {
grantId: SecretGrantId;
secretId: SecretId;
granteeType: "USER" | "SERVICE_ACCOUNT" | "ROLE";
granteeId: string;
grantedBy: UserId;
grantedAt: Timestamp;
expiresAt?: Timestamp;
};

export type CreateSecretInput = {
name: string;
namespace: string;
type: SecretType;
value: string;
description?: string;
tags?: Record<string, string>;
expiresAt?: Timestamp;
};

export type UpdateSecretValueInput = {
secretId: SecretId;
newValue: string;
reason?: string;
};

export type ConfirmRotationInput = {
secretId: SecretId;
rotationToken: RotationToken;
newValue: string;
};

export type GrantAccessInput = {
secretId: SecretId;
granteeType: "USER" | "SERVICE_ACCOUNT" | "ROLE";
granteeId: string;
grantedBy: UserId;
expiresAt?: Timestamp;
};

export type ScheduleRotationInput = {
secretId: SecretId;
cronExpression: string;
rotationHandler: string;         // Reference to the handler that knows how to rotate this secret type
};

export type ListSecretsInput = {
namespace?: string;
type?: SecretType;
status?: SecretStatus;
tags?: Record<string, string>;
pagination: PaginationInput;
};

export interface SecretsContract {
  createSecret(input: CreateSecretInput): Promise<SecretMetadata>;
  getSecretMetadata(secretId: SecretId): Promise<SecretMetadata>;
  getSecretValue(secretId: SecretId, version?: number): Promise<SecretValue>;
  updateSecretValue(input: UpdateSecretValueInput): Promise<SecretMetadata>;
  initiateRotation(secretId: SecretId): Promise<RotationToken>;
  confirmRotation(input: ConfirmRotationInput): Promise<SecretMetadata>;
  revokeSecret(secretId: SecretId, reason: string): Promise<void>;
  listSecrets(input: ListSecretsInput): Promise<PaginatedList<SecretMetadata>>;
  grantAccess(input: GrantAccessInput): Promise<SecretGrant>;
  revokeAccess(grantId: SecretGrantId): Promise<void>;
  listVersions(secretId: SecretId): Promise<SecretVersion[]>;
  scheduleRotation(input: ScheduleRotationInput): Promise<SecretMetadata>;
}
