// typesense.test.ts
// Auto-generated conformance test for typesense → search
// Do not edit manually

import { TypesenseAdapter } from '../adapters/search/typesense';
import type { SearchContract } from '../interfaces/search';

describe('TypesenseAdapter implements SearchContract', () => {
  const adapter: SearchContract = new TypesenseAdapter({
    host: 'test',
    api_key: 'test',
    collection: 'test'
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
