// security_settings.ts
// Auto-generated from contracts/security_settings.md
// Do not edit manually

export interface Securitysettings {
  userId: string;
  twoFactorEnabled: unknown;
  loginAlertsEnabled: unknown;
  updatedAt: Timestamp;
}

export type Twofactormethod = TwoFactorMethod = totp | sms | email | webauthn | backup_code;

export interface Recoverycodes {
  userId: string;
  codes: unknown;
  generatedAt: Timestamp;
}

export interface Trusteddevice {
  id: string;
  userId: string;
  name: unknown;
  lastSeenAt: Timestamp;
  createdAt: Timestamp;
}

export interface SecuritySettingsContract {
  getSecuritySettings(userId: unknown): Promise<SecuritySettings>;
  enableTwoFactor(userId: unknown, method: unknown, options?: unknown): Promise<SecuritySettings>;
  disableTwoFactor(userId: unknown, verification: unknown): Promise<SecuritySettings>;
  generateRecoveryCodes(userId: unknown): Promise<RecoveryCodes>;
  revokeRecoveryCode(userId: unknown, code: unknown): Promise<void>;
  listTrustedDevices(userId: unknown, options?: unknown): Promise<PaginatedResult<TrustedDevice>>;
  revokeTrustedDevice(userId: unknown, deviceId: unknown): Promise<void>;
  setLoginAlerts(userId: unknown, enabled: unknown): Promise<SecuritySettings>;
}
