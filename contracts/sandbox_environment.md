# Module Contract: `sandbox_environment`

**Version:** 0.1.0

---

### `sandbox_environment`
Isolated test environment provisioning with seeding, expiry, and reset.

**Functions**
```
provisionSandbox(user_id, template, options?) → Sandbox
getSandbox(sandbox_id) → Sandbox
listSandboxes(user_id?) → Sandbox[]
resetSandbox(sandbox_id) → void
seedSandbox(sandbox_id, seed_data) → void
extendSandbox(sandbox_id, duration) → void
expireSandbox(sandbox_id) → void
getSandboxUsage(sandbox_id) → UsageReport
validateSandboxCredentials(sandbox_id) → CredentialValidationResult
```

**Types**
```
Sandbox { id, user_id, template, status: provisioning|active|expired|suspended, created_at, expires_at }
SandboxOptions { ttl, region?, seed_data_ref?, max_resets?, network_restrictions?, resource_limits }
UsageReport { sandbox_id, api_calls, storage_used, compute_used, duration, resets }
SandboxTemplate { name, description, modules: string[], seed_dataset?, config_defaults, credential_policy?: SandboxCredentialPolicy }
SandboxCredentialPolicy { allowed_sources, mock_endpoints, prohibited_patterns }
CredentialValidationResult { valid: bool, violations: CredentialViolation[], sandbox_id }
CredentialViolation { credential_name, reason: matches_production|not_in_policy, source }
```

**Invariants**
- An expired sandbox must reject all API calls with a `sandbox_expired` error — resources must be preserved for a grace period before cleanup
- `resetSandbox` must return the sandbox to its original provisioned state — all modifications since provisioning must be discarded
- A sandbox must not have access to production resources or real external provider credentials
- `validateSandboxCredentials` must run automatically at provisioning time. Provisioning must fail if any credential in the sandbox configuration matches a known production credential or falls outside the declared `SandboxCredentialPolicy`
- Every sandbox template must declare its `credential_policy` before it can be used for provisioning

**Providers:** custom, GitHub Codespaces, Gitpod, Railway, Fly.io

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Sandbox state must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for sandbox lifecycle events.
* **Details:** Duplicate provisioning requests must be idempotent (return existing sandbox for the same user+template).

### Worker Scaling
* **Policy:** Sandbox provisioning and teardown workers must be independently scalable.

### Multi-Region Behavior
* **Mode:** Sandboxes are provisioned in the nearest region to the user; region is chosen at creation time.
* **Details:** A sandbox cannot change regions after creation.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
provisionSandbox:
    quota_exceeded:          User has reached maximum sandbox limit | expire unused sandboxes first
    template_not_found:      Specified template does not exist | list available templates

  resetSandbox:
    sandbox_expired:         Sandbox has expired and cannot be reset | provision a new sandbox
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
provisionSandbox  → sandbox.provisioned          { sandbox_id, user_id, template }
  resetSandbox      → sandbox.reset                { sandbox_id }
  expireSandbox     → sandbox.expired               { sandbox_id }
                   → sandbox.cleaned_up            { sandbox_id, resources_released }
```

### Temporal Constraints
```
Sandbox TTL:
    default:        24 hours
    max:            7 days
    on_expiry:      immediate API rejection; cleanup after 1 hour grace period

  Cleanup grace period:
    duration:       1 hour after expiry
    on_expiry:      resources are released; sandbox is non-recoverable
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `sandbox_environment.<function>`.
* **Telemetry Metrics:**
```
gensense_sandbox_environment_active_total         { template }
  gensense_sandbox_environment_provisioned_total   { template }
  gensense_sandbox_environment_expired_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** provisioning
* **Emits To:** events
* **Recommends:** seed_data, scheduled_tasks (for expiry scheduling), notifications
