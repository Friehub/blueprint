# Module Contract: `developer_portal`

**Version:** 0.2.1

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
### Module-Specific Errors
```
generateApiKey:
    key_limit_exceeded:      User has reached maximum number of active keys | revoke unused keys
    invalid_scopes:          Requested scopes exceed the user's permission boundary | return allowed scopes

  revokeApiKey:
    key_not_found:           Key ID does not exist | check key ID
    key_already_revoked:     Key has already been revoked | no action required

  publishChangelog:
    version_conflict:        Entry with this version already exists | use next version
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
generateApiKey    → portal.api_key.created      { key_prefix, scopes }
  revokeApiKey      → portal.api_key.revoked       { key_prefix }
  publishChangelog  → portal.changelog.published    { entry_id, type, version }
  ─                 → portal.usage.aggregated       { user_id, period, total_requests }
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

### Storage Model
* **Model:** Durable API key and changelog store with usage aggregation.
* **Details:** API key secrets must be hashed before storage. Changelog entries are append-only. Usage data is aggregated from web_analytics.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE api_key_status AS ENUM ('active', 'revoked', 'expired');

CREATE TABLE portal_api_keys (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  name              TEXT NOT NULL,
  key_hash          TEXT NOT NULL,
  key_prefix        TEXT NOT NULL,
  scopes            JSONB NOT NULL DEFAULT '[]',
  status            api_key_status NOT NULL DEFAULT 'active',
  expires_at        TIMESTAMPTZ,
  last_used_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_keys_user ON portal_api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON portal_api_keys(key_hash);
CREATE INDEX idx_api_keys_status ON portal_api_keys(status) WHERE status = 'active';

CREATE TABLE portal_changelog (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  description       TEXT NOT NULL,
  version           TEXT NOT NULL,
  entry_type        TEXT NOT NULL CHECK (entry_type IN ('feature', 'fix', 'breaking', 'deprecation')),
  published_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_changelog_version ON portal_changelog(version);

CREATE TABLE portal_doc_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module            TEXT,
  title             TEXT NOT NULL,
  content           TEXT NOT NULL,
  category          TEXT,
  last_updated      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_doc_pages_module ON portal_doc_pages(module);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| API key revocation propagation delay | Key still valid in some regions | Use pub/sub to broadcast revocation; enforce TTL-based re-validation |
| Changelog version conflict | `version_conflict` error | Reject duplicate; guide to next version |
| Search index stale | Docs not appearing in results | Trigger reindex on doc update; max staleness 5 min |
| Usage aggregation backlog | Dashboard shows stale data | Alert on lag > 1 aggregation window; scale aggregation workers |

**Breaking Changes:** Removing or renaming API key scopes requires a migration period where old scopes are aliased to new ones. Changelog entry types are extensible; removing a type is breaking. Doc page URL changes must redirect old URLs for at least one release cycle.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `developer_portal.<function>`.
* **Telemetry Metrics:**
```
blueprint_developer_portal_active_keys_total        gauge { status }
  blueprint_developer_portal_api_requests_total       { endpoint, status }
  blueprint_developer_portal_doc_views_total          { category }
  blueprint_developer_portal_key_revocation_lag_ms    gauge
  blueprint_developer_portal_changelog_published_total { type }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** api_keys, web_analytics
* **Emits To:** events
* **Recommends:** notifications, analytics, changelog
