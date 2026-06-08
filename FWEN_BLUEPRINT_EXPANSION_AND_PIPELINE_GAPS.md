# Blueprint Expansion, System Design Tool & Training Pipeline — Complete Plan

> **What this covers:** (1) Every module Blueprint needs to be complete — grouped by what's genuinely missing vs what would be nice to have, with rationale for each. (2) Language expansion — what to generate for each language and how the plugin system handles it. (3) Whether to build a system design tool and what it should actually do. (4) The three-layer decision: what goes into weights, what stays in RAG, what stays as a live tool — settled definitively for every category of knowledge. (5) Every remaining gap in the Fwen training pipeline so generation can start.

---

## Part 1 — Blueprint Module Gaps

Blueprint has 108 modules. The gaps fall into five clusters. Each cluster has a rationale — Blueprint's inclusion rule is "recurs across at least three different application types with a stable interface." Every module listed here passes that test.

---

### Cluster A — Infrastructure & Platform (12 modules)

These are the operational layer that every production system needs. Blueprint currently has `health`, `config`, `secrets`, `queues`, `jobs`, `caching`, `cache_invalidation`. The gaps are the remaining infrastructure concerns a senior engineer handles.

| Module | What it covers | Hard deps | Why it's missing |
|---|---|---|---|
| `circuit_breaker` | State machine (closed/open/half-open), failure threshold, recovery probe, fallback | none | Every service calling external APIs needs this. Currently implied by provider_error handling but not formalised |
| `service_mesh` | Service discovery, health checks, load balancing, mTLS between services | none | Microservice topology concern. Needed once Blueprint describes multi-service systems |
| `distributed_lock` | Acquire, release, extend, try-acquire with timeout, fencing tokens | none | Required by any module that needs cross-instance coordination (scheduler, inventory reservation) |
| `scheduled_tasks` | Register cron, pause, resume, trigger manually, get execution history | `jobs` | Distinct from queues — time-based triggering, not event-based. Needed for billing cycles, reports |
| `event_bus` | Publish typed event, subscribe, filter, replay from offset, dead-letter | none | Currently `events` module is too thin — no subscription management or replay |
| `connection_pool` | Pool configuration, health check, drain, resize, metrics | none | Every DB and HTTP client needs this. Currently implicit |
| `migrations` | Apply, rollback, status, lock, baseline, validate schema drift | none | Schema change management is a first-class concern in every production system |
| `seed_data` | Seed environment, reset to baseline, snapshot, restore | `migrations` | Dev/test/staging environments all need this |
| `load_shedding` | Priority queuing, admission control, drop-or-delay policy, SLO budget | `rate_limiting` | Different from rate limiting — this is internal capacity management, not per-client limiting |
| `telemetry` | Span creation, metric recording, log correlation, sampling policy | none | Currently `trace_query` is read-only. This is the write side — emitting structured telemetry |
| `config_schema` | Schema validation for config values, type coercion, env override, required fields | `config` | `config` stores values. `config_schema` validates them at startup — prevents misconfiguration |
| `deployment_hooks` | Pre-deploy health check, post-deploy smoke test, rollback trigger, migration gate | none | Continuous deployment concern — know when a deploy is safe to proceed |

---

### Cluster B — Data Engineering (8 modules)

Blueprint currently has `data_import` and `reporting`. The data layer is much broader — every company beyond early stage has data pipeline concerns.

| Module | What it covers | Hard deps | Why it matters |
|---|---|---|---|
| `data_pipeline` | Define pipeline, run, pause, retry failed stage, get run history | none | ETL/ELT orchestration. Every analytics system eventually builds this |
| `data_warehouse` | Table/view management, query execution, partition management, cost control | `reporting` | Separate from OLTP. BigQuery/Snowflake/Redshift patterns are distinct from Postgres patterns |
| `data_catalog` | Register dataset, describe schema, track lineage, tag for governance | `data_warehouse` | Data discoverability — what data exists, where it came from, who owns it |
| `stream_processing` | Define stream, apply transformation, window aggregate, output sink | `event_bus` | Kafka/Flink patterns — real-time data processing distinct from batch |
| `change_data_capture` | Configure CDC on table, stream changes, filter by operation, handle schema evolution | none | Debezium/Postgres WAL patterns. Critical for event-driven architectures |
| `data_quality` | Define expectation, run validation, track pass/fail history, alert on degradation | `data_pipeline` | Great Expectations / dbt tests patterns — data correctness assurance |
| `export_pipeline` | Scheduled export, format conversion, destination delivery, retry, manifest | `storage` | Distinct from `audit_exports` — this is bulk data delivery (CSV/Parquet to S3/GCS) |
| `vector_store` | Upsert embeddings, similarity search, namespace management, metadata filter | `embeddings` | Currently `embeddings` generates vectors but doesn't manage their storage and retrieval |

