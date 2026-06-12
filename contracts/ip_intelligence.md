# Module Contract: `ip_intelligence`

**Version:** 0.1.0

---

### `ip_intelligence`
IP-based geolocation, VPN detection, and threat assessment.

**Functions**
```
lookup(ip_address) → IpIntelligence
isVpn(ip_address) → boolean
isTor(ip_address) → boolean
isDatacenter(ip_address) → boolean
getGeolocation(ip_address) → Geolocation
getThreatScore(ip_address) → ThreatScore
```

**Types**
```
IpIntelligence { ip, geo, vpn, tor, datacenter, threat_score, isp }
Geolocation { country, region, city, latitude, longitude, timezone }
ThreatScore { score, level, signals }
Signal = vpn_detected | tor_exit_node | datacenter_hosting | proxy | anonymous | residential_proxy | spoofed
```

**Invariants**
- `lookup` must return a result for any valid IPv4 or IPv6 address — invalid or malformed IPs must return `ValidationError` rather than a partial result.
- `isVpn` returning `true` implies `lookup(ip_address).vpn == true` — the two functions must agree on VPN status for the same IP within the same data window.
- `getThreatScore` must compute the score from the union of all available signals (`vpn`, `tor`, `datacenter`, `proxy`) — an IP flagged by any single signal must have `level != "none"`.
- All functions must return from the local cache or embedded database — network calls to the provider on the hot path are a contract violation. Cache refresh must happen asynchronously.
- `isTor` returning `true` must cause `getThreatScore` to return `level >= "high"` — Tor exit nodes are always high-threat.

**Providers:** MaxMind, IPinfo, IP2Location

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Local database lookups are strongly consistent per-instance; provider data freshness depends on sync schedule.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for lookups.
* **Details:** IP intelligence data is read-only; duplicate lookups return the same cached result.

### Worker Scaling
* **Policy:** IP lookups must be served from a local embedded database or cache — no backend coordination required. Database refresh is a background worker concern.

### Multi-Region Behavior
* **Mode:** IP databases are replicated per-region; each region maintains its own local copy.
* **Details:** Provider database sync is per-region and may lag by up to 24 hours between regions.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* IP intelligence lookups are local and sub-millisecond — backpressure is not required for read paths. Database refresh must use rate-limited batch fetches from the provider.

### Storage Model
* **Model:** Embedded IP database (e.g. MaxMind GeoLite2) refreshed on a schedule.
* **Details:** The database file must be atomic-swapped during refresh — a failed refresh must not leave a partial database. Refresh schedule is configurable per deployment (default: daily).

### Error Taxonomy
### Module-Specific Errors
```
lookup / getGeolocation / getThreatScore:
    ip_not_found:             IP address not found in local database | verify IP format and database freshness
    database_stale:           Local database has not been refreshed within threshold | trigger async refresh
    provider_sync_failed:     Provider database download failed | retry on next scheduled sync

  isVpn / isTor / isDatacenter:
    database_not_loaded:      IP database has not been initialised | call init() before query functions
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
lookup          → ip_intelligence.lookup.completed  { ip, country, threat_level }
isVpn           → ip_intelligence.vpn.detected      { ip }  (only when true)
isTor           → ip_intelligence.tor.detected      { ip }  (only when true)
getThreatScore  → ip_intelligence.threat.elevated   { ip, score, level, signals } (only when level > low)
Database refresh → ip_intelligence.database.updated { version, record_count }
```

### Temporal Constraints
```
Database refresh:
    default:        24 hours
    on_expiry:      query functions may return stale data with a warning span annotation
                    trigger immediate async refresh

  Database stale threshold:
    duration:       48 hours (after last successful refresh)
    on_expiry:      return database_stale error; block lookups until refresh succeeds
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `ip_intelligence.<function>`.
* **Telemetry Metrics:**
```
blueprint_ip_intelligence_lookups_total           { function, result }
blueprint_ip_intelligence_lookup_duration_us      histogram { function }
blueprint_ip_intelligence_threat_distribution     gauge { level }
blueprint_ip_intelligence_database_freshness_ms   gauge
blueprint_ip_intelligence_database_record_count   gauge
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details). Lookup P99 must be < 10ms.

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return database_not_loaded error; trigger refresh |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Provider sync failed | Return provider_sync_failed; serve from existing database |
| IP not in database | Return ip_not_found error with guidance |

### Breaking Change Policy
- Adding a new signal type to ThreatScore: non-breaking
- Removing a signal type: breaking — requires major version bump and migration guide
- Changing threat level thresholds: non-breaking if documented
- Adding a new function: non-breaking

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive / wraps external provider)
* **Emits To:** events
* **Recommends:** caching (for repeated lookups), telemetry
