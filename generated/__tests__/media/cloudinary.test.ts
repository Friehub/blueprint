// cloudinary.test.ts
// Auto-generated conformance test for cloudinary → media
// Do not edit manually

import { CloudinaryAdapter } from '../adapters/media/cloudinary';
import type { MediaContract } from '../interfaces/media';

describe('CloudinaryAdapter implements MediaContract', () => {
  const adapter: MediaContract = new CloudinaryAdapter({
    cloud_name: 'test',
    api_key: 'test',
    api_secret: 'test'
  });

  it('has uploadMedia method', () => {
    expect(typeof adapter.uploadMedia).toBe('function');
  });

  it('has processMedia method', () => {
    expect(typeof adapter.processMedia).toBe('function');
  });

  it('has getMediaAsset method', () => {
    expect(typeof adapter.getMediaAsset).toBe('function');
  });

  it('has getVariants method', () => {
    expect(typeof adapter.getVariants).toBe('function');
  });

  it('has deleteMediaAsset method', () => {
    expect(typeof adapter.deleteMediaAsset).toBe('function');
  });

  it('has generateThumbnail method', () => {
    expect(typeof adapter.generateThumbnail).toBe('function');
  });

  it('has transcodeVideo method', () => {
    expect(typeof adapter.transcodeVideo).toBe('function');
  });

  it('has getProcessingJob method', () => {
    expect(typeof adapter.getProcessingJob).toBe('function');
  });

});
