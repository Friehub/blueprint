# API Specification
## How Users Interact with the Engineering Blueprinter

> The API is the product's interface. It defines what a user sends,
> what the platform does with it, and what it returns. Every endpoint
> is designed around the pipeline's execution model: async by default,
> event-driven progress, deterministic output format.

---

## Interface Type: REST + Server-Sent Events (SSE)

The platform exposes a REST API for initiating and managing specification
runs. Long-running pipeline executions stream progress via SSE so the
client does not need to poll.

**Why SSE over WebSocket**: The communication pattern is strictly
server-to-client during execution. No bidirectional streaming is needed
except at the Clarification Gate, which uses a regular POST endpoint.
SSE is simpler, works over standard HTTP/2, and does not require a
separate protocol handshake.

**Why REST over GraphQL**: The data model is not graph-shaped. Each
spec run is a linear pipeline with a fixed set of outputs. REST's
resource model maps cleanly to this.

---

## Base URL

```
https://api.blueprinter.dev/v1
```

All endpoints require authentication via Bearer token in the
`Authorization` header.

---

## Endpoints

### POST /specs
**Create and start a new specification run.**

This is the primary entry point. It starts the pipeline asynchronously
and returns a `spec_id` immediately. The client connects to the SSE
stream to receive progress events.

**Request Body**
```json
{
  "prompt": "Build a multi-currency wallet system where users can hold USD and EUR and swap between them instantly.",
  "domain": "fintech",
  "options": {
    "generate_scaffold": false,
    "scaffold_target": "rust-axum" | "typescript-node" | "solidity" | null,
    "verification_bounds": {
      "MaxAccounts": 3,
      "MaxTransactions": 5
    }
  }
}
```

**Validation Rules**
- `prompt`: Required. Non-empty string. Max 4,000 characters.
- `domain`: Required. Currently only `"fintech"` is supported.
- `options.generate_scaffold`: Defaults to `false`.
- `options.scaffold_target`: Required if `generate_scaffold = true`.
- `options.verification_bounds`: Optional. Defaults shown above.
  Increasing bounds increases TLC runtime. Must satisfy
  `MaxAccounts <= 5` and `MaxTransactions <= 10` in MVP.

**Response: 202 Accepted**
```json
{
  "spec_id": "spec_01HZ7M3QVXK4X2RVNQ5Y8P6JA",
  "status": "running",
  "stream_url": "https://api.blueprinter.dev/v1/specs/spec_01HZ7M3QVXK4X2RVNQ5Y8P6JA/stream",
  "created_at": "2026-05-07T10:00:00Z"
}
```

**Error Responses**
```json
// 400 Bad Request -- validation failure
{
  "error": "VALIDATION_ERROR",
  "field": "domain",
  "message": "Domain 'blockchain' is not supported. Supported: ['fintech']"
}

// 422 Unprocessable -- prompt is too ambiguous to extract any requirements
{
  "error": "PROMPT_TOO_AMBIGUOUS",
  "message": "Could not extract any functional requirements. Provide more detail.",
  "suggestions": [
    "Describe what the system must do (e.g., 'Users must be able to...')",
    "Specify any constraints (e.g., 'Must handle 500 transactions per second')"
  ]
}
```

---

### GET /specs/:spec_id/stream
**Stream pipeline progress via Server-Sent Events.**

Connect immediately after receiving the `spec_id`. Keep the connection
open until a `terminal` event is received.

**Event Types**

```
event: pass_started
data: {"pass": 1, "name": "Extraction", "started_at": "..."}

event: pass_completed
data: {"pass": 1, "name": "Extraction", "duration_ms": 12400, "summary": "Extracted 8 functional requirements, 3 assumptions, 1 clarification question."}

event: clarification_required
data: {
  "spec_id": "...",
  "questions": [
    {
      "id": "CQ-001",
      "question": "Do you prioritize Consistency or Availability during a network partition?",
      "design_impact": "Consistency → SELECT FOR UPDATE. Availability → optimistic locking.",
      "blocking": true
    }
  ],
  "answer_url": "POST /specs/spec_01.../clarifications",
  "timeout_seconds": 300
}

event: verification_result
data: {
  "model_id": "BalanceSafety",
  "status": "VERIFIED",
  "duration_ms": 2100,
  "bounds": {"MaxAccounts": 3, "MaxTransactions": 5}
}

event: verification_result
data: {
  "model_id": "Idempotency",
  "status": "VIOLATED",
  "violated_invariant": "INV-003",
  "counterexample_summary": "State 3: Two requests with different idempotency keys produced duplicate ledger entries for the same transfer.",
  "redesigning": true
}

event: completed
data: {
  "spec_id": "...",
  "status": "completed",
  "overall_verification": "VERIFIED",
  "spec_url": "GET /specs/spec_01.../result",
  "tla_url": "GET /specs/spec_01.../formal-models",
  "total_duration_ms": 187400
}

event: failed
data: {
  "spec_id": "...",
  "status": "failed",
  "pass": 4,
  "error": "UNRESOLVABLE_DESIGN_CONFLICT",
  "message": "Invariant INV-003 (Idempotency) remained violated after 3 redesign attempts.",
  "counterexample_url": "GET /specs/spec_01.../counterexample/INV-003"
}
```

**Terminal events**: `completed` and `failed`. Once either is received,
the client should close the SSE connection.

---

### POST /specs/:spec_id/clarifications
**Answer clarification questions to resume a paused pipeline.**

This endpoint is only valid when the pipeline is in `awaiting_clarification`
status. Submitting answers resumes the pipeline from the Clarification Gate.

