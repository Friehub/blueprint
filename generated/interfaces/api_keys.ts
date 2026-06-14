// api_keys.ts
// Auto-generated from contracts/api_keys.md
// Do not edit manually

export interface Apikey {
  id: string;
  userId: string;
  name: unknown;
  prefix: unknown;
  scopes: unknown;
  createdAt: Timestamp;
}

export interface Apikeyvalidation {
  valid: unknown;
}

export interface ApiKeysContract {
  createApiKey(userId: unknown, name: unknown, scopes: unknown, expiresAt?: unknown): Promise<ApiKey>;
  getApiKey(keyId: unknown): Promise<ApiKey>;
  listApiKeys(userId: unknown): Promise<ApiKey[]>;
  revokeApiKey(keyId: unknown): Promise<void>;
  validateApiKey(rawKey: unknown): Promise<ApiKeyValidation>;
  rotateApiKey(keyId: unknown): Promise<ApiKey>;
}
