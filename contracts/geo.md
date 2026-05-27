# Module: geo

**Version:** 0.1.0
**Part:** III — Data and State

## Purpose

Defines the interface for geolocation resolution, region classification, and geographic constraint enforcement. A geo module resolves a network address or a user-supplied coordinate into a structured geographic context — country, region, city, timezone, and currency — and evaluates that context against access rules. This module does not own user location data persistently; it provides stateless resolution and classification services. Persistent location preferences belong to `users`.

---

## Functions

### `resolveIp(ip: IpAddress) → GeoLocation`
Resolves an IP address to a structured geographic context. Returns country, subdivision, city, timezone, and currency. This is a read-only, stateless operation.

### `resolveCoordinate(input: CoordinateInput) → GeoLocation`
Resolves a latitude/longitude pair to a structured geographic context.

### `reverseGeocode(input: CoordinateInput) → ReverseGeocodeResult`
Converts a coordinate pair to a human-readable address. More precise than `resolveCoordinate` — returns street-level data where available.

### `forwardGeocode(query: string) → ForwardGeocodeResult[]`
Converts a free-text address or place name to one or more coordinate candidates, ordered by relevance.

### `getCountry(countryCode: Iso3166Alpha2) → Country`
Returns metadata for a country: name, currency, calling code, supported locales, VAT/tax regime indicator.

### `listCountries(input: ListCountriesInput) → PaginatedList<Country>`
Returns all countries, optionally filtered by region or block membership (e.g., `EU`, `EEA`, `ASEAN`).

### `getRegion(countryCode: Iso3166Alpha2, regionCode: string) → Region`
Returns metadata for a country subdivision (state, province, prefecture).

### `evaluateGeoRule(input: GeoRuleInput) → GeoRuleResult`
Evaluates whether a given location satisfies a named access rule (e.g., `GDPR_SCOPE`, `OFAC_SANCTIONED`, `SUPPORTED_MARKET`). Used by other modules to gate features by geography without embedding geo logic.

### `getTimezone(countryCode: Iso3166Alpha2, subdivisionCode?: string) → Timezone[]`
Returns the IANA timezone identifiers applicable to the given country or subdivision.

### `convertTimezone(input: TimezoneConvertInput) → Timestamp`
Converts a UTC timestamp to a local time in a given IANA timezone, and vice versa.

---

## Types

```typescript
type IpAddress = string;
type Iso3166Alpha2 = string;       // e.g. "NG", "US", "DE"
type IanaTimezone = string;         // e.g. "Africa/Lagos", "America/New_York"

type GeoLocation = {
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

type CoordinateInput = {
  latitude: number;
  longitude: number;
  language?: string;               // Preferred response language (BCP 47)
};

type ReverseGeocodeResult = {
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

type ForwardGeocodeResult = {
  formattedAddress: string;
  latitude: number;
  longitude: number;
  countryCode: Iso3166Alpha2;
  placeId?: string;                // Provider-assigned place identifier
  confidence: number;              // 0.0 – 1.0
};

type Country = {
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

type Region = {
  countryCode: Iso3166Alpha2;
  regionCode: string;
  name: string;
  type: "STATE" | "PROVINCE" | "PREFECTURE" | "TERRITORY" | "OTHER";
  timezones: IanaTimezone[];
};

type Timezone = {
  ianaId: IanaTimezone;
  abbreviation: string;
  utcOffsetMinutes: number;
  isDst: boolean;
};

type GeoRuleInput = {
  ruleName: string;                // e.g. "GDPR_SCOPE", "OFAC_SANCTIONED", "SUPPORTED_MARKET"
  location: {
    countryCode: Iso3166Alpha2;
    subdivisionCode?: string;
  };
};

type GeoRuleResult = {
  ruleName: string;
  matched: boolean;
  reason?: string;
};

type ListCountriesInput = {
  block?: "EU" | "EEA" | "ASEAN" | "G20" | "ALL";
  excludeSanctioned?: boolean;
  pagination: PaginationInput;
};

type TimezoneConvertInput = {
  timestamp: Timestamp;
  fromTimezone: IanaTimezone;
  toTimezone: IanaTimezone;
};
```

---

## Invariants

1. `resolveIp` must return a result for any valid IPv4 or IPv6 address, including private/reserved ranges — in that case, `confidence` is `LOW` and geographic fields may be null.
2. `evaluateGeoRule` must not embed hard-coded lists of countries; rule definitions must be configurable at the adapter level so sanctioned country lists can be updated without a code deployment.
3. `isVpn` and `isTor` fields are best-effort classifications and must never be the sole basis for an access denial; they inform risk scoring, not hard blocks.
4. `forwardGeocode` must return results ordered by descending `confidence`; no result with `confidence < 0.3` may be returned.
5. `reverseGeocode` must return at minimum `formattedAddress`, `countryCode`, `latitude`, and `longitude`; all other fields are optional depending on provider resolution.
6. `getCountry` with an unrecognised `countryCode` returns `COUNTRY_NOT_FOUND`; it never invents a fallback.
7. All returned timestamps and timezone conversions must account for DST rules applicable to the target timezone at the given point in time.

---

## Events Emitted

This module is stateless and does not emit domain events. Callers are responsible for emitting events when geo resolution influences a state transition (e.g., `access.denied.geo_restriction` from the `auth` module).

---

## System-Level Integrations

- **Idempotency:** All operations are stateless reads; idempotency is inherent.
- **Consistency:** Results are derived from a periodically-updated geo database; staleness up to 24 hours is acceptable for IP resolution. Geocoding results may differ across providers for the same input.
- **Observability:** `resolveIp` and `evaluateGeoRule` must emit a span annotated with `countryCode`, `ruleName`, and `matched` to support geographic access audit trails.
- **Caching:** `resolveIp` results may be cached by the adapter for up to 1 hour per IP. `getCountry` and `listCountries` results may be cached for up to 24 hours. Cache invalidation must be triggered on database updates.
- **Dependencies:** `ip_intelligence` (VPN/proxy/Tor classification), `caching` (result caching), `rate_limiting` (geocoding is a costly operation and must be rate-limited per caller).
- **Errors:** `INVALID_IP_ADDRESS`, `INVALID_COORDINATE`, `COUNTRY_NOT_FOUND`, `REGION_NOT_FOUND`, `TIMEZONE_NOT_FOUND`, `UNKNOWN_GEO_RULE`, `GEOCODING_PROVIDER_UNAVAILABLE`.
- **Providers (adapter examples):** MaxMind GeoIP2, ipinfo.io, Google Maps Platform (Geocoding API), Mapbox Geocoding, HERE Geocoding, ip-api.com.