---

### Cluster C — Developer Platform (7 modules)

These modules appear in internal tooling, developer-facing SaaS, and platform engineering. Missing entirely from Blueprint.

| Module | What it covers | Hard deps | Why it matters |
|---|---|---|---|
| `sdk_generation` | Generate client SDK from OpenAPI spec, publish to registry, version | none | Every API platform eventually generates client SDKs |
| `sandbox_environment` | Provision isolated test environment, seed, expire, reset | `provisioning` | Stripe's test mode, Twilio's sandbox — test environment isolation as a service |
| `api_mock` | Register mock endpoint, configure response, record request, replay | none | Testing without live credentials — needed in every CI pipeline |
| `developer_portal` | API key self-service, documentation hosting, usage dashboard, changelog | `api_keys`, `web_analytics` | Internal and external developer experience |
| `changelog` | Record breaking change, migration guide, semver bump, notify subscribers | none | Every versioned API needs this |
| `cli_framework` | Command registration, argument parsing, help generation, config file loading | none | Recurring pattern in developer tools — distinct from web API design |
| `plugin_system` | Register plugin, validate interface, load/unload, sandboxed execution | none | Extension point pattern — used in editors, CLIs, platforms |

---

### Cluster D — Enterprise & Compliance (9 modules)

These modules appear primarily in B2B SaaS, fintech, healthcare, and any regulated industry. Currently Blueprint has `kyc`, `consent`, `audit_log`, `encryption`, `secrets`. The gaps are the remaining compliance layer.

| Module | What it covers | Hard deps | Why it matters |
|---|---|---|---|
| `data_retention` | Define retention policy, run purge job, export before deletion, compliance log | `audit_log`, `consent` | GDPR Article 17 right to erasure. Every regulated system needs explicit retention |
| `data_residency` | Declare residency requirement, route data to correct region, verify compliance | none | EU data sovereignty — data must not leave the region. Storage routing concern |
| `access_governance` | Periodic access review, approval workflow, revoke stale access, audit report | `permissions`, `audit_log` | SOC2 / ISO 27001 requirement — access must be reviewed periodically |
| `policy_engine` | Define policy as code, evaluate decision, explain reasoning, version policies | `permissions` | OPA/Casbin patterns — complex authorization beyond RBAC |
| `compliance_reporting` | Generate SOC2/GDPR/HIPAA report, map controls to evidence, export | `audit_log` | Compliance automation — every enterprise needs this for audits |
| `data_masking` | Mask PII in logs, anonymise for analytics, tokenise for storage | none | Privacy engineering — prevent PII from appearing in non-production systems |
| `right_to_erasure` | Locate all user data across services, delete, certify deletion, notify | `users`, `audit_log` | GDPR Article 17 — distinct from soft delete, requires cross-service coordination |
| `sla_tracking` | Define SLA, track uptime, calculate breach, generate report, alert | `health`, `incident_management` | Commercial SLA enforcement for B2B contracts |
| `vendor_management` | Register vendor, track contract, monitor health, manage offboarding | none | Enterprise procurement concern — who are we dependent on and are they healthy |

---

### Cluster E — Real-Time & Collaboration (6 modules)

Blueprint has `messaging`, `presence`, `comments`, `reactions`, `follows`. Real-time features go deeper than this.

| Module | What it covers | Hard deps | Why it matters |
|---|---|---|---|
| `live_updates` | Subscribe to resource changes, push delta, handle reconnect, manage subscription lifecycle | `presence` | WebSocket/SSE subscription management — not just presence, but data change streaming |
| `collaborative_editing` | CRDT-based operational transforms, cursor positions, conflict resolution, history | `document_editor`, `users` | Google Docs-style concurrent editing — fundamentally different from regular document storage |
| `typing_indicators` | Broadcast typing state, expire stale indicators, channel scoping | `presence`, `messaging` | Thin module but universally needed in messaging products |
| `read_receipts` | Mark as read, bulk mark, get unread count, broadcast read state | `messaging` | Universal in messaging — distinct from notification delivery confirmation |
| `broadcast` | Send to channel, filter recipients, delivery confirmation, rate control | `notifications` | One-to-many push distinct from targeted notifications |
| `voice_video` | Room creation, participant management, recording, transcription trigger | `users` | WebRTC coordination — token generation, room lifecycle, TURN server management |

---

### Cluster F — AI/ML (5 modules)

Blueprint has `embeddings`. The AI layer is expanding in every product. These are the recurring patterns.

