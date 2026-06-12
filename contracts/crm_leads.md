# Module Contract: `crm_leads`

**Version:** 0.1.0

---

### `crm_leads`
Sales lead ingestion pipelines, contact history, and deal stage tracking for business operations.

**Functions**
```
createLead(contact_info, source, metadata?) → Lead
updateLeadStatus(lead_id, status) → Lead
createDeal(lead_id, value, currency, stage) → Deal
updateDealStage(deal_id, stage) → Deal
assignOwner(lead_id, owner_id) → Lead
```

**Types**
```
Lead { id, contact_info, status, source, owner_id?, created_at }
ContactInfo { name, email, phone?, company? }
Deal { id, lead_id, value, currency, stage, created_at, closed_at?, metadata? }

LeadStatus = new | contacted | qualified | lost
DealStage = discovery | proposal | negotiation | won | lost
```
*Note on Values:* The `value` field must be represented as a positive integer in the minor unit of the currency (e.g. cents).

**Invariants**
- **Deal-Lead Status Propagation**: Transitioning a deal to the `won` stage must automatically mark the associated lead as `qualified`.
- **Closed State Immutability**: Once a deal transitions to a terminal state (`won` or `lost`), its stage cannot be updated again. Modifications require opening a new deal.
- **Valid contact schema**: Creating a lead requires at least a name and a valid email format.

**Providers:** custom SQL schema, Hubspot API, Salesforce API, Pipedrive API

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `read_your_writes`
* **Details:** Leads and deal updates should be immediately visible to the sales agent who updated them; global pipelines can be eventually consistent (lag up to 5 seconds).

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createLead(contact_info, source, idempotency_key?)`

### Error Taxonomy
### Module-Specific Errors
```
updateDealStage:
    deal_closed:               The deal is already in a terminal state (won or lost) | reject
    deal_not_found:            The deal ID does not exist | return 404
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createLead      → crm.lead.created          { lead_id, source }
updateLeadStatus→ crm.lead.status.updated   { lead_id, from_status, to_status }
createDeal      → crm.deal.created          { deal_id, lead_id, value }
updateDealStage → crm.deal.stage.updated    { deal_id, from_stage, to_stage }
```

### Temporal Constraints
* None explicitly defined.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `crm_leads.<function>`.
* **Telemetry Metrics:**
```
blueprint_crm_leads_total                    counter { source, status }
blueprint_crm_deals_value_won_total          counter { currency }  ← sum of won values
blueprint_crm_deal_stages_total              gauge { stage }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users (for owner assignments)
* **Emits To:** events
* **Recommends:** notifications, audit_log
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on search functions.
