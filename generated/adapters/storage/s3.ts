// s3.ts
// Auto-generated adapter for s3 → storage
// Do not edit manually

import type { StorageContract } from '../interfaces/storage';

export class S3Adapter implements StorageContract {
  constructor(private config: {
  access_key_id: string;
  secret_access_key: string;
  region: string;
  }) {}

  uploadFile(bucket: unknown, key: unknown, content: unknown, options?: unknown): Promise<FileObject> {
    // TODO: Implement with uploadFile
    throw new Error('Not implemented');
  }
  downloadFile(bucket: unknown, key: unknown): Promise<FileStream> {
    // TODO: Implement with downloadFile
    throw new Error('Not implemented');
  }
  deleteFile(bucket: unknown, key: unknown): Promise<void> {
    // TODO: Implement with deleteFile
    throw new Error('Not implemented');
  }
  getSignedUrl(bucket: unknown, key: unknown, expiresIn: unknown): Promise<SignedUrl> {
    // TODO: Implement with getSignedUrl
    throw new Error('Not implemented');
  }
  getSignedUploadUrl(bucket: unknown, key: unknown, options?: unknown): Promise<SignedUrl> {
    // TODO: Implement with getSignedUploadUrl
    throw new Error('Not implemented');
  }
  listFiles(bucket: unknown, prefix?: unknown, options?: unknown): Promise<PaginatedResult<FileObject>> {
    // TODO: Implement with listFiles
    throw new Error('Not implemented');
  }
  moveFile(sourceBucket: unknown, sourceKey: unknown, destBucket: unknown, destKey: unknown): Promise<FileObject> {
    // TODO: Implement with moveFile
    throw new Error('Not implemented');
  }
  copyFile(sourceBucket: unknown, sourceKey: unknown, destBucket: unknown, destKey: unknown): Promise<FileObject> {
    // TODO: Implement with copyFile
    throw new Error('Not implemented');
  }
  getMetadata(bucket: unknown, key: unknown): Promise<FileMetadata> {
    // TODO: Implement with getMetadata
    throw new Error('Not implemented');
  }
}