| Module | What it covers | Hard deps | Why it matters |
|---|---|---|---|
| `llm_gateway` | Route to model, manage context window, streaming response, token counting, fallback | none | Every product adding AI needs unified model routing with cost control |
| `prompt_registry` | Store prompt template, version, evaluate, A/B test variants | none | Prompt management as infrastructure — not just inline strings |
| `rag_pipeline` | Chunk document, embed, store, retrieve with reranking, citation tracking | `embeddings`, `vector_store` | Full retrieval-augmented generation pipeline as a reusable contract |
| `model_evaluation` | Define eval dataset, run evaluation, track metrics over time, regression alert | none | LLMOps — systematic quality tracking for AI features |
| `content_safety` | Check content for policy violations, classify, log decision, appeal workflow | `moderation` | AI output safety layer — distinct from user-generated content moderation |

---

### Total additions: 47 modules

| Cluster | Count | Priority |
|---|---|---|
| A — Infrastructure & Platform | 12 | High — needed for distributed system design tasks |
| B — Data Engineering | 8 | Medium — needed for data platform and analytics use cases |
| C — Developer Platform | 7 | Medium — needed for B2B and tooling use cases |
| D — Enterprise & Compliance | 9 | High — needed for any regulated industry training data |
| E — Real-Time & Collaboration | 6 | Medium — needed for consumer product use cases |
| F — AI/ML | 5 | High — every product now has AI features |
| **Total** | **47** | Blueprint goes from 108 → 155 modules |

Add them in priority order. Clusters A and F first — they're needed for the system design tool and the distributed systems training category that already exists in Fwen's task generator.

---

## Part 2 — Language Expansion

Blueprint already has a generator plugin architecture designed for multiple languages (`src/generators/`). TypeScript is fully implemented. The others are designed but not built. Here is what each language generates and the priority.

### What each language needs generated

Every language generates the same four artefacts from the same contract:

**1. Interface / type definition** — the contract as the language's native type system. TypeScript interfaces, Python Protocols, Go interfaces, Rust traits, C# interfaces, Java interfaces, Kotlin data classes + interfaces.

**2. Adapter skeleton** — a concrete class/struct implementing the interface with every function stubbed and typed. This is what Fwen fills in when implementing a contract.

**3. Error types** — the module's error taxonomy as typed exceptions/error types. Python custom exceptions, Go sentinel errors + error types, Rust enums, TypeScript union types.

**4. Test conformance harness** — a test file that verifies any implementation against the contract invariants. Language-native test framework.

### Language priority

| Language | Priority | Rationale | Generator complexity |
|---|---|---|---|
| **Python** | Immediate | Primary Fwen language, Fwen dataset has thousands of Python Blueprint pairs that currently use no generated types | Low — Python Protocol + dataclass |
| **Go** | Immediate | Second Fwen language, Go's interface system maps cleanly to Blueprint contracts | Low — Go interfaces are structural |
| **TypeScript** | Done | Already complete | — |
| **Rust** | High | Fwen trains Rust pairs, trait system maps perfectly to Blueprint contracts | Medium — lifetime annotations |
| **C#** | High | Enterprise target, .NET interface system is a direct match | Low — near-identical to TypeScript |
| **Java** | Medium | Large enterprise install base, Spring Boot use case | Medium — verbose generics |
| **Kotlin** | Medium | Android + Spring Boot, modern Java alternative | Low — similar to Java but cleaner |
| **Ruby** | Low | Smaller share of Fwen training, duck typing reduces value of generated interfaces | High — no static types |

### Python generator — what it produces

```python
# generated/interfaces/payments.py  (example output)

from typing import Optional, Literal
from dataclasses import dataclass
from datetime import datetime
from abc import ABC, abstractmethod

PaymentStatus = Literal["pending", "processing", "completed", "failed", "refunded", "disputed"]
PaymentMethod = Literal["card", "bank_transfer", "wallet", "ussd", "qr_code"]

@dataclass
class Payment:
    id: str
    order_id: str
    amount: int           # always in smallest currency unit
    currency: str         # ISO 4217
    status: PaymentStatus
    method: PaymentMethod
    provider_reference: Optional[str]
    created_at: datetime

@dataclass
class PaginatedResult[T]:
    data: list[T]
    cursor: Optional[str]
    has_more: bool
    total: Optional[int]

class PaymentsContract(ABC):
    """Blueprint payments contract v0.1.0"""

    @abstractmethod
    async def initiate_payment(
        self,
        order_id: str,
        amount: int,
        currency: str,
        method: PaymentMethod,
        idempotency_key: Optional[str] = None,
    ) -> Payment: ...

    @abstractmethod
    async def verify_payment(self, payment_id: str) -> Payment: ...

    @abstractmethod
    async def initiate_refund(
        self,
        payment_id: str,
        amount: Optional[int],
        reason: str,
        idempotency_key: Optional[str] = None,
    ) -> "Refund": ...

# Error types from contract error taxonomy
class PaymentError(Exception): pass
class InsufficientFundsError(PaymentError): pass
class CardDeclinedError(PaymentError): pass
class DuplicateReferenceError(PaymentError): pass
class ProviderUnavailableError(PaymentError): pass
class FraudBlockedError(PaymentError): pass
```

