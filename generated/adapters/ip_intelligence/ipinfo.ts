// ipinfo.ts
// Auto-generated adapter for ipinfo → ip_intelligence
// Do not edit manually

import type { IpIntelligenceContract } from '../interfaces/ip_intelligence';

export class IpinfoAdapter implements IpIntelligenceContract {
  constructor(private config: {
  api_token: string;
  }) {}

  lookup(ipAddress: unknown): Promise<IpIntelligence> {
    // TODO: Implement with lookup
    throw new Error('Not implemented');
  }
  isVpn(ipAddress: unknown): Promise<boolean> {
    // TODO: Implement with isVpn
    throw new Error('Not implemented');
  }
  isTor(ipAddress: unknown): Promise<boolean> {
    // TODO: Implement with isTor
    throw new Error('Not implemented');
  }
  isDatacenter(ipAddress: unknown): Promise<boolean> {
    // TODO: Implement with isDatacenter
    throw new Error('Not implemented');
  }
  getGeolocation(ipAddress: unknown): Promise<Geolocation> {
    // TODO: Implement with getGeolocation
    throw new Error('Not implemented');
  }
  getThreatScore(ipAddress: unknown): Promise<ThreatScore> {
    // TODO: Implement with getThreatScore
    throw new Error('Not implemented');
  }
}
