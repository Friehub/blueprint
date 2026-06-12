# Module Contract: `api_versioning`

**Version:** 0.1.0

---

### `api_versioning`
API version management with versioning strategy selection, deprecation policies, and sunset tracking.

**Functions**
```
registerApi(name, version, strategy) → ApiVersion
getApi(api_id) → ApiVersion
getCurrentVersion(api_name) → string
deprecateVersion(api_id, sunset_date, migration_guide) → DeprecationNotice
listVersions(api_name) → ApiVersion[]
setVersioningStrategy(api_name, strategy) → void
extendSunset(api_id, new_date, reason) → void
```

**Types**
```
ApiVersion { id, name, version, strategy, status: current|deprecated|sunset, sunset_date?, created_at }
DeprecationNotice { api_id, version, sunset_date, migration_guide, deprecation_policy }
VersioningStrategy = url_path | header | query_param | content_negotiation
SunsetPolicy { min_deprecation_days, auto_sunset: bool, notification_list }
BreakingChange { api_id, from_version, to_version, change_type, migration_required }
```

**Invariants**
- `deprecateVersion` must set a `sunset_date` at least 90 days from the deprecation date -- shorter deprecation windows must require explicit override with a documented exception
- A deprecated API version must continue to function identically until the sunset date -- degrading a deprecated API's behavior is a contract violation
- `setVersioningStrategy` must not break existing clients -- strategy changes must be versioned and introduced as a new API version
- A version that reaches its `sunset_date` must return a `410 Gone` response with a `Sunset` header pointing to the migration guide
- Every breaking change must have an accompanying migration guide that documents the change, the migration path, and the fallback behavior

**Providers:** custom, API gateway, Kong, APISIX

**Dependencies:** changelog

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Version metadata must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for version lifecycle events.
* **Details:** Duplicate version registration must be idempotent.

### Worker Scaling
* **Policy:** Version routing is per-request with no scaling concerns.

### Multi-Region Behavior
* **Mode:** Versioning is global; all regions must serve the same set of versions.
* **Details:** A sunset date must be enforced across all regions simultaneously.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
registerApi         -> api.version.registered    { api_name, version, strategy }
  deprecateVersion    -> api.version.deprecated    { api_name, version, sunset_date }
  -                   -> api.version.sunsent       { api_name, version }
```

### Temporal Constraints
```
Deprecation minimum window:
    default:        90 days
    on_expiry:      version enters sunset; API returns 410

  Sunset grace period:
    duration:       30 days after sunset (for monitoring)
    on_expiry:      version may be removed from the codebase
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `api_versioning.<function>`.
* **Telemetry Metrics:**
```
gensense_api_versioning_versions_active          gauge { strategy }
  gensense_api_versioning_deprecations_total      { api_name }
  gensense_api_versioning_requests_total           { api_name, version }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** changelog
* **Emits To:** events
* **Recommends:** notifications, developer_portal