### Go generator — what it produces

```go
// generated/interfaces/payments.go  (example output)

package blueprint

import (
    "context"
    "time"
)

type PaymentStatus string

const (
    PaymentStatusPending    PaymentStatus = "pending"
    PaymentStatusProcessing PaymentStatus = "processing"
    PaymentStatusCompleted  PaymentStatus = "completed"
    PaymentStatusFailed     PaymentStatus = "failed"
    PaymentStatusRefunded   PaymentStatus = "refunded"
    PaymentStatusDisputed   PaymentStatus = "disputed"
)

type Payment struct {
    ID                string        `json:"id"`
    OrderID           string        `json:"order_id"`
    Amount            int64         `json:"amount"`  // smallest currency unit
    Currency          string        `json:"currency"` // ISO 4217
    Status            PaymentStatus `json:"status"`
    Method            string        `json:"method"`
    ProviderReference string        `json:"provider_reference,omitempty"`
    CreatedAt         time.Time     `json:"created_at"`
}

// PaginatedResult is the canonical paginated response type.
// All paginated functions return this type.
type PaginatedResult[T any] struct {
    Data    []T     `json:"data"`
    Cursor  *string `json:"cursor"`
    HasMore bool    `json:"has_more"`
    Total   *int64  `json:"total,omitempty"`
}

// PaymentsService defines the Blueprint payments contract v0.1.0.
// All implementations must satisfy this interface.
type PaymentsService interface {
    InitiatePayment(ctx context.Context, orderID string, amount int64, currency string,
        method string, idempotencyKey *string) (*Payment, error)
    VerifyPayment(ctx context.Context, paymentID string) (*Payment, error)
    InitiateRefund(ctx context.Context, paymentID string, amount *int64,
        reason string, idempotencyKey *string) (*Refund, error)
    GetWallet(ctx context.Context, userID string) (*Wallet, error)
    // ... all functions from contract
}

// Sentinel errors from contract error taxonomy
var (
    ErrInsufficientFunds   = errors.New("insufficient_funds")
    ErrCardDeclined        = errors.New("card_declined")
    ErrDuplicateReference  = errors.New("duplicate_reference")
    ErrProviderUnavailable = errors.New("provider_unavailable")
    ErrFraudBlocked        = errors.New("fraud_blocked")
)
```

These generated files are what Fwen imports in training pairs — not manually written type definitions. This is important for training consistency: every Python Blueprint pair uses `from blueprint.interfaces.payments import PaymentsContract, Payment`, not ad-hoc types.

---

## Part 3 — The System Design Tool

Yes. Build it. But be precise about what it does, because the scope needs to be defined correctly or it becomes a vague "AI generates architecture diagrams" tool that helps nobody.

### What the tool actually is

**Blueprinter Architect** — an MCP tool (extending the existing MCP server) that, given a plain-English description of a system to build, produces:

1. A resolved module set (which Blueprint contracts are involved)
2. A topology recommendation (monolith, modular monolith, microservices — with justification)
3. A dependency graph showing which modules communicate and how
4. Database schema per module (PostgreSQL canonical)
5. The relevant sagas for cross-module flows
6. The distributed system patterns required by the consistency + delivery guarantees
7. An implementation order (which modules to build first given their dependencies)

This is not a diagram generator. It is a structured engineering decision that Fwen can then implement against.

### The four topology patterns it knows

```
Pattern 1: MONOLITH
When: team < 5 engineers, early stage, unclear domain boundaries
Blueprint usage: all modules deployed as one service, shared database
Tradeoffs: fastest to build, test, deploy; becomes painful after ~50K lines

Pattern 2: MODULAR MONOLITH  
When: team 5-15, domain understood, scale not yet needed
Blueprint usage: modules as packages within one deployable, separate schemas per domain
Tradeoffs: clear boundaries without operational complexity of microservices

Pattern 3: MICROSERVICES (domain-grouped)
When: team > 15, independent scaling needed, team-per-service ownership
Blueprint usage: groups of cohesive modules per service (e.g. billing+payments+ledger together)
Tradeoffs: operational complexity, network failures, distributed transactions

Pattern 4: CELL-BASED (multi-tenant microservices)
When: strict tenant isolation required (compliance, performance), enterprise B2B
Blueprint usage: per-tenant routing, cross-cell reads forbidden
Tradeoffs: highest operational cost, required for strict data residency
```

