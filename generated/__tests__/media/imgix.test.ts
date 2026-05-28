// imgix.test.ts
// Auto-generated conformance test for imgix → media
// Do not edit manually

import { ImgixAdapter } from '../adapters/media/imgix';
import type { MediaContract } from '../interfaces/media';

describe('ImgixAdapter implements MediaContract', () => {
  const adapter: MediaContract = new ImgixAdapter({
    domain: 'test',
    api_key: 'test'
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
