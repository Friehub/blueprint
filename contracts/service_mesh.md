# Module Contract: `service_mesh`

**Version:** 0.1.0

---

### `service_mesh`
Service discovery, health-aware routing, and inter-service communication.

**Functions**
```
registerService(name, endpoints, metadata?) → Service
deregisterService(service_id) → void
discoverService(name) → Service?
getEndpoints(service_name, health?) → Endpoint[]
reportHealth(endpoint_id, status) → void
getServiceGraph() → ServiceGraph
```

**Types**
```
Service { id, name, endpoints, metadata, registered_at }
Endpoint { id, address, port, protocol, health: healthy|degraded|down, last_checked }
ServiceGraph { nodes: Service[], edges: { source, target, protocol }[] }
```

**Invariants**
- `discoverService` must only return services with at least one healthy endpoint
- `deregisterService` must not affect in-flight requests already routed to its endpoints
- A service with no healthy endpoints for longer than `stale_timeout` must be marked degraded, not removed automatically

**Providers:** Consul, Kubernetes DNS, Envoy (xDS), Linkerd, Istio, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Service registry updates propagate asynchronously; stale reads may return endpoints that are no longer healthy

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for health state transitions and registration events.
* **Details:** Duplicate registration must be idempotent; duplicate deregistration must be a no-op.

### Worker Scaling
* **Policy:** Health probe polling and endpoint resolution must be independently scalable per service mesh node.

### Multi-Region Behavior
* **Mode:** The deployment must declare whether the mesh is single-region or cross-region (with region-aware routing).
* **Details:** Cross-region health probes must be distinguished from local probes to avoid false positives from network latency.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* If the registry is under heavy write load, health updates must be batched or sampled rather than dropped silently.

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
registerService    → service.registered        { service_id, name }
  deregisterService → service.deregistered      { service_id, name }
  reportHealth      → endpoint.health_changed   { endpoint_id, previous, current }
```

### Temporal Constraints
```
Health probe interval:
    default:        15 seconds
    degraded:       5 seconds  (probe more aggressively when degraded)
    on_expiry:      mark endpoint as down after 3 missed intervals

  Stale service timeout:
    duration:       5 minutes
    on_expiry:      mark service as degraded
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `service_mesh.<function>`.
* **Telemetry Metrics:**
```
gensense_service_mesh_endpoints_total            { service, health }
  gensense_service_mesh_routing_changes_total      { service }
  gensense_service_mesh_health_probe_duration_ms   histogram { service }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none -- infrastructure primitive)
* **Emits To:** events
* **Recommends:** circuit_breaker, telemetry