### The tool implementation

New MCP tools added to `src/mcp/server.ts`:

```typescript
// Tool: design_system
// Input: description (plain English), constraints (optional: team_size, scale, compliance)
// Output: complete architecture decision with modules, topology, database, sagas, patterns

{
  name: "design_system",
  description: "Given a description of what to build, produce a complete architecture: modules, topology, database schemas, sagas, and implementation order",
  inputSchema: {
    type: "object",
    properties: {
      description: { type: "string", description: "What you want to build" },
      constraints: {
        type: "object",
        properties: {
          team_size: { type: "number" },
          scale: { type: "string", enum: ["prototype", "startup", "growth", "enterprise"] },
          compliance: { type: "array", items: { type: "string" } },
          languages: { type: "array", items: { type: "string" } },
        }
      }
    },
    required: ["description"]
  }
}

// Tool: compare_topologies
// Input: module list, constraints
// Output: monolith vs modular monolith vs microservices comparison for this specific set

{
  name: "compare_topologies",
  description: "Compare deployment topologies for a given set of modules. Returns tradeoffs specific to those modules and constraints.",
  inputSchema: {
    type: "object",
    properties: {
      modules: { type: "array", items: { type: "string" } },
      constraints: { type: "object" }
    },
    required: ["modules"]
  }
}

// Tool: get_database_schema
// Input: module name, engine
// Output: canonical DDL for that module

{
  name: "get_database_schema",
  description: "Get the canonical PostgreSQL/MySQL/MongoDB schema for a module",
  inputSchema: {
    type: "object",
    properties: {
      module: { type: "string" },
      engine: { type: "string", enum: ["postgresql", "mysql", "mongodb", "sqlite"], default: "postgresql" }
    },
    required: ["module"]
  }
}

// Tool: get_saga
// Input: saga name
// Output: full saga spec with steps, compensation, failure modes

// Tool: get_distributed_patterns
// Input: module name
// Output: recommended distributed patterns for that module's consistency requirements
```

### What the tool does NOT do

It does not generate code directly. It produces the structured spec that Fwen then implements. The distinction matters — the tool is Blueprint's intelligence layer, Fwen is the implementation layer. Keep them separate.

It does not pick cloud providers. It describes patterns (outbox, saga, circuit breaker) independent of whether you're on AWS, GCP, or bare metal.

It does not maintain state between queries. Each `design_system` call is stateless — the result goes into context for Fwen to implement against.

---

## Part 4 — The Three-Layer Decision: Weights vs RAG vs Tool

This is the most important architectural decision. Getting it wrong wastes GPU time fine-tuning things that belong in RAG, or building RAG indexes for things the model already knows.

The rule is not "static vs dynamic." The rule is: **what kind of reasoning is required to use this knowledge?**

- **Weights** = reasoning patterns, judgment, style, instincts, "how a senior engineer thinks"
- **RAG** = verbatim recall of structured facts that must be exact and can change
- **Tool** = live queries, relationship traversal, things that depend on the current state of the catalog

### Settled: what goes in weights

| Knowledge | Rationale |
|---|---|
| The saga pattern conceptually | "When step N fails, compensate steps N-1...1" — this is a reasoning pattern, not a lookup |
| When to use microservices vs monolith | Judgment call based on team size, domain clarity, scale — teaches the thinking, not a lookup |
| Error handling instincts | "provider_unavailable → retry with backoff, not_found → return null not throw" — reflexes |
| Code quality standards | No TODOs, cursor pagination, idempotency keys — trained instincts that fire on every output |
| Communication style | How to push back, how to write a PR comment, when to ask vs assume — deeply behavioural |
| Distributed system concepts | CAP theorem understanding, consistency models, failure modes — conceptual reasoning |
| Security instincts | "If this is a financial operation, check for idempotency" — pattern recognition |
| Testing judgment | "This function has external side effects, it needs an integration test" — judgment |
| When to use which DB | "Write-heavy with complex queries → PostgreSQL, simple key-value → Redis" — judgment patterns |
| Blueprint contract instincts | "Payment functions need idempotency keys" — general knowledge baked in so Fwen doesn't have to query for basics |

### Settled: what goes in RAG

