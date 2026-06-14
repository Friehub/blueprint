// s3.test.ts
// Auto-generated conformance test for s3 → storage
// Do not edit manually

import { S3Adapter } from '../adapters/storage/s3';
import type { StorageContract } from '../interfaces/storage';

describe('S3Adapter implements StorageContract', () => {
  const adapter: StorageContract = new S3Adapter({
    access_key_id: 'test',
    secret_access_key: 'test',
    region: 'test'
  });

  it('has uploadFile method', () => {
    expect(typeof adapter.uploadFile).toBe('function');
  });

  it('has downloadFile method', () => {
    expect(typeof adapter.downloadFile).toBe('function');
  });

  it('has deleteFile method', () => {
    expect(typeof adapter.deleteFile).toBe('function');
  });

  it('has getSignedUrl method', () => {
    expect(typeof adapter.getSignedUrl).toBe('function');
  });

  it('has getSignedUploadUrl method', () => {
    expect(typeof adapter.getSignedUploadUrl).toBe('function');
  });

  it('has listFiles method', () => {
    expect(typeof adapter.listFiles).toBe('function');
  });

  it('has moveFile method', () => {
    expect(typeof adapter.moveFile).toBe('function');
  });

  it('has copyFile method', () => {
    expect(typeof adapter.copyFile).toBe('function');
  });

  it('has getMetadata method', () => {
    expect(typeof adapter.getMetadata).toBe('function');
  });

});
