# Module Contract: `sdk_generation`

**Version:** 0.1.0

---

### `sdk_generation`
Client SDK generation from API specifications with registry publishing and version management.

**Functions**
```
generateSDK(spec, language, options?) → SDKPackage
getSDK(sdk_id) → SDKPackage
listSDKs(language?) → SDKPackage[]
publishSDK(sdk_id, registry) → PublishResult
versionSDK(sdk_id, version) → SDKPackage
getSDKUsage(sdk_id) → UsageStats
deprecateSDK(sdk_id, reason) → void
```

**Types**
```
SDKPackage { id, api_spec, language, version, status: generated|published|deprecated, files: GeneratedFile[], created_at }
GeneratedFile { path, content, language }
PublishResult { sdk_id, registry, package_url, version, published_at }
UsageStats { sdk_id, total_downloads, active_instances, versions: VersionStats[] }
VersionStats { version, downloads, last_download_at }
SDKOptions { package_name?, namespace?, include_tests?, include_docs?, http_client?, auth_method? }
```

**Invariants**
- Generated SDK code must match the OpenAPI spec exactly -- a spec change must produce a different SDK version
- A deprecated SDK must still be downloadable but must not be recommended for new installations
- The SDK must include typed interfaces for every endpoint and schema in the specification

**Providers:** OpenAPI Generator, Speakeasy, Stainless, Fern, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** SDK version metadata must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for SDK lifecycle events.
* **Details:** Duplicate generation of the same spec and language must produce the same output.

### Worker Scaling
* **Policy:** SDK generation is CPU-bound and must be independently scalable per spec.

### Multi-Region Behavior
* **Mode:** SDK packages are typically published to a global registry (npm, PyPI, etc.); generation is single-region.
* **Details:** Registry tokens must not be stored in the SDK metadata; use secrets.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Storage Model
* **Model:** File-system or object-storage (S3, GCS) for generated SDK packages. Relational database for SDK metadata.
* **Details:**
```sql
CREATE TABLE sdk_packages (
    id              UUID PRIMARY KEY,
    api_spec        TEXT NOT NULL,
    language        TEXT NOT NULL,
    version         TEXT NOT NULL,
    status          TEXT NOT NULL DEFAULT 'generated'
                        CHECK (status IN ('generated', 'published', 'deprecated')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (api_spec, language, version)
);
```

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
generateSDK       → sdk.generated               { sdk_id, language, version }
  publishSDK        → sdk.published               { sdk_id, registry, package_url }
  deprecateSDK      → sdk.deprecated               { sdk_id, reason }
```

### Temporal Constraints
```
Generation timeout:
    default:        10 minutes
    on_expiry:      mark generation as failed

  SDK deprecation window:
    duration:       180 days before removal from registry
    on_expiry:      eligible for unpublishing
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `sdk_generation.<function>`.
* **Telemetry Metrics:**
```
blueprint_sdk_generation_generated_total           { language, status }
  blueprint_sdk_generation_published_total          { registry }
  blueprint_sdk_generation_downloads_total           { sdk_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** changelog, developer_portal