| Knowledge | Rationale |
|---|---|
| Exact function signatures | Changes when contracts evolve. Must be verbatim accurate. Wrong signature = broken code |
| Current package API versions | Pydantic v2 vs v1, TanStack Query v5 vs v4 — changes constantly, weights go stale |
| Adapter configuration fields | Which fields Stripe adapter requires vs Paystack — provider-specific, changes with provider updates |
| Database schemas per module | Canonical DDL — exact column names matter, must be queried not recalled |
| Saga step sequences | The exact order matters. Step 3's compensation calls step 2's rollback function by exact name |
| Error taxonomy per module | `insufficient_funds` vs `card_declined` — exact error codes that callers match on |
| Design tokens for frontend | Exact spacing values, color tokens — must be verbatim, off-scale values break the system |
| Package migration patterns | What changed between Pydantic v1 and v2 specifically — exact API differences |
| Distributed patterns per module | Outbox vs saga recommendation for payments specifically — module-specific, queryable |

### Settled: what stays as a live MCP tool

| Knowledge | Rationale |
|---|---|
| Dependency graph traversal | "What does billing transitively depend on?" — requires graph traversal over current catalog state |
| Adapter availability | "Which adapters exist for payments?" — depends on current `adapters/` directory |
| Module search by description | "Which module handles X?" — semantic search over live catalog, not pattern matching |
| System design recommendation | "What modules do I need for a checkout flow?" — requires resolving against current catalog |
| Schema for specific module+engine | Combination lookup — modules × engines × current schema version |
| Saga retrieval | Full saga spec including current step functions — must match current contract versions |
| Contract version checking | "Does this adapter implement v0.1.0 or v0.2.0?" — requires live catalog query |
| Validate implementation | "Did this implementation handle all error cases?" — requires current error taxonomy from catalog |

### The test for ambiguous cases

When unsure which layer something belongs in, apply this test: **if the knowledge were wrong, would Fwen silently produce broken code (RAG/Tool) or would Fwen produce code with incorrect judgment (Weights)?**

Example: "Use cursor pagination" — if wrong, Fwen uses offset pagination. The code works but is wrong for large datasets. This is a judgment failure → **Weights**.

Example: "The `cursor` field is named `cursor` not `next_cursor`" — if wrong, the TypeScript interface won't match the contract. This is a verbatim recall failure → **RAG**.

Example: "The `payments` module has a hard dependency on `users`" — if wrong, Fwen doesn't include the users service in the deployment plan. This requires live graph traversal → **Tool**.

---

## Part 5 — Training Pipeline Gaps Before Generation Can Start

Reading the current state of `modal_fwen_v4.py` and the pipeline files, these are the specific gaps that will prevent generation from succeeding or will silently produce the wrong data.

### Gap 1: `step_generate_pairs` still uses the wrong tasks_dir path

`step_generate_pairs` passes `tasks_dir="/root/pipeline/tasks"` to `generate_dataset`. This is the container's local path. Task specs are written to `/data/fwen_v4/tasks` (the Modal volume). The step will generate zero pairs.

**Fix (2 min):**
```python
# In step_generate_pairs, change:
tasks_dir="/root/pipeline/tasks"
# To:
tasks_dir="/data/fwen_v4/tasks"
```

### Gap 2: `step_generate_task_specs` is not wired into the pipeline steps dict

`generate_all_tasks()` exists in `task_generator.py` and is comprehensive (33 builders, all categories). But there is no `step_generate_task_specs` function in `modal_fwen_v4.py` and no entry in the `steps` dict. The entire task generation step is missing from the orchestration.

**Fix (30 min):**
```python
# Add to modal_fwen_v4.py

@app.function(image=base_image, volumes={"/data": volume}, timeout=600)
def step_generate_task_specs():
    """Materialise all task specs to /data/fwen_v4/tasks/ before generation."""
    from pipeline.task_generator import generate_all_tasks
    import json
    from pathlib import Path

    catalog_path = Path("/root/pipeline/combined_catalog.json")
    tasks = generate_all_tasks(catalog_path=str(catalog_path))

    out_dir = Path("/data/fwen_v4/tasks")
    out_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    for category, task_list in tasks.items():
        out_file = out_dir / f"{category}.jsonl"
        with open(out_file, "w") as f:
            for task in task_list:
                f.write(json.dumps(task) + "\n")
        total += len(task_list)
        print(f"  {category}: {len(task_list)} tasks")

    print(f"Total task specs: {total}")
    volume.commit()

# Add to steps dict:
steps = {
    "validate_known_bad": step_validate_known_bad,
    "task_specs": step_generate_task_specs,   # ← add this
    "parse": step_parse_contracts,
    # ... rest
}
```

### Gap 3: `step_generate_team_comms` has `limit=130` hardcoded

The function signature defaults to `limit=130`. With 130 pairs out of 160K total, team communication is 0.08% of the dataset — behaviorally negligible. The bug report document flagged this but it's still 130 in the current code.

**Fix (2 min):**
```python
# Change:
def step_generate_team_comms(limit: int = 130):
# To:
def step_generate_team_comms(limit: int = 1200):
```

