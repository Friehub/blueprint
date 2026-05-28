// config.ts
// Auto-generated from contracts/config.md
// Do not edit manually

export type ConfigKey = string;           // Namespaced key, e.g. "payments.timeout_ms", "auth.session_ttl_seconds"

export type ConfigChangeId = string;

export type ChangeStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED" | "APPLIED" | "ROLLED_BACK";

export type EntryStatus = "ACTIVE" | "DEPRECATED" | "ARCHIVED" | "DELETED";

export type ConfigConstraint = {
minValue?: number;
maxValue?: number;
allowedValues?: unknown[];
pattern?: string;                // Regex pattern for STRING type validation
jsonSchema?: Record<string, unknown>;
};

export type ConfigEntry = {
key: ConfigKey;
namespace: string;               // Derived from key prefix (e.g. "payments")
type: ConfigType;
value: unknown;                  // Typed at runtime per the `type` field; SECRET values are redacted
description?: string;
status: EntryStatus;
requiresApproval: boolean;
constraints?: ConfigConstraint;
version: number;
lastChangedAt: Timestamp;
lastChangedBy: UserId;
};

export type ConfigChange = {
changeId: ConfigChangeId;
key: ConfigKey;
previousValue?: unknown;
newValue: unknown;
status: ChangeStatus;
requestedBy: UserId;
requestedAt: Timestamp;
approvedBy?: UserId;
approvedAt?: Timestamp;
rejectedBy?: UserId;
rejectedAt?: Timestamp;
rejectionReason?: string;
appliedAt?: Timestamp;
};

export type SetConfigInput = {
key: ConfigKey;
type: ConfigType;
value: unknown;
description?: string;
requiresApproval?: boolean;
constraints?: ConfigConstraint;
requestedBy: UserId;
};

export type ListConfigsInput = {
namespace?: string;
type?: ConfigType;
status?: EntryStatus;
requiresApproval?: boolean;
pagination: PaginationInput;
};

export type ValidateConfigInput = {
key: ConfigKey;
value: unknown;
};

export type ValidationResult = {
valid: boolean;
errors: string[];
};

export interface ConfigContract {
  setConfig(input: SetConfigInput): Promise<ConfigEntry>;
  getConfig(key: ConfigKey): Promise<ConfigEntry>;
  getConfigs(keys: ConfigKey[]): Promise<ConfigEntry[]>;
  listConfigs(input: ListConfigsInput): Promise<PaginatedList<ConfigEntry>>;
  approveChange(changeId: ConfigChangeId): Promise<ConfigChange>;
  rejectChange(changeId: ConfigChangeId, reason: string): Promise<ConfigChange>;
  rollback(key: ConfigKey): Promise<ConfigEntry>;
  getHistory(key: ConfigKey): Promise<ConfigChange[]>;
  deleteConfig(key: ConfigKey): Promise<void>;
  validateConfig(input: ValidateConfigInput): Promise<ValidationResult>;
}
