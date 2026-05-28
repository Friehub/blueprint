// encryption.ts
// Auto-generated from contracts/encryption.md
// Do not edit manually

export interface Encrypteddata {
  ciphertext: unknown;
  keyId: string;
  algorithm: unknown;
  iv: unknown;
}

export interface Key {
  id: string;
  algorithm: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export type Keystatus = KeyStatus = active | archived | compromised;

export interface EncryptionContract {
  encrypt(data: unknown, keyId?: unknown): Promise<EncryptedData>;
  decrypt(encryptedData: unknown): Promise<string>;
  generateKey(algorithm?: unknown): Promise<Key>;
  rotateKey(keyId: unknown): Promise<Key>;
  listKeys(): Promise<Key[]>;
  archiveKey(keyId: unknown): Promise<void>;
  hashPassword(password: unknown): Promise<string>;
  verifyPassword(password: unknown, hash: unknown): Promise<boolean>;
  generateSecret(length?: unknown): Promise<string>;
}