### Gap 4: `step_generate_plan_to_code` has `limit=100` hardcoded

Same issue. 100 plan-to-code pairs is 0.06% of the dataset. This is the highest-value category in the dataset.

**Fix (2 min):**
```python
# Change:
def step_generate_plan_to_code(limit: int = 100):
# To:
def step_generate_plan_to_code(limit: int = 600):
```

### Gap 5: `nvidia_client.py` is still the import in all generators — not `api_client.py`

The API migration doc was written. `api_client.py` exists in the pipeline. But `pair_generator.py`, `team_comms_generator.py`, and `plan_to_code_generator.py` still import from `nvidia_client`. When the Modal secret is named `opencode-api` (not `nvidia-api-key`), all generation steps will fail with a missing env var.

**Fix (15 min — find and replace):**
```bash
# In each generator file:
# Change: from pipeline.nvidia_client import call_nvidia, call_nvidia_with_thinking
# To:     from pipeline.api_client import call_nvidia, call_nvidia_with_thinking
# (The compatibility shims in api_client.py mean function signatures stay the same)

# Also update modal_fwen_v4.py secrets references:
# Change: secrets=[modal.Secret.from_name("nvidia-api-key")]
# To:     secrets=[modal.Secret.from_name("opencode-api")]
```

### Gap 6: `generate_all_tasks()` exists but is never called with the catalog path

`generate_all_tasks()` in `task_generator.py` accepts `catalog_path=None` and falls back to a local path when None. In Modal, the catalog is at `/root/pipeline/combined_catalog.json` after `step_parse_contracts`. The fallback local path does not exist in the Modal container.

**Already addressed in Gap 2 fix above** — pass `catalog_path` explicitly in `step_generate_task_specs`.

### Gap 7: `step_assemble` does not include `frontend_pairs.jsonl` and `team_comms.jsonl` in the glob

`step_assemble` globs `/data/fwen_v4/*.jsonl`. The frontend step writes to `/data/fwen_v4/frontend_pairs.jsonl` and team comms writes to `/data/fwen_v4/team_comms.jsonl`. These should be included — and they will be by the glob. But verify the defensive loading (Bug 5 from the bug check doc) is applied so corrupt partial files don't abort assembly.

**Verify:** the defensive loading fix from the bug check doc handles this. No code change needed beyond confirming it's in place.

### Gap 8: No `step_validate_known_bad` function in the current `modal_fwen_v4.py`

The steps dict references `"validate_known_bad": step_validate_known_bad` but the function isn't defined. Running `--step validate_known_bad` crashes immediately.

**Fix (20 min):**
```python
@app.function(image=base_image, volumes={"/data": volume}, timeout=120)
def step_validate_known_bad():
    """Run the known-bad test suite. Must pass 100% before any generation."""
    from quality_gate.runner import validate_known_bad
    result = validate_known_bad()
    if result["pass_rate"] < 1.0:
        raise RuntimeError(
            f"Known-bad suite failed: {result['failures']} pairs passed when they should "
            f"have been rejected. Fix the quality gate before generating data."
        )
    print(f"✓ {result['total']} known-bad pairs correctly rejected. Gates calibrated.")
```

### Gap 9: The `system_design` and `distributed_systems` task builders produce interview-style tasks, not Blueprint-grounded ones

`build_system_design_tasks()` currently generates: "Design a URL shortener", "Design WhatsApp", "Design Twitter". These are useful for general system design knowledge but they're disconnected from Blueprint. Fwen learns to design Twitter from scratch rather than to design a notification-heavy social system using the Blueprint modules it knows.

**Fix (1 hour):** Add a second `build_blueprint_system_design_tasks()` that generates system design tasks grounded in real Blueprint module combinations:

```python
def build_blueprint_system_design_tasks(modules: list[dict]) -> list[dict]:
    """
    System design tasks grounded in Blueprint modules.
    Teaches Fwen to design real systems using contracts it will implement.
    Target: 200 tasks.
    """
    BLUEPRINT_SYSTEMS = [
        {
            "system": "multi-tenant SaaS billing platform",
            "modules": ["tenants", "billing", "payments", "subscriptions",
                       "usage_metering", "invoicing", "audit_log"],
            "constraints": "100K tenants, PCI-DSS compliance, multi-currency",
        },
        {
            "system": "real-time collaboration platform",
            "modules": ["users", "workspaces", "messaging", "presence",
                       "notifications", "permissions", "document_editor"],
            "constraints": "10K concurrent users per workspace, conflict-free editing",
        },
        {
            "system": "e-commerce platform with fraud detection",
            "modules": ["catalog", "cart", "orders", "payments", "inventory",
                       "fraud_detection", "shipping", "notifications", "audit_log"],
            "constraints": "Black Friday scale, cart abandonment recovery, multi-region",
        },
        {
            "system": "developer API platform with usage billing",
            "modules": ["api_keys", "rate_limiting", "usage_metering", "usage_billing",
                       "webhooks", "audit_log", "notifications", "analytics"],
            "constraints": "10M API calls/day, real-time usage dashboard, webhook retry",
        },
        {
            "system": "healthcare appointment system",
            "modules": ["users", "appointments", "calendar", "payments",
                       "notifications", "kyc", "audit_log", "consent"],
            "constraints": "HIPAA compliance, double-booking prevention, no-show tracking",
        },
    ]

    tasks = []
    for system in BLUEPRINT_SYSTEMS:
        for _ in range(40):
            tasks.append({
                "type": "system_design",
                "route": "DEEP",
                "system": system["system"],
                "modules": system["modules"],
                "constraints": system["constraints"],
                "grounded_in_blueprint": True,
            })
    return tasks
```

