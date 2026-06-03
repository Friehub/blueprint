# Module Contract: `donations`

**Version:** 0.1.0

---

### `donations` (Non-profit, Crowdfunding)
Charitable giving and campaign management.

**Functions**
```
createCampaign(data) → Campaign
getCampaign(campaign_id) → Campaign
listCampaigns(filters?) → PaginatedResult<Campaign>
donate(campaign_id, donor_id, amount, currency, method) → Donation
getDonation(donation_id) → Donation
getDonationsByCampaign(campaign_id, options?) → PaginatedResult<Donation>
getCampaignStats(campaign_id) → CampaignStats
issueCertificate(donation_id) → Certificate
```

**Types**
```
Campaign { id, title, goal, currency, raised, status, end_at }
Donation { id, campaign_id, donor_id?, amount, currency, anonymous, created_at }
CampaignStats { raised, donor_count, goal, percentage_funded }
```

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for donation lifecycle events.
* **Details:** Duplicate donation retries must not duplicate donor records or campaign totals.

### Worker Scaling
* **Policy:** Donation processing, certificate issuance, and stats aggregation must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether donations are single-region or active/passive.
* **Details:** Cross-region totals must converge deterministically.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If payment or certificate capacity is saturated, donation actions must defer or reject predictably rather than losing campaign totals.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Campaign retention:
    retention:         configurable per policy
    on_expiry:         archive campaign data according to policy
```

### Storage Model
* **Model:** Durable campaign and donation store.
* **Details:** Donation records and campaign aggregates must remain auditable for the configured retention period.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `donations.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** payments
* **Emits To:** events
* **Recommends:** notifications, audit_log
