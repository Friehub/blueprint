# Module Contract: `load_shedding`

**Version:** 0.1.0

---

### `load_shedding`
Internal capacity management with priority queuing and admission control.

**Functions**
```
admitRequest(request) → AdmissionDecision
getCapacity(workload) → CapacityStatus
setPriority(source, priority) → void
getSheddingStatus() → SheddingStatus
setSloBudget(workload, budget) → void
getSloBudget(workload) → SloBudget
```

**Types**
```
AdmissionDecision { admitted: bool, reason?, retry_after?, priority }
CapacityStatus { workload, current_load, capacity, utilization_pct, headroom }
SheddingStatus { active, workloads: WorkloadStatus[], total_rejected, total_admitted }
WorkloadStatus { name, current_load, capacity, priority, slo_budget_remaining }
SloBudget { workload, budget_pct, window, consumed_pct, remaining_pct }
Priority = critical | high | medium | low | background
```

**Invariants**
- `admitRequest` must never admit a request that would cause the workload to exceed its SLO budget
- A critical priority request must only be shed if the system cannot handle it at any priority level
- Background priority requests must be the first to be shed when load increases

**Providers:** custom (in-process), envoy (bulkhead), resilience4j, hystrix

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Shedding decisions are made locally per instance; cross-instance coordination is optional

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for shedding events.
* **Details:** Duplicate shedding decisions must be safe -- rejecting an already-rejected request is a no-op.

### Worker Scaling
* **Policy:** Admission control and capacity tracking must scale with request volume per instance.

### Multi-Region Behavior
* **Mode:** Shedding decisions are per-instance; global load shedding requires a coordination layer or circuit breaker across regions.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* Shedding IS the backpressure mechanism -- when capacity is exceeded, requests are rejected with a `retry_after` hint rather than queued.

### Algorithm
* **Recommended:** Token bucket for burst-tolerant admission control. Fixed-window counters for simple capacity tracking. Adaptive shedding based on SLO budget consumption.
* **Details:** Token bucket allows bursts up to bucket capacity while enforcing average rate. Fixed-window counters are simpler but have boundary burst issues. Adaptive shedding monitors SLO budget consumption and adjusts admission thresholds dynamically. Tradeoff: token bucket is more complex but handles bursts better; fixed-window is simpler but less smooth.
* **Atomicity:** Admission decisions must be atomic with capacity updates. A request must not be admitted if it would cause capacity violation. Race conditions must not allow over-admission.

### Error Taxonomy
### Module-Specific Errors
```
admitRequest:
    capacity_exceeded:         System at capacity for this priority level | retry after retry_after duration
    slo_budget_exhausted:      SLO budget consumed for this workload | downgrade priority or wait for reset
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
admitRequest     → load_shedding.admitted      { workload, priority }
                 OR load_shedding.rejected      { workload, priority, reason }
  setSloBudget    → load_shedding.budget_set    { workload, budget_pct }
```

### Temporal Constraints
```
SLO budget window:
    default:        60 seconds  (rolling window)
    on_expiry:      budget resets; consumed_pct returns to 0

  Admission cooldown:
    duration:       1 second  (minimum retry_after for shed requests)
    on_expiry:      client may retry
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `load_shedding.<function>`.
* **Telemetry Metrics:**
```
gensense_load_shedding_admitted_total          { workload, priority }
  gensense_load_shedding_rejected_total          { workload, priority, reason }
  gensense_load_shedding_utilization_pct          gauge { workload }
  gensense_load_shedding_slo_remaining_pct        gauge { workload }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** rate_limiting
* **Emits To:** events
* **Recommends:** telemetry, circuit_breaker
