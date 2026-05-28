// ip_intelligence.ts
// Auto-generated from contracts/ip_intelligence.md
// Do not edit manually

export interface Ipintelligence {
  ip: unknown;
  geo: unknown;
  vpn: unknown;
  tor: unknown;
  datacenter: unknown;
  threatScore: unknown;
  isp: unknown;
}

export interface Geolocation {
  country: unknown;
  region: unknown;
  city: unknown;
  latitude: unknown;
  longitude: unknown;
  timezone: unknown;
}

export interface Threatscore {
  score: unknown;
  level: unknown;
  signals: unknown;
}

export interface IpIntelligenceContract {
  lookup(ipAddress: unknown): Promise<IpIntelligence>;
  isVpn(ipAddress: unknown): Promise<boolean>;
  isTor(ipAddress: unknown): Promise<boolean>;
  isDatacenter(ipAddress: unknown): Promise<boolean>;
  getGeolocation(ipAddress: unknown): Promise<Geolocation>;
  getThreatScore(ipAddress: unknown): Promise<ThreatScore>;
}
