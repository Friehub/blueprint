# Module: secrets

**Version:** 0.1.0
**Part:** VII — Security and Compliance

## Purpose

Defines the interface for storing, rotating, and auditing secrets — credentials, API keys, certificates, and any high-sensitivity values that must be encrypted at rest, access-controlled per caller, and versioned with rotation history. This module is distinct from `config` (which manages typed, non-sensitive runtime configuration) and `encryption` (which provides cryptographic primitives). Secrets owns the full credential lifecycle: creation, versioning, rotation, access grants, and revocation.

---

## State Machine

### Secret State
```
ACTIVE → ROTATING → ACTIVE   (rotation completes; prior version deprecated)
ACTIVE → DEPRECATED           (older version after rotation)
ACTIVE → REVOKED              (emergency revocation)
DEPRECATED → DELETED          (TTL elapsed)
REVOKED → DELETED
```

### Version State
```
CURRENT → DEPRECATED → DELETED
CURRENT → REVOKED
```

Transitions:
- `ACTIVE → ROTATING`: `initiateRotation` called; both old and new versions coexist briefly
- `ROTATING → ACTIVE`: `confirmRotation` called; new version becomes `CURRENT`, old becomes `DEPRECATED`
- `ACTIVE → REVOKED`: `revokeSecret` called; immediate, irreversible
- `DEPRECATED → DELETED`: TTL elapsed per retention policy

---

## Functions

### `createSecret(input: CreateSecretInput) → SecretMetadata`
Creates a new named secret with an initial value. Returns metadata only — the value is never returned after creation except via `getSecretValue`.

### `getSecretMetadata(secretId: SecretId) → SecretMetadata`
Returns metadata (name, version, status, rotation schedule) without the secret value.

### `getSecretValue(secretId: SecretId, version?: number) → SecretValue`
Returns the plaintext secret value for the current or a specific version. This call is always logged in `audit_log`. Access requires an explicit grant.

### `updateSecretValue(input: UpdateSecretValueInput) → SecretMetadata`
Updates the secret to a new value, creating a new version. The previous version is retained per the retention policy.

### `initiateRotation(secretId: SecretId) → RotationToken`
Begins a rotation. The adapter generates or accepts a new value. Returns a `RotationToken` used to confirm.

### `confirmRotation(input: ConfirmRotationInput) → SecretMetadata`
Finalises rotation: the new value becomes current; the old version enters `DEPRECATED`. Used when the caller (not the adapter) manages the new value.

### `revokeSecret(secretId: SecretId, reason: string) → void`
Immediately invalidates all versions of a secret. All future `getSecretValue` calls return `SECRET_REVOKED`. Irreversible.

### `listSecrets(input: ListSecretsInput) → PaginatedList<SecretMetadata>`
Lists secrets by namespace or tag. Never includes values.

### `grantAccess(input: GrantAccessInput) → SecretGrant`
Grants a caller identity (service account, user, role) read access to a secret.

### `revokeAccess(grantId: SecretGrantId) → void`
Removes a caller's read access to a secret.

### `listVersions(secretId: SecretId) → SecretVersion[]`
Returns all versions of a secret with their status and timestamps. Never includes values.

### `scheduleRotation(input: ScheduleRotationInput) → SecretMetadata`
Attaches an automatic rotation schedule to a secret via the `jobs` module.

---

## Types

