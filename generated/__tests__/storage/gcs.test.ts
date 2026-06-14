// gcs.test.ts
// Auto-generated conformance test for gcs → storage
// Do not edit manually

import { GcsAdapter } from '../adapters/storage/gcs';
import type { StorageContract } from '../interfaces/storage';

describe('GcsAdapter implements StorageContract', () => {
  const adapter: StorageContract = new GcsAdapter({
    project_id: 'test',
    service_account_key: 'test'
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