### Gap 10: No `step_index_packages` in the current pipeline

`index_packages.py` was written in the API migration doc. But it's not a step in `modal_fwen_v4.py` and not called in the pipeline flow. The package RAG index won't exist at inference time.

**Fix (20 min):**
```python
@app.function(image=base_image, volumes={"/data": volume}, timeout=300)
def step_index_packages():
    """Build the package knowledge RAG index for inference-time retrieval."""
    from pipeline.index_packages import build_package_index
    build_package_index(chroma_path="/data/fwen_v4/chroma_inference")
    volume.commit()
    print("Package index built successfully")

# Add to steps dict and run after step_index_contracts
```

---

## Part 6 — Correct Execution Order (With All Fixes Applied)

```bash
# 1. Validate gates before touching anything
modal run modal_fwen_v4.py --step validate_known_bad

# 2. Parse contracts into combined_catalog.json
modal run modal_fwen_v4.py --step parse

# 3. Generate ALL task specs from catalog (new step — needed before generate)
modal run modal_fwen_v4.py --step task_specs

# 4. Establish baseline before touching the model
modal run modal_fwen_v4.py --step eval --detach

# 5. Run these in parallel (no dependencies between them):
modal run modal_fwen_v4.py --step antiforgetting --detach
modal run modal_fwen_v4.py --step external --detach

# 6. Main generation (after task_specs is complete):
modal run modal_fwen_v4.py --step generate --detach

# 7. Specialised generation (can run parallel to step 6):
modal run modal_fwen_v4.py --step generate_team_comms --detach
modal run modal_fwen_v4.py --step generate_plan_to_code --detach
modal run modal_fwen_v4.py --step generate_frontend_pairs --detach

# 8. Monitor (run anytime):
modal run modal_fwen_v4.py --step status

# 9. After all generation complete:
modal run modal_fwen_v4.py --step assemble

# 10. Check health report — do NOT proceed if health=FAIL
modal volume get fwen-data fwen_v4/health_report.json -

# 11. Index for RAG (run in parallel with assembly):
modal run modal_fwen_v4.py --step index
modal run modal_fwen_v4.py --step index_packages   # new step

# 12. Fine-tune
modal run modal_fwen_v4.py --step finetune --detach

# 13. Evaluate
modal run modal_fwen_v4.py --step eval_finetuned
```

---

## Summary: What to Do Before Running Generation

**In Blueprint (do these to unblock Fwen V4 training on the newest contracts):**
- Add Cluster A modules (circuit_breaker, distributed_lock, event_bus, scheduled_tasks, telemetry, migrations) — needed for distributed systems training category which already has 200 tasks but no Blueprint grounding
- Add Cluster F modules (llm_gateway, rag_pipeline, vector_store) — AI features appear in 30%+ of modern products
- Build Python and Go generators — Fwen's training pairs currently use ad-hoc types instead of Blueprint-generated interfaces

**In Fwen (fix these 10 gaps before running `modal run`):**
1. Fix `tasks_dir` path in `step_generate_pairs` (2 min)
2. Add `step_generate_task_specs` to `modal_fwen_v4.py` (30 min)
3. Change `step_generate_team_comms` limit from 130 → 1200 (2 min)
4. Change `step_generate_plan_to_code` limit from 100 → 600 (2 min)
5. Replace `nvidia_client` imports with `api_client` everywhere (15 min)
6. Add `step_validate_known_bad` function (20 min)
7. Add `step_index_packages` function (20 min)
8. Update Modal secrets name from `nvidia-api-key` to `opencode-api` (5 min)
9. Add `build_blueprint_system_design_tasks` to task generator (1 hour)
10. Add dataset_schema Category entries for all categories from recent docs (20 min)

**Total time to generation-ready: approximately 4 hours of code changes.**