**Request Body**
```json
{
  "answers": [
    {
      "question_id": "CQ-001",
      "answer": "Consistency. We are a regulated financial institution and cannot serve stale balance data."
    }
  ]
}
```

**Validation Rules**
- All `blocking: true` questions must have an answer.
- Non-blocking questions with no answer use defaults (documented in spec).
- Submitting after the timeout (300 seconds) returns `409 Conflict` --
  the pipeline has already applied defaults and resumed.

**Response: 200 OK**
```json
{
  "spec_id": "...",
  "status": "running",
  "message": "Answers recorded. Pipeline resumed at Pass 2.",
  "applied_defaults": []
}
```

---

### GET /specs/:spec_id/result
**Retrieve the completed specification.**

Only available when `status = completed`.

**Query Parameters**
- `format`: `markdown` (default) | `json`
  - `markdown`: Returns the rendered `.spec.md` file.
  - `json`: Returns the structured pipeline outputs for programmatic use.

**Response: 200 OK (format=markdown)**
```
Content-Type: text/markdown

# Multi-Currency Wallet System -- Engineering Specification
> Generated by Engineering Blueprinter | Fintech Domain
> Formal Verification: VERIFIED (4 models, MaxAccounts=3, MaxTx=5)
> Generated: 2026-05-07T10:03:07Z

## 1. Requirements
...
```

**Response: 200 OK (format=json)**
```json
{
  "spec_id": "...",
  "extraction": { ... },
  "decomposition": { ... },
  "adversarial_report": { ... },
  "design": { ... },
  "verification": { ... }
}
```

---

### GET /specs/:spec_id/formal-models
**Download all generated TLA+ model files.**

Returns a ZIP archive containing all `.tla` and `.cfg` files generated
during Pass 5.

**Response: 200 OK**
```
Content-Type: application/zip
Content-Disposition: attachment; filename="spec_01HZ..._models.zip"
```

---

### GET /specs/:spec_id/counterexample/:invariant_id
**Retrieve the full TLC counterexample trace for a violated invariant.**

Only available when the spec has `status = failed` and the specified
invariant was violated.

**Response: 200 OK**
```json
{
  "invariant_id": "INV-003",
  "statement": "Every payment is charged at most once per idempotency key.",
  "counterexample": {
    "steps": [
      {
        "step": 1,
        "description": "Initial state: idempotency_store = {}, ledger = {}",
        "state": { "idempotency_store": {}, "ledger": [] }
      },
      {
        "step": 2,
        "description": "Transfer initiated with key='abc'. Ledger entry created.",
        "state": { "idempotency_store": {}, "ledger": [{"ref": "tx-1", "key": "abc"}] }
      },
      {
        "step": 3,
        "description": "Idempotency store write failed (crash before commit). Key='abc' not stored.",
        "state": { "idempotency_store": {}, "ledger": [{"ref": "tx-1", "key": "abc"}] }
      },
      {
        "step": 4,
        "description": "Client retries. Key='abc' not found in store. Second ledger entry created.",
        "state": {
          "idempotency_store": {},
          "ledger": [
            {"ref": "tx-1", "key": "abc"},
            {"ref": "tx-2", "key": "abc"}
          ]
        }
      }
    ],
    "violated_at_step": 4,
    "violation": "COUNT(ledger entries WHERE key='abc') = 2, violates INV-003 (must be <= 1)"
  },
  "redesign_hint": "The idempotency store INSERT must be inside the same database transaction as the ledger INSERT. If the transaction rolls back, both the ledger entry and the key are reverted together."
}
```

---

### GET /specs
**List all specification runs for the authenticated user.**

**Query Parameters**
- `status`: Filter by `running` | `awaiting_clarification` | `completed` | `failed`
- `limit`: Max results (default 20, max 100)
- `cursor`: Pagination cursor from previous response

**Response: 200 OK**
```json
{
  "specs": [
    {
      "spec_id": "...",
      "prompt_preview": "Build a multi-currency wallet system...",
      "status": "completed",
      "verification_status": "VERIFIED",
      "created_at": "2026-05-07T10:00:00Z",
      "completed_at": "2026-05-07T10:03:07Z"
    }
  ],
  "next_cursor": "..."
}
```

---

### GET /specs/:spec_id
**Retrieve metadata for a single specification run.**

**Response: 200 OK**
```json
{
  "spec_id": "...",
  "status": "completed",
  "prompt": "Build a multi-currency wallet system...",
  "domain": "fintech",
  "verification_status": "VERIFIED",
  "pass_durations_ms": {
    "extraction": 12400,
    "decomposition": 18700,
    "adversarial": 9800,
    "design": 34200,
    "verification": 22100,
    "assembly": 3400
  },
  "total_duration_ms": 100600,
  "created_at": "...",
  "completed_at": "..."
}
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /specs` | 10 spec runs per hour per user |
| `GET /specs/:id/stream` | 1 concurrent SSE connection per spec |
| `POST /specs/:id/clarifications` | 5 attempts per spec run |
| All other endpoints | 100 requests per minute per user |

Rate limit headers are returned on every response:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 8
X-RateLimit-Reset: 1746612000
```

---

## Authentication

All requests require a Bearer token:
```
Authorization: Bearer ebp_live_sk_...
```

Token format: `ebp_` prefix + `live_` or `test_` environment indicator
+ `sk_` (secret key) + random UUID.

Test environment tokens (`ebp_test_sk_...`) run the full pipeline but
do not invoke external model providers -- they use fixture responses
for deterministic testing.
