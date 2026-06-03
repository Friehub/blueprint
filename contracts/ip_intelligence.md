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
```

**Providers:** MaxMind, IPinfo, IP2Location

---

## Part VIII -- Industry Verticals

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `ip_intelligence.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive / wraps external provider)
* **Emits To:** events
* **Recommends:** (none)
