// algolia.test.ts
// Auto-generated conformance test for algolia → search
// Do not edit manually

import { AlgoliaAdapter } from '../adapters/search/algolia';
import type { SearchContract } from '../interfaces/search';

describe('AlgoliaAdapter implements SearchContract', () => {
  const adapter: SearchContract = new AlgoliaAdapter({
    app_id: 'test',
    api_key: 'test'
  });

  it('has indexDocument method', () => {
    expect(typeof adapter.indexDocument).toBe('function');
  });

  it('has indexBulk method', () => {
    expect(typeof adapter.indexBulk).toBe('function');
  });

  it('has removeDocument method', () => {
    expect(typeof adapter.removeDocument).toBe('function');
  });

  it('has search method', () => {
    expect(typeof adapter.search).toBe('function');
  });

  it('has suggest method', () => {
    expect(typeof adapter.suggest).toBe('function');
  });

  it('has reindex method', () => {
    expect(typeof adapter.reindex).toBe('function');
  });

  it('has getIndexStats method', () => {
    expect(typeof adapter.getIndexStats).toBe('function');
  });

  it('has createIndex method', () => {
    expect(typeof adapter.createIndex).toBe('function');
  });

  it('has deleteIndex method', () => {
    expect(typeof adapter.deleteIndex).toBe('function');
  });

});
