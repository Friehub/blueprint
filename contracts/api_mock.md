# Module Contract: `api_mock`

**Version:** 0.1.0

---

### `api_mock`
Mock API endpoint registration with configurable responses, request recording, and replay.

**Functions**
```
registerMock(endpoint, method, response) → MockEndpoint
getMock(endpoint_id) → MockEndpoint
listMocks(tag?) → MockEndpoint[]
updateMockResponse(endpoint_id, response) → void
recordRequest(endpoint_id, request) → void
getRecordedRequests(endpoint_id, options?) → PaginatedResult<RecordedRequest>
replayRequests(endpoint_id) → void
deleteMock(endpoint_id) → void
```

**Types**
```
MockEndpoint { id, endpoint, method: GET|POST|PUT|DELETE|PATCH, response: MockResponse, status_code, delay, tag?, created_at }
MockResponse { body, headers, status_code, dynamic: bool, template? }
RecordedRequest { id, endpoint_id, method, headers, body, query_params, timestamp }
MockConfig { delay_ms?, variability?, error_rate?, stateful?, script? }
```

**Invariants**
- A mock endpoint must return its configured response within the configured `delay_ms` -- it must not make real network calls
- Recorded requests must be stored in the order received and include full headers and body
- `replayRequests` must resend recorded requests to the original endpoint if a real endpoint is configured for replay

**Providers:** WireMock, Mockoon, MSW, Postman Mock Server, custom

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Mock configuration must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for mock response delivery.
* **Details:** Duplicate requests to a mock endpoint return the same configured response.

### Worker Scaling
* **Policy:** Mock endpoints are lightweight and do not require worker scaling.

### Multi-Region Behavior
* **Mode:** Mocks are typically single-region; cross-region request recording requires a shared event bus.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
* Inherits universal domain errors (NotFound, Unauthorized, ValidationError, RateLimited, ProviderError, Timeout).

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
* None explicitly defined. Custom events must use the canonical domain envelope.

### Temporal Constraints
```
Request recording retention:
    default:        7 days
    on_expiry:      eligible for deletion

  Mock response delay:
    configurable:   0-5000ms
    on_exceed:      log warning if configured delay degrades test performance
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `api_mock.<function>`.
* **Telemetry Metrics:**
```
gensense_api_mock_endpoints_total              { method }
  gensense_api_mock_requests_recorded_total     { endpoint_id }
  gensense_api_mock_responses_sent_total         { endpoint_id, status_code }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** (none)
* **Recommends:** developer_portal, sandbox_environment
