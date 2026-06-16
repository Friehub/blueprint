# Module Contract: `webhook_ingestion`

**Version:** 0.1.0

---

### `webhook_ingestion`
Incoming webhook ingestion — signature verification, deduplication, ordering, and routing.

**Functions**
```
ingestWebhook(provider: any, raw_body: any, headers: any) → IngestedEvent
verifySignature(provider: any, raw_body: any, signature: any, secret: any) → VerificationResult
deduplicateEvent(provider_event_id: any, provider: any) → DedupResult
getIngestedEvent(event_id: any) → IngestedEvent
listIngestedEvents(provider: any, options?: any) → PaginatedResult<IngestedEvent>
reprocessEvent(event_id: any) → IngestedEvent
getProviderConfig(provider: any) → ProviderConfig
```

**Types**
```
IngestedEvent { id, provider, provider_event_id, event_type, payload, status, received_at, processed_at }
VerificationResult { valid: bool, provider, algorithm, reason? }
DedupResult { is_duplicate: bool, original_event_id?, original_processed_at? }
ProviderConfig { provider, signature_header, signature_algorithm, public_key?, dedup_window_hours: 48 }
WebhookStatus = pending | verified | processing | completed | failed | rejected
```

**Invariants**
- Signature verification must happen before any event data is read or parsed
- Unverified events must be rejected without logging their payload (prevents log injection attacks)
- Deduplication window must be at least 48 hours — well beyond provider retry windows
- Event IDs are stored with 48-hour TTL for deduplication
- Out-of-sequence events must be queued for ordering resolution, not dropped
- Verified events are immutable — the raw payload and headers are stored as-received

**Providers:** Stripe, Paystack, Dodo, GitHub, any HMAC/JWT-signed webhook provider

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `at_least_once`
* **Details:** Downstream handlers must be idempotent; deduplication prevents duplicate processing

### Security
* **Hardening:** Payload logging is forbidden before signature verification
* **Hardening:** Signature verification errors must not reveal provider configuration details

### Storage Model
* **Storage:** Raw event store (immutable), dedup index with 48h TTL
* **Details:** Raw payloads are stored for 7 days for debugging; dedup index auto-expires

### Observability
* **Metrics:** webhooks_ingested_total, webhook_verification_failures_total, webhook_dedup_rate
* **Alerting:** Alert on verification failure rate > 1%, provider signature rotation overdue

### Module Dependencies
* **Hard Dependencies:** `webhooks`
* **Soft Dependencies:** `events`, `audit_log`, `circuit_breaker`
