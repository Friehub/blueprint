# Module Contract: `appointments`

---

### `appointments` (Healthcare, Services)
Booking and scheduling management.

**Functions**
```
getAvailability(provider_id, date_range) → Slot[]
bookAppointment(patient_id, provider_id, slot_id, data) → Appointment
getAppointment(appointment_id) → Appointment
getAppointmentsByUser(user_id, options?) → PaginatedResult<Appointment>
cancelAppointment(appointment_id, reason) → Appointment
rescheduleAppointment(appointment_id, slot_id) → Appointment
confirmAppointment(appointment_id) → Appointment
getWaitlist(provider_id, service_id) → WaitlistEntry[]
joinWaitlist(user_id, provider_id, service_id) → WaitlistEntry
```

**Types**
```
Slot { id, provider_id, start_at, end_at, available, service_id }
Appointment { id, patient_id, provider_id, slot, status, notes?, created_at }
AppointmentStatus = requested | confirmed | completed | cancelled | no_show
WaitlistEntry { id, user_id, position, estimated_wait? }
```

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Standard transactional consistency

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for booking lifecycle events.
* **Details:** Duplicate booking retries must not create duplicate appointments.

### Worker Scaling
* **Policy:** Availability reads, booking writes, and reminder dispatch must be independently scalable.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether scheduling is single-region or active/passive.
* **Details:** Cross-region slot booking conflicts must converge deterministically.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If booking or reminder capacity is saturated, the module must defer or reject predictably rather than overbooking slots.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Appointment retention:
    retention:         configurable per policy or regulation
    on_expiry:         archive or purge according to policy
```

### Storage Model
* **Model:** Durable scheduling store.
* **Details:** Slot and appointment state must remain consistent; waitlists may be derived from the durable state.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `appointments.<function>`.
* **Telemetry Metrics:** Emits universal metrics (`gensense_<module>_operation_total`, `gensense_<module>_operation_duration_ms`, `gensense_<module>_errors_total`).
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications, audit_log, payments (for paid appointments)
