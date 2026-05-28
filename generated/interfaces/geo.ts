// geo.ts
// Auto-generated from contracts/geo.md
// Do not edit manually

export type IpAddress = string;

export type Iso3166Alpha2 = string;       // e.g. "NG", "US", "DE"

export type IanaTimezone = string;         // e.g. "Africa/Lagos", "America/New_York"

export type GeoLocation = {
ip?: IpAddress;
countryCode: Iso3166Alpha2;
countryName: string;
subdivisionCode?: string;
subdivisionName?: string;
city?: string;
postalCode?: string;
latitude?: number;
longitude?: number;
timezone: IanaTimezone;
currency: string;                // ISO 4217
isEu: boolean;
isVpn?: boolean;                 // Best-effort; not guaranteed
isTor?: boolean;                 // Best-effort; not guaranteed
confidence: "HIGH" | "MEDIUM" | "LOW";
};

export type CoordinateInput = {
latitude: number;
longitude: number;
language?: string;               // Preferred response language (BCP 47)
};

export type ReverseGeocodeResult = {
formattedAddress: string;
streetNumber?: string;
streetName?: string;
city?: string;
postalCode?: string;
subdivisionCode?: string;
subdivisionName?: string;
countryCode: Iso3166Alpha2;
countryName: string;
latitude: number;
longitude: number;
};

export type ForwardGeocodeResult = {
formattedAddress: string;
latitude: number;
longitude: number;
countryCode: Iso3166Alpha2;
placeId?: string;                // Provider-assigned place identifier
confidence: number;              // 0.0 – 1.0
};

export type Country = {
countryCode: Iso3166Alpha2;
name: string;
callingCode: string;
currencyCode: string;
currencyName: string;
locales: string[];
isEu: boolean;
isEea: boolean;
isSanctioned: boolean;           // Per OFAC or equivalent authority
taxRegime?: string;              // e.g. "VAT", "GST", "NONE"
};

export type Region = {
countryCode: Iso3166Alpha2;
regionCode: string;
name: string;
type: "STATE" | "PROVINCE" | "PREFECTURE" | "TERRITORY" | "OTHER";
timezones: IanaTimezone[];
};

export type Timezone = {
ianaId: IanaTimezone;
abbreviation: string;
utcOffsetMinutes: number;
isDst: boolean;
};

export type GeoRuleInput = {
ruleName: string;                // e.g. "GDPR_SCOPE", "OFAC_SANCTIONED", "SUPPORTED_MARKET"
location: {
countryCode: Iso3166Alpha2;
subdivisionCode?: string;
};
};

export type GeoRuleResult = {
ruleName: string;
matched: boolean;
reason?: string;
};

export type ListCountriesInput = {
block?: "EU" | "EEA" | "ASEAN" | "G20" | "ALL";
excludeSanctioned?: boolean;
pagination: PaginationInput;
};

export type TimezoneConvertInput = {
timestamp: Timestamp;
fromTimezone: IanaTimezone;
toTimezone: IanaTimezone;
};

export interface GeoContract {
  resolveIp(ip: IpAddress): Promise<GeoLocation>;
  resolveCoordinate(input: CoordinateInput): Promise<GeoLocation>;
  reverseGeocode(input: CoordinateInput): Promise<ReverseGeocodeResult>;
  forwardGeocode(query: string): Promise<ForwardGeocodeResult[]>;
  getCountry(countryCode: Iso3166Alpha2): Promise<Country>;
  listCountries(input: ListCountriesInput): Promise<PaginatedList<Country>>;
  getRegion(countryCode: Iso3166Alpha2, regionCode: string): Promise<Region>;
  evaluateGeoRule(input: GeoRuleInput): Promise<GeoRuleResult>;
  getTimezone(countryCode: Iso3166Alpha2, subdivisionCode?: string): Promise<Timezone[]>;
  convertTimezone(input: TimezoneConvertInput): Promise<Timestamp>;
}
