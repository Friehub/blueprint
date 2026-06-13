# Module Contract: `api_mock`

**Version:** 0.2.1

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
```
registerMock       → api_mock.endpoint.registered    { endpoint_id, method, endpoint }
updateMockResponse → api_mock.response.updated       { endpoint_id }
deleteMock          → api_mock.endpoint.deleted       { endpoint_id }
recordRequest      → api_mock.request.recorded        { endpoint_id, method }
replayRequests     → api_mock.replay.started          { endpoint_id }
                 OR api_mock.replay.completed         { endpoint_id, requests_replayed }
```

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
blueprint_api_mock_endpoints_total              { method }
  blueprint_api_mock_requests_recorded_total     { endpoint_id }
  blueprint_api_mock_responses_sent_total         { endpoint_id, status_code }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** developer_portal, sandbox_environment

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE api_mock_endpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint        TEXT NOT NULL,
  method          TEXT NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH')),
  status_code     INTEGER NOT NULL DEFAULT 200,
  response_body   JSONB NOT NULL DEFAULT '{}',
  response_headers JSONB DEFAULT '{}',
  dynamic         BOOLEAN NOT NULL DEFAULT false,
  template        TEXT,
  delay_ms        INTEGER NOT NULL DEFAULT 0 CHECK (delay_ms >= 0 AND delay_ms <= 5000),
  error_rate      NUMERIC(5,4) DEFAULT 0,
  tag             TEXT,
  stateful        BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (endpoint, method)
);

CREATE INDEX idx_api_mock_endpoints_tag ON api_mock_endpoints(tag);

CREATE TABLE api_mock_recorded_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id     UUID NOT NULL REFERENCES api_mock_endpoints(id) ON DELETE CASCADE,
  method          TEXT NOT NULL,
  headers         JSONB NOT NULL DEFAULT '{}',
  body            JSONB,
  query_params    JSONB DEFAULT '{}',
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_mock_recordings_endpoint ON api_mock_recorded_requests(endpoint_id, timestamp DESC);
```

### Breaking Change Policy
- Adding new HTTP methods is additive and backward-compatible.
- Removing or renaming an existing method requires a MAJOR version bump.
- Changing the `delay_ms` maximum (5000ms) requires a MAJOR version bump.
- Adding new required fields to `registerMock` input requires a MAJOR version bump.

### Failure Modes
| Mode | Cause | Mitigation |
|------|-------|-----------|
| Endpoint not found on replay | Mock deleted before replay completes | Return endpoint_id not found; preserve recorded requests |
| Dynamic template evaluation error | Missing variable in request context | Return static fallback response; log template error |
| Request recording overflow | Excessive traffic to recorded endpoint | Apply rate limiting to recording; sample or rotate oldest |
| Delay variability | Simulated network jitter in delay_ms | Use consistent delay per endpoint; jitter config is explicit |
| Replay target unreachable | Original endpoint down during replay | Log failure; continue with remaining requests; mark replay as partially_completed |
