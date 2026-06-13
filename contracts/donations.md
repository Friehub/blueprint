# Module Contract: `donations`

**Version:** 0.2.0

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
Certificate { id, donation_id, donor_name?, amount, currency, issued_at }
```

**Invariants**
- `donate` must atomically increment the campaign's `raised` total within the same transaction as creating the donation record -- a donation without a corresponding total update is a data integrity violation
- A donation to a campaign that has reached its `goal` must still be accepted unless the campaign status is `closed` -- campaigns may exceed their goal
- `createCampaign` must reject a `goal` <= 0 with `invalid_goal` error
- `issueCertificate` must only succeed for completed (non-refunded) donations -- issuing a certificate for a refunded donation is a compliance violation

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
### Module-Specific Errors
```
donate:
    campaign_closed:          Campaign has ended and no longer accepts donations | show campaign status
    payment_failed:           Payment provider declined the donation | retry with different method
    currency_mismatch:        Donation currency does not match campaign currency | convert or reject

  createCampaign:
    invalid_goal:             Campaign goal must be greater than 0 | correct goal value
    end_at_in_past:           Campaign end date is in the past | set future end date

  issueCertificate:
    donation_not_completed:   Donation has not been completed or was refunded | check donation status
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createCampaign   → donations.campaign.created      { campaign_id, goal, currency }
donate           → donations.donation.received     { donation_id, campaign_id, amount, currency, anonymous }
                 OR donations.donation.failed      { donation_id, campaign_id, reason }
issueCertificate → donations.certificate.issued    { certificate_id, donation_id }
```

### Temporal Constraints
```
Campaign retention:
    retention:         configurable per policy
    on_expiry:         archive campaign data according to policy

  Donation refund window:
    max_duration:      configurable, default 30 days
    on_expiry:         refund must be processed manually

  Campaign auto-close:
    default:           end_at reached
    on_expiry:         set status to closed; prevent new donations
```

### Storage Model
* **Model:** Durable campaign and donation store.
* **Details:** Donation records and campaign aggregates must remain auditable for the configured retention period.

### Database Schema

#### PostgreSQL
```sql
CREATE TYPE campaign_status AS ENUM ('active', 'closed', 'cancelled');

CREATE TABLE campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             TEXT NOT NULL,
  goal              BIGINT NOT NULL CHECK (goal > 0),
  currency          CHAR(3) NOT NULL,
  raised            BIGINT NOT NULL DEFAULT 0 CHECK (raised >= 0),
  status            campaign_status NOT NULL DEFAULT 'active',
  end_at            TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_status ON campaigns(status);

CREATE TABLE donations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id       UUID NOT NULL REFERENCES campaigns(id),
  donor_id          UUID,
  amount            BIGINT NOT NULL CHECK (amount > 0),
  currency          CHAR(3) NOT NULL,
  anonymous         BOOLEAN NOT NULL DEFAULT false,
  payment_ref       TEXT,
  status            TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'failed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_donations_campaign ON donations(campaign_id, created_at DESC);
CREATE INDEX idx_donations_donor ON donations(donor_id) WHERE donor_id IS NOT NULL;

CREATE TABLE donation_certificates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id       UUID NOT NULL UNIQUE REFERENCES donations(id),
  donor_name        TEXT,
  amount            BIGINT NOT NULL,
  currency          CHAR(3) NOT NULL,
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaign_daily_stats (
  campaign_id       UUID NOT NULL REFERENCES campaigns(id),
  date              DATE NOT NULL,
  donations_count   INT NOT NULL DEFAULT 0,
  amount_raised     BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, date)
);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Payment provider declines donation | `payment_failed` error | Retry with backoff; notify donor to try different method |
| Campaign raised total diverges from donation sum | Periodic reconciliation mismatch | Run reconciliation job; flag for manual review |
| Certificate issuance on refunded donation | Compliance violation | Reject with `donation_not_completed`; alert operator |
| Duplicate donation retry | Idempotency key collision | Return existing donation; no double-charge |

**Breaking Changes:** Campaign goal currency changes are breaking for in-flight campaigns. Donation refund policy changes must be communicated one full cycle before taking effect. Removing campaign status values requires a migration of existing campaigns.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `donations.<function>`.
* **Telemetry Metrics:**
```
blueprint_donations_campaigns_total              gauge { status }
blueprint_donations_received_total               { currency, status }
blueprint_donations_amount_total                 { currency }  ← sum of amounts
blueprint_donations_certificates_issued_total
blueprint_donations_campaign_funding_rate        gauge { campaign_id }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** payments
* **Emits To:** events
* **Recommends:** notifications, audit_log
