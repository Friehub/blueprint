// storage.ts
// Auto-generated from contracts/storage.md
// Do not edit manually

export interface Fileobject {
  key: unknown;
  bucket: unknown;
  size: unknown;
  contentType: string;
  url: unknown;
  createdAt: Timestamp;
}

export interface Filemetadata {
  size: unknown;
  contentType: string;
  lastModified: unknown;
  etag: unknown;
  custom: unknown;
}

export interface Signedurl {
  url: unknown;
  expiresAt: Timestamp;
  method: GET | PUT;
}

export interface StorageContract {
  uploadFile(bucket: unknown, key: unknown, content: unknown, options?: unknown): Promise<FileObject>;
  downloadFile(bucket: unknown, key: unknown): Promise<FileStream>;
  deleteFile(bucket: unknown, key: unknown): Promise<void>;
  getSignedUrl(bucket: unknown, key: unknown, expiresIn: unknown): Promise<SignedUrl>;
  getSignedUploadUrl(bucket: unknown, key: unknown, options?: unknown): Promise<SignedUrl>;
  listFiles(bucket: unknown, prefix?: unknown, options?: unknown): Promise<PaginatedResult<FileObject>>;
  moveFile(sourceBucket: unknown, sourceKey: unknown, destBucket: unknown, destKey: unknown): Promise<FileObject>;
  copyFile(sourceBucket: unknown, sourceKey: unknown, destBucket: unknown, destKey: unknown): Promise<FileObject>;
  getMetadata(bucket: unknown, key: unknown): Promise<FileMetadata>;
}
