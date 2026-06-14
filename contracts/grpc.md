# Module Contract: `grpc`

**Version:** 0.2.1

---

### `grpc`
gRPC service definition, streaming RPCs, and interceptor middleware with deadline propagation.

**Functions**
```
defineService(name, methods) → ServiceDefinition
defineMethod(name, request_type, response_type, rpc_type) → MethodDefinition
createServer(services, options?) → GrpcServer
createClient(service_def, address, options?) → GrpcClient
startServer(server, port) → void
addInterceptor(interceptor, phase) → void
setDeadline(timeout) → void
healthCheck() → ServingStatus
```

**Types**
```
ServiceDefinition { name, methods: MethodDefinition[], options? }
MethodDefinition { name, request_type, response_type, rpc_type, options? }
RpcType = unary | server_streaming | client_streaming | bidirectional_streaming
GrpcServer { services, interceptors, started, port }
GrpcClient { service, address, options, call }
Interceptor { phase: request|response, handler }
ServingStatus { status: SERVING | NOT_SERVING | UNKNOWN }
Deadline { timeout_ms, propagated: bool }
ProtobufField { number, name, type, label: optional|required|repeated, default? }
ProtobufEnum { name, values: string[] }
ProtobufOneof { name, fields: string[] }
```

**Invariants**
- A unary or server-streaming method must return a response within the set deadline -- exceeding the deadline must cancel the in-flight call and return a `DEADLINE_EXCEEDED` error
- Deadline must propagate from client to server -- a client-set deadline must be sent via the `grpc-timeout` metadata and honored by the receiving server
- A bidirectional streaming method must handle half-close gracefully -- the server must continue processing client messages until the client closes the send stream, then respond
- `healthCheck` must return `NOT_SERVING` if any dependency service is unavailable
- Protobuf field numbers must never be reused after a field is deleted -- deleted fields must be marked as `reserved`

**Providers:** gRPC-Go, gRPC-Node, gRPC-Python, Tonic (Rust), gRPC-Java

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Service definitions are strongly consistent per instance

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for unary calls; `at_least_once` for streaming responses.
* **Details:** Streaming consumers must handle duplicate messages on reconnection.

### Worker Scaling
* **Policy:** Each gRPC service should run on independent worker pools; streaming connections are per-worker.

### Multi-Region Behavior
* **Mode:** gRPC calls should be routed to the nearest region via service mesh.
* **Details:** Cross-region gRPC calls must respect the mesh's traffic policy.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `grpc.<service>.<method>`.
* **Telemetry Metrics:**
```
blueprint_grpc_requests_total                { service, method, status }
blueprint_grpc_request_duration_ms          histogram { service, method }
blueprint_grpc_messages_sent_total           { service, method, type }
blueprint_grpc_messages_received_total       { service, method, type }
blueprint_grpc_active_streams                gauge { service, method }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Deadline exceeded | Cancel in-flight call, return DEADLINE_EXCEEDED |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise
- Renaming a protobuf field number: breaking — deleted fields must be marked as reserved

### Module Dependencies
* **Depends On:** (none -- wraps external gRPC library or provider)
* **Emits To:** events
* **Recommends:** service_mesh (for traffic routing and mTLS), circuit_breaker, telemetry
