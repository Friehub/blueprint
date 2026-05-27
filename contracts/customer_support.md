# Module Contract: `customer_support`

---

### `customer_support`
Customer support ticket lifecycle, help desk queue management, and service-level agreements (SLAs).

**Functions**
```
createTicket(customer_id, subject, body, priority) → Ticket
assignTicket(ticket_id, agent_id) → Ticket
addTicketMessage(ticket_id, sender_id, message) → TicketMessage
transitionTicketStatus(ticket_id, status) → Ticket
checkSLA(ticket_id) → SLAResult
```

**Types**
```
Ticket { id, customer_id, subject, priority, status, agent_id?, created_at, resolved_at? }
TicketMessage { id, ticket_id, sender_id, message, created_at }
SLAResult { ticket_id, is_breached, deadline, time_remaining_seconds }

TicketPriority = low | medium | high | urgent
TicketStatus = open | pending | resolved | closed
```

**Invariants**
- **Closed Ticket Lock**: A ticket in the `closed` status cannot receive new messages (`addTicketMessage`) or be assigned to agents (`assignTicket`) unless it is explicitly transitioned back to the `open` status.
- **Resolution Timestamp**: Transitioning a ticket to `resolved` or `closed` must automatically populate the `resolved_at` timestamp. Reopening the ticket must clear this field.
- **SLA Deadline Calculations**: SLA deadlines are determined at the moment of ticket creation based on the selected `priority` tier.

**Providers:** custom database ticketing system, Zendesk API, Freshdesk API, Intercom API

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong` (for status transitions and assignments) and `read_your_writes` (for message lists).
* **Details:** Ticket queues must be strongly consistent to prevent double-assignment to agents.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).
* **Required Functions:**
  - `createTicket(customer_id, subject, body, priority, idempotency_key?)`

### Error Taxonomy
### Module-Specific Errors
```
addTicketMessage:
    ticket_closed:             Ticket is closed and cannot receive messages | reopen first
    ticket_not_found:          Ticket ID does not exist | return 404

assignTicket:
    agent_inactive:            The target agent is offline or suspended | reject
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createTicket            → support.ticket.created        { ticket_id, customer_id, priority }
assignTicket            → support.ticket.assigned       { ticket_id, agent_id }
transitionTicketStatus  → support.ticket.status.updated { ticket_id, from_status, to_status }
addTicketMessage        → support.ticket.message.added  { message_id, ticket_id, sender_id }
```

### Temporal Constraints
```
Ticket SLA (reply deadline):
    max_duration:   1 hour (urgent), 4 hours (high), 24 hours (medium), 48 hours (low)
    on_expiry:      transition is_breached to true, notify support supervisor via events
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `customer_support.<function>`.
* **Telemetry Metrics:**
```
gensense_support_tickets_open_total         gauge { priority }
gensense_support_ticket_sla_breach_total    counter { priority }
gensense_support_average_resolution_ms      histogram
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users (both customer and support agent records)
* **Emits To:** events
* **Recommends:** notifications, audit_log, queues (for routing/assignment delays)
* **Pagination Sort Key:** Uses cursor-based pagination sorting by `created_at DESC` on ticket lists.
