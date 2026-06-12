# Module Contract: `developer_portal`

**Version:** 0.1.0

---

### `developer_portal`
Developer-facing portal with API key self-service, documentation hosting, usage dashboard, and changelog.

**Functions**
```
getDashboard(user_id) → Dashboard
getApiKeys(user_id) → ApiKey[]
generateApiKey(user_id, name, scopes?) → ApiKey
revokeApiKey(key_id) → void
getDocumentation(module_name?) → DocPage[]
searchDocumentation(query) → SearchResult[]
getUsageDashboard(user_id, period) → UsageDashboard
getChangelog(options?) → PaginatedResult<ChangelogEntry>
publishChangelog(entry) → ChangelogEntry
```

**Types**
```
Dashboard { user_id, active_keys, api_usage, recent_activity, docs_viewed }
ApiKey { id, name, prefix, scopes, created_at, last_used_at, expires_at?, status: active|revoked|expired }
DocPage { id, module, title, content, category, last_updated }
UsageDashboard { user_id, total_requests, requests_by_endpoint, errors, latency_p50, latency_p99, period }
ChangelogEntry { id, title, description, version, type: feature|fix|breaking|deprecation, published_at }
SearchResult { doc_id, title, module, snippet, score }
```

**Invariants**
- An API key with `revoked` status must immediately stop working for all API calls
- `searchDocumentation` must return results sorted by relevance -- all results must include a relevance score
- A breaking change in the changelog must reference the migration guide in the documentation

**Providers:** custom, ReadMe, Stoplight, Postman, SwaggerHub

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** API key state must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for portal lifecycle events.
* **Details:** Duplicate API key generation must be safe (different keys for the same name are allowed).

### Worker Scaling
* **Policy:** API key validation, documentation serving, and usage aggregation must be independently scalable.

### Multi-Region Behavior
* **Mode:** API keys are global; documentation is served from the nearest CDN edge.
* **Details:** Key revocation must propagate to all regions within propagation delay.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
generateApiKey    → portal.api_key.created      { key_prefix, scopes }
  revokeApiKey      → portal.api_key.revoked       { key_prefix }
  publishChangelog  → portal.changelog.published    { entry_id, type, version }
```

### Temporal Constraints
```
API key expiry:
    default:        365 days
    on_expiry:      auto-revoke; notify key owner before expiry (30 and 7 days)

  Usage aggregation window:
    resolution:     1 hour
    retention:      90 days
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `developer_portal.<function>`.
* **Telemetry Metrics:**
```
gensense_developer_portal_active_keys_total
  gensense_developer_portal_api_requests_total     { endpoint }
  gensense_developer_portal_doc_views_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** api_keys, web_analytics
* **Emits To:** events
* **Recommends:** notifications, analytics, changelog
