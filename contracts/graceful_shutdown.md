# Module Contract: `graceful_shutdown`

**Version:** 0.1.0

---

### `graceful_shutdown`
Ordered service shutdown with in-flight request draining and resource lifecycle management.

**Functions**
```
registerShutdownHook(name, handler, phase) → ShutdownHook
deregisterShutdownHook(hook_id) → void
initiateShutdown(reason) → ShutdownSequence
getShutdownStatus() → ShutdownStatus
setShutdownTimeout(timeout_ms) → void
getInFlightRequests() → number
```

**Types**
```
ShutdownHook { id, name, handler, phase, priority, timeout_ms }
ShutdownSequence { id, reason, phases: ShutdownPhase[], started_at }
ShutdownPhase { name, status: pending|draining|completed|failed, started_at, completed_at?, hooks: number }
ShutdownStatus { phase, in_flight_requests, hooks_pending, hooks_completed, deadline }
Phase = stop_accepting | drain_requests | close_connections | flush_buffers | shutdown
```

**Invariants**
- `initiateShutdown` must stop accepting new requests immediately -- the first phase must complete before any subsequent phase starts
- The drain phase must allow in-flight requests to complete up to the configured `timeout_ms` -- requests exceeding the timeout must be cancelled with a `shutdown_timeout` error
- Resource cleanup must follow the declared phase order: connections before caches before databases before final exit
- `getShutdownStatus` must return accurate counts of in-flight requests and pending hooks at any point during the shutdown sequence
- A shutdown hook that fails must not block subsequent hooks in the same phase -- failures must be logged but not prevent shutdown progression

**Providers:** custom, Kubernetes preStop, systemd, lifecycle managers

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Shutdown state must be immediately consistent per instance

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for shutdown lifecycle events.
* **Details:** Duplicate shutdown events must be idempotent -- subsequent calls to `initiateShutdown` must return the existing sequence.

### Worker Scaling
* **Policy:** Shutdown hooks must execute serially within each phase across all workers.

### Multi-Region Behavior
* **Mode:** Shutdown is per-instance; cross-region coordination is handled by the deployment orchestrator.
* **Details:** A region-wide shutdown must be coordinated externally, not by this module.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
initiateShutdown:
    shutdown_already_initiated:   Shutdown sequence is already in progress | return existing sequence
    shutdown_timeout_too_short:   Configured timeout is below minimum threshold | adjust timeout

  registerShutdownHook:
    hook_name_taken:              Hook name already registered | use unique name
    invalid_phase:                Phase does not exist | use one of: stop_accepting, drain_requests, close_connections, flush_buffers, shutdown

  setShutdownTimeout:
    timeout_exceeds_max:          Timeout exceeds maximum allowed (300s) | cap at max
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
initiateShutdown   → lifecycle.shutdown.started    { reason, deadline }
  Phase complete     → lifecycle.shutdown.phase_done { phase, hooks, duration_ms }
  ─                  → lifecycle.shutdown.completed  { duration_ms }
                   OR lifecycle.shutdown.timed_out  { duration_ms, in_flight_lost }
  registerShutdownHook → lifecycle.shutdown.hook_registered { hook_name, phase }
  ─                  → lifecycle.shutdown.hook_failed       { hook_name, phase, reason }
```

### Temporal Constraints
```
Shutdown timeout:
    default:        30 seconds
    max:            300 seconds (5 minutes)
    on_expiry:      force exit; in-flight requests are lost

  Drain phase:
    max_duration:   configurable, default 15 seconds
    on_expiry:      cancel remaining in-flight requests

  Hook execution:
    per_hook_max:   5 seconds
    on_expiry:      log failure, proceed to next hook
```

### Storage Model
* **Model:** In-memory shutdown state with hook registry.
* **Details:** Shutdown state is per-instance and does not require persistent storage. Hook definitions may be configured at startup or registered at runtime.

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Hook timeout during shutdown | Hook exceeds `per_hook_max` | Log failure; proceed to next hook (fail-open) |
| Total shutdown timeout exceeded | `shutdown.timed_out` event | Force exit; lost in-flight requests are counted in metric |
| Drain phase incomplete | In-flight requests remain after drain timeout | Cancel remaining requests; log count |
| Hook panics during execution | Unhandled exception in hook handler | Recover and continue; log stack trace |
| Duplicate shutdown initiation | `shutdown_already_initiated` error | Return existing sequence; idempotent |

**Breaking Changes:** Adding a new mandatory phase to the shutdown sequence is breaking for all registered hooks. The `Phase` enum is extensible; removing a phase value is breaking. Hook handler signature changes are breaking.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `graceful_shutdown.<function>`.
* **Telemetry Metrics:**
```
gensense_graceful_shutdown_total             { reason, result }
  gensense_graceful_shutdown_duration_ms       histogram
  gensense_graceful_shutdown_in_flight_gauge     { phase }
  gensense_graceful_shutdown_hook_fail_total    { phase }
  gensense_graceful_shutdown_in_flight_lost_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** health (for readiness check before draining)
* **Emits To:** events
* **Recommends:** telemetry, connection_pool, caching (for flush/close)