```typescript
type SecretId = string;
type SecretGrantId = string;
type RotationToken = string;

type SecretStatus = "ACTIVE" | "ROTATING" | "DEPRECATED" | "REVOKED" | "DELETED";
type SecretType = "OPAQUE" | "API_KEY" | "DATABASE_URL" | "CERTIFICATE" | "RSA_KEY" | "OAUTH_TOKEN";

type SecretMetadata = {
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

type SecretValue = {
  secretId: SecretId;
  version: number;
  value: string;                   // Plaintext secret; handle with care
  retrievedAt: Timestamp;
};

type SecretVersion = {
  version: number;
  status: "CURRENT" | "DEPRECATED" | "REVOKED";
  createdAt: Timestamp;
  deprecatedAt?: Timestamp;
  revokedAt?: Timestamp;
};

type SecretGrant = {
  grantId: SecretGrantId;
  secretId: SecretId;
  granteeType: "USER" | "SERVICE_ACCOUNT" | "ROLE";
  granteeId: string;
  grantedBy: UserId;
  grantedAt: Timestamp;
  expiresAt?: Timestamp;
};

type CreateSecretInput = {
  name: string;
  namespace: string;
  type: SecretType;
  value: string;
  description?: string;
  tags?: Record<string, string>;
  expiresAt?: Timestamp;
};

type UpdateSecretValueInput = {
  secretId: SecretId;
  newValue: string;
  reason?: string;
};

type ConfirmRotationInput = {
  secretId: SecretId;
  rotationToken: RotationToken;
  newValue: string;
};

type GrantAccessInput = {
  secretId: SecretId;
  granteeType: "USER" | "SERVICE_ACCOUNT" | "ROLE";
  granteeId: string;
  grantedBy: UserId;
  expiresAt?: Timestamp;
};

type ScheduleRotationInput = {
  secretId: SecretId;
  cronExpression: string;
  rotationHandler: string;         // Reference to the handler that knows how to rotate this secret type
};

type ListSecretsInput = {
  namespace?: string;
  type?: SecretType;
  status?: SecretStatus;
  tags?: Record<string, string>;
  pagination: PaginationInput;
};
```

---

## Invariants

1. Secret values are never returned in `listSecrets`, `getSecretMetadata`, or `listVersions`; only `getSecretValue` returns plaintext.
2. Every `getSecretValue` call must write an immutable entry to `audit_log` with the caller identity, timestamp, and secret ID — regardless of success or failure.
3. Access to `getSecretValue` requires an active `SecretGrant` for the calling identity; callers without a grant receive `ACCESS_DENIED`, not `SECRET_NOT_FOUND`.
4. `revokeSecret` is irreversible at the contract level; no `unrevokeSecret` function exists.
5. Secret names are unique within a namespace; duplicate creation within the same namespace returns the existing secret's metadata.
6. Deprecated versions are retained for a minimum of 7 days after rotation to allow in-flight consumers to migrate; deletion before 7 days is a contract violation.
7. `updateSecretValue` and `confirmRotation` must increment `currentVersion` atomically; concurrent rotation calls must be serialised per secret.
8. Expired secrets (past `expiresAt`) transition to `DEPRECATED` automatically; `getSecretValue` on an expired secret returns `SECRET_EXPIRED`.

---

## Events Emitted

- `secret.created`
- `secret.value_updated` — includes `secretId`, `newVersion` (no value)
- `secret.rotation_initiated`
- `secret.rotation_confirmed` — includes `newVersion`, `deprecatedVersion`
- `secret.revoked` — includes `reason`
- `secret.access_granted`
- `secret.access_revoked`
- `secret.expired`
- `secret.accessed` — emitted to audit_log only, not the event bus

---

## System-Level Integrations

- **Idempotency:** `createSecret` is idempotent on `(name, namespace)`; duplicate calls return existing metadata.
- **Consistency:** Secret values must be encrypted before any write operation completes; plaintext must never touch durable storage.
- **Runtime delivery:** Secret lifecycle events are delivered `at_least_once`.
- **Worker scaling:** Rotation scheduling and access checks must be independently scalable.
- **Multi-region:** The deployment must declare whether secret state is single-region or active/passive; revocation must converge across regions.
- **Observability:** All reads of secret values are audit log entries. Metric counters for `secret_access_total` and `secret_rotation_total` must be maintained per secret namespace.
- **Backpressure:** If rotation or access validation capacity is saturated, the module must defer or reject predictably rather than serving stale secret state.
- **Dead-letter handling:** Failed rotations must remain queryable until the operator review or retry window expires.
- **Storage model:** Secret values are encrypted at rest in a durable secret store; deprecated versions must remain retained for the documented migration window.
- **Dependencies:** `encryption` (value encryption at rest), `audit_log` (mandatory access logging), `jobs` (auto-rotation scheduling), `permissions` (grant evaluation).
- **Errors:** `SECRET_NOT_FOUND`, `ACCESS_DENIED`, `SECRET_REVOKED`, `SECRET_EXPIRED`, `ROTATION_IN_PROGRESS`, `INVALID_ROTATION_TOKEN`, `NAMESPACE_CONFLICT`.
- **Providers (adapter examples):** HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager, Azure Key Vault, Doppler, Infisical.
