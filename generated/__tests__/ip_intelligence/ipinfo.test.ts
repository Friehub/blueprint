// ipinfo.test.ts
// Auto-generated conformance test for ipinfo → ip_intelligence
// Do not edit manually

import { IpinfoAdapter } from '../adapters/ip_intelligence/ipinfo';
import type { IpIntelligenceContract } from '../interfaces/ip_intelligence';

describe('IpinfoAdapter implements IpIntelligenceContract', () => {
  const adapter: IpIntelligenceContract = new IpinfoAdapter({
    api_token: 'test'
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
