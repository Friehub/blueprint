// maxmind.test.ts
// Auto-generated conformance test for maxmind → ip_intelligence
// Do not edit manually

import { MaxmindAdapter } from '../adapters/ip_intelligence/maxmind';
import type { IpIntelligenceContract } from '../interfaces/ip_intelligence';

describe('MaxmindAdapter implements IpIntelligenceContract', () => {
  const adapter: IpIntelligenceContract = new MaxmindAdapter({
    account_id: 'test',
    license_key: 'test'
  });

  it('has lookup method', () => {
    expect(typeof adapter.lookup).toBe('function');
  });

  it('has isVpn method', () => {
    expect(typeof adapter.isVpn).toBe('function');
  });

  it('has isTor method', () => {
    expect(typeof adapter.isTor).toBe('function');
  });

  it('has isDatacenter method', () => {
    expect(typeof adapter.isDatacenter).toBe('function');
  });

  it('has getGeolocation method', () => {
    expect(typeof adapter.getGeolocation).toBe('function');
  });

  it('has getThreatScore method', () => {
    expect(typeof adapter.getThreatScore).toBe('function');
  });

});
