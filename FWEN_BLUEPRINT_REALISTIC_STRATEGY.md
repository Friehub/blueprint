# Blueprint × Fwen — Realistic Strategy

> **The honest answer to "what is the realistic strategy?"** The pieces are more complete than the rough idea suggests. Blueprint already has a working MCP server, 108 contracts, 83 adapters, a dependency graph, and generated TypeScript interfaces. Fwen already has a training pipeline, a RAG layer, and a quality gate. The question is not "how do we build this" — it is "how do we connect what already exists, what genuinely needs to be added to Blueprint, and what the training strategy looks like when Fwen is a software engineer rather than a coding agent." This document answers all three.

---

## Part 1 — What You Actually Have (and What It Means)

Before deciding what to build, understand what exists and how far it takes you.

### Blueprint today

**108 domain contracts** covering every recurring backend domain problem: payments, auth, billing, subscriptions, ledger, fraud, KYC, notifications, queues, caching, search, storage, webhooks, analytics, and 90+ more. Each contract has function signatures, types, invariants, error taxonomy, idempotency requirements, pagination contracts, and consistency models.

**83 adapters** mapping those contracts to real providers: Stripe, Paystack, Adyen, Clerk, Auth0, Redis, BullMQ, Temporal, SQS, S3, GCS, Algolia, Sentry, PagerDuty, and 70+ more. Each adapter declares which functions it implements and which it doesn't.

**A working MCP server** with 7 tools: list_modules, get_module, search_modules, resolve_deps, list_adapters, get_adapter, get_dependency_graph. This is not a stub — it loads the catalog, resolves transitive dependencies, detects cycles, and returns typed JSON. Any MCP-compatible AI tool can connect to it today.

**Generated TypeScript interfaces** for every contract. Every module has a corresponding `.ts` file in `generated/interfaces/`. These are what Fwen uses when it implements a contract in TypeScript — it doesn't have to infer the types, it imports them.

**A dependency graph system** that knows `billing` hard-depends on `payments` and `users`, soft-depends on `notifications` and `audit_log`. When you resolve `billing`, you get the full transitive closure of what needs to be implemented.

**Global standards** that define universal behavior: cursor pagination everywhere, idempotency key retention for 7 days on financial ops, error propagation rules for sagas, the error taxonomy (not_found → 404, unauthorized → 401, validation_error → 400, rate_limited → retry, provider_error → alert + backoff, timeout → retry with key).

### What this means for the strategy

The contracts are the stable foundation. They don't change when Stripe changes their API. They don't change when you switch from BullMQ to Temporal. They encode domain knowledge that took years to accumulate and is genuinely rare — most teams re-derive this knowledge through painful production incidents.

Fwen with Blueprint MCP is not a coding agent that happens to know some patterns. It is a software engineer that can query the exact contract for any domain problem, resolve the full dependency graph, pick the right adapter, and implement to a spec — all in one coherent action loop. That is a qualitatively different tool.

---

## Part 2 — What Blueprint Needs to Become a Complete Engineering Reference

The current Blueprint is strong on domain operation contracts. It is incomplete on three dimensions that matter for Fwen to reason as a software engineer rather than a contract implementor.

### Addition 1: Database schemas for every module

The contracts define what functions do and what types they return. They don't define how to store those types. A senior engineer immediately thinks about the database layout when they see a contract — which columns, which indexes, which foreign keys, which constraints enforce the invariants.

Every module should have a canonical database schema section. This belongs in Blueprint (not in Fwen's weights) because it changes per database engine and should be queryable at inference time.

```markdown
# Proposed addition to each contract — example: payments

## Database Schema

### PostgreSQL
```sql
CREATE TABLE payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID NOT NULL REFERENCES orders(id),
  amount        BIGINT NOT NULL CHECK (amount > 0),   -- always in smallest unit (cents)
  currency      CHAR(3) NOT NULL,
  status        payment_status NOT NULL DEFAULT 'pending',
  method        payment_method NOT NULL,
  provider_ref  TEXT,                                  -- external provider reference
  idempotency_key TEXT UNIQUE,                         -- 7-day retention
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);

CREATE TABLE wallets (
  user_id       UUID PRIMARY KEY REFERENCES users(id),
  balance       BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency      CHAR(3) NOT NULL,
  locked_balance BIGINT NOT NULL DEFAULT 0,
  version       INT NOT NULL DEFAULT 0,  -- optimistic locking
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Wallet updates MUST use optimistic locking: UPDATE WHERE version = $current_version
```

### Design decisions encoded in schema
- `amount` as BIGINT (cents) not DECIMAL — avoids floating-point representation errors
- `idempotency_key` UNIQUE constraint enforces the invariant at DB level, not just application level
- `version` column on wallets for optimistic locking — prevents double-debit race conditions
- Partial index on payments.status filters only active payments — keeps index small
```

**This should be added to all 108 contracts.** It's a significant but one-time effort — roughly 3–5 hours per contract for the core financial modules, less for simpler ones. The schemas become queryable via a new MCP tool: `get_schema(module, engine)`.

### Addition 2: Distributed system design patterns per module

The contracts have system-level constraints (consistency model, delivery guarantee, multi-region behavior, backpressure). They don't have the concrete distributed system patterns that implement those constraints.

A senior engineer reading `payments` with `consistency: strong` and `delivery: at_least_once` immediately knows: saga pattern for the payment flow, outbox pattern for webhook delivery, optimistic locking on the wallet, idempotency table for deduplication. Blueprint should encode this explicitly.

```markdown
## Distributed System Patterns

### payments

**Saga pattern** (for initiatePayment):
  Step 1: Create payment record (status: pending) — local transaction
  Step 2: Call provider (async, with idempotency key)
  Step 3: On provider success: update status → completed, emit PaymentCompleted event
  Compensation: On step 2 failure: update status → failed, emit PaymentFailed, refund if necessary

**Outbox pattern** (for PaymentCompleted events):
  Write event to outbox table in same transaction as status update
  Separate worker polls outbox and delivers to event bus
  Mark as delivered on success
  Guarantees: event is delivered at least once even if app crashes after DB write

**Idempotency table** (for provider webhook deduplication):
  Table: payment_idempotency_keys (key, result_json, created_at)
  On each webhook: check table first, return cached result if found
  Insert key + result atomically with the state change
  Retain for 7 days (per global standards)

**Optimistic locking** (for wallet operations):
  Read wallet with version N
  Apply change (debit/credit)
  UPDATE wallets SET balance = $new, version = N+1 WHERE user_id = $id AND version = N
  If 0 rows updated: another transaction won the race → retry
  Max 3 retries before returning concurrency_conflict error
```

**The MCP tool for this:** `get_distributed_patterns(module)` — returns the recommended patterns for that module's consistency and delivery requirements.

### Addition 3: Cross-module interaction patterns (sagas)

The current `contracts/core/sagas.md` defines the saga concept. It doesn't define the specific sagas for multi-module flows. A checkout flow involves `cart`, `orders`, `payments`, `inventory`, `notifications`, `audit_log`, `fulfillment`. The dependency graph tells you they're related. It doesn't tell you the sequence, compensation logic, or failure modes.

```markdown
## Proposed: contracts/sagas/checkout.md

# Saga: Checkout

**Modules:** cart → orders → payments → inventory → notifications → fulfillment → audit_log

**Steps:**
1. validate_cart(cart_id) — verify items still available at quoted prices
   Compensation: none (read-only)

2. create_order(cart_id, user_id, address) → Order
   Compensation: cancel_order(order_id)

3. reserve_inventory(order_id, items[]) → ReservationId
   Compensation: release_reservation(reservation_id)

4. initiate_payment(order_id, amount, method, idempotency_key) → Payment
   Compensation: initiate_refund(payment_id, amount, reason: "checkout_failed")

5. confirm_order(order_id) → Order
   Compensation: none (idempotent — order already in confirmed state if we reach this)

6. [async] emit: OrderConfirmed → triggers fulfillment, notification, audit_log in parallel

**Failure modes:**
- Step 3 fails (out of stock): compensate step 2, return item_unavailable error to user
- Step 4 fails (card declined): compensate steps 3, 2, return payment_failed error
- Step 4 timeout: retry with same idempotency_key, do NOT create new payment record
- Step 5 fails after step 4 succeeded: payment is complete, order confirm is a DB write — retry
- Step 6 failures: async, non-blocking — handled by event bus retry, not saga compensation

**Invariants:**
- A payment must never be captured without a corresponding order record
- Inventory must never be deducted for a failed payment
- The saga orchestrator holds the idempotency key — not individual steps
```

**MCP tool:** `get_saga(name)` — returns the full saga spec with steps, compensation, and failure modes.

---

## Part 3 — The Three-Layer Architecture

The realistic strategy has three layers that work together. Get this architecture right first — every other decision depends on it.

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: FWEN (fine-tuned Qwen3-Coder-30B)                    │
│  What lives here: reasoning patterns, communication style,      │
│  senior developer judgment, Blueprint contract instincts,       │
│  error handling reflexes, code quality standards               │
│  Updated: fine-tune (days, expensive, infrequent)             │
└─────────────────────────────────────────────────────────────────┘
          ↕ inference-time injection
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 2: RAG (ChromaDB)                                       │
│  What lives here: exact function signatures, current package   │
│  APIs, adapter configs, database schemas, saga specs,          │
│  distributed patterns — anything that changes or needs         │
│  verbatim accuracy                                             │
│  Updated: minutes (re-index when Blueprint changes)           │
└─────────────────────────────────────────────────────────────────┘
          ↕ tool calls during agent loop
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: BLUEPRINT MCP                                        │
│  What lives here: live catalog queries, dependency resolution, │
│  adapter selection, schema lookup, saga retrieval              │
│  Used when: Fwen needs to reason about module relationships    │
│  Updated: real-time (just update the contracts on disk)       │
└─────────────────────────────────────────────────────────────────┘
```

**The key principle:** each layer handles what it's good at. The MCP handles relationships and live queries. RAG handles verbatim recall. The fine-tune handles judgment.

Never move something between layers arbitrarily. If you find yourself wanting to fine-tune package API details into Fwen's weights, that's a signal those details belong in RAG. If you find yourself retrieving "what a senior engineer does when they see a payment flow" from RAG, that's a signal it belongs in the fine-tune.

---

## Part 4 — How Fwen Uses Blueprint MCP During a Task

This is the agent loop. Understanding this determines everything about what training pairs need to look like.

### Example: "Implement the checkout flow for our e-commerce platform"

```
User → Fwen: "Implement the checkout flow"

Fwen thinking:
  This is a multi-module saga. I need to know the full dependency graph
  before I write a single line of code.

Fwen → MCP: resolve_deps(["orders", "payments", "inventory"])
MCP → Fwen: {
  "orders": { hardDeps: ["users", "catalog"], softDeps: ["notifications", "audit_log"] },
  "payments": { hardDeps: [], softDeps: ["fraud_detection", "audit_log"] },
  "inventory": { hardDeps: ["catalog"], softDeps: ["notifications"] },
  "resolved_all": ["users", "catalog", "orders", "payments", "inventory",
                   "notifications", "fraud_detection", "audit_log"]
}

Fwen → MCP: get_saga("checkout")
MCP → Fwen: { steps, compensation, failure_modes, invariants }

Fwen → MCP: get_module("payments")
MCP → Fwen: { functions, types, invariants, idempotency_requirements }

Fwen → MCP: list_adapters(module="payments")
MCP → Fwen: { stripe: implements [...], paystack: implements [...] }

Fwen → RAG: retrieve_contract_context("payment saga checkout idempotency")
RAG → Fwen: { idempotency table pattern, wallet locking pattern, outbox pattern }

Fwen → RAG: retrieve_package_context("stripe typescript payment")
RAG → Fwen: { correct Stripe SDK usage, current API version }

Fwen produces:
  1. fwen-plan.yaml — the full implementation plan referencing resolved modules
  2. Saga orchestrator code with correct step sequence and compensation
  3. Payment service implementing the payments contract against Stripe adapter
  4. Inventory service implementing the inventory contract
  5. Types imported from generated/interfaces/ (not redefined)
  6. Tests for the saga's failure modes
```

This is what "software engineer" looks like versus "coding agent." The agent loop queries before it codes. It resolves dependencies before it writes imports. It checks the saga spec before it designs the orchestrator. It picks an adapter before it calls a provider.

### What training pairs need to teach

Every Blueprint implementation pair must teach the full loop — not just "here is the code." The instruction must include the MCP query results, and the output must reference them. Otherwise Fwen learns to produce code without querying, which defeats the whole architecture.

```python
# Updated pair format for Blueprint implementation tasks

BLUEPRINT_IMPLEMENT_PROMPT = """\
You are Fwen. You have queried the Blueprint MCP before starting.

## MCP Query Results

### resolve_deps result:
{resolved_deps_json}

### get_module("{module}") result:
{module_contract_json}

### list_adapters("{module}") result:
{adapters_json}

### Relevant saga (if applicable):
{saga_spec_or_none}

## Retrieved from RAG

### Contract context:
{contract_context}

### Package usage:
{package_context}

## Task

{task_instruction}

## Implementation Requirements

1. Produce fwen-plan.yaml first naming every file you will create
2. Implement against the contract exactly — function names, parameter order, return types
   must match the contract (not your memory of them)
3. Import types from generated/interfaces/{module}.ts — do not redefine them
4. Handle every error in the module's error taxonomy
5. Implement idempotency for all state-mutating functions
6. Use the adapter for all external calls — do not call the provider directly
7. Write tests for the saga's failure modes if this is a saga step
"""
```

---

## Part 5 — New MCP Tools Blueprint Needs

The current 7 tools are enough for contract lookup. A software engineering agent needs more.

### Tool 8: `get_schema(module, engine)`

Returns the canonical database schema for a module in the requested engine (postgresql, mysql, mongodb, sqlite).

```typescript
// Addition to src/mcp/server.ts

{
  name: "get_schema",
  description: "Get the canonical database schema for a module",
  inputSchema: {
    type: "object",
    properties: {
      module: { type: "string", description: "Module name" },
      engine: {
        type: "string",
        enum: ["postgresql", "mysql", "mongodb", "sqlite"],
        description: "Database engine",
        default: "postgresql",
      },
    },
    required: ["module"],
  },
},
```

### Tool 9: `get_saga(name)`

Returns the full saga specification for a multi-module flow.

```typescript
{
  name: "get_saga",
  description: "Get the full saga spec for a multi-module business flow (checkout, subscription, onboarding, etc.)",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Saga name (e.g., checkout, subscription_upgrade, user_offboarding)" },
    },
    required: ["name"],
  },
},
```

### Tool 10: `get_distributed_patterns(module)`

Returns the recommended distributed system patterns for a module's consistency and delivery requirements.

```typescript
{
  name: "get_distributed_patterns",
  description: "Get recommended distributed system patterns for a module (saga, outbox, idempotency table, optimistic locking, etc.)",
  inputSchema: {
    type: "object",
    properties: {
      module: { type: "string", description: "Module name" },
    },
    required: ["module"],
  },
},
```

### Tool 11: `validate_implementation(module, code_summary)`

Given a description of what was implemented, check it against the contract invariants and return any violations.

```typescript
{
  name: "validate_implementation",
  description: "Check an implementation description against the module contract invariants. Returns violations if any.",
  inputSchema: {
    type: "object",
    properties: {
      module: { type: "string" },
      code_summary: { type: "string", description: "Description of what was implemented" },
    },
    required: ["module", "code_summary"],
  },
},
```

### Tool 12: `suggest_modules(description)`

Given a plain-English description of what you want to build, suggest which modules to start with and in what order.

```typescript
{
  name: "suggest_modules",
  description: "Given a plain-English description of a feature or system, suggest which Blueprint modules to implement and in what order",
  inputSchema: {
    type: "object",
    properties: {
      description: { type: "string", description: "What you want to build" },
    },
    required: ["description"],
  },
},
```

---

## Part 6 — Training Strategy for "Software Engineer not Coding Agent"

The shift from "coding agent" to "software engineer" requires training pairs that represent the full scope of what an engineer does. Most of what changes is not the code — it's the reasoning before the code, the communication around the code, and the decisions about what not to build.

### What a software engineer does that a coding agent doesn't

A coding agent takes a task and produces code. A software engineer:

1. **Reads the system before touching it** — understands what exists, what it connects to, what invariants it must preserve
2. **Resolves scope before writing** — knows what modules are involved before writing a function signature
3. **Thinks about failure modes** — considers what happens when the third-party API is down, the database is under load, the message is delivered twice
4. **Designs data before code** — the schema comes before the implementation, because the schema is harder to change
5. **Communicates decisions** — explains why, not just what; pushes back when the approach is wrong; asks when scope is unclear
6. **Thinks about the team** — writes code others can read, maintain, and extend; leaves no clever puzzles
7. **Tracks technical debt** — knows what was skipped and why, and says so explicitly

### Training categories to add or expand for this shift

**System comprehension pairs** (1,500 pairs) — given an existing codebase summary, answer: what does this system currently do, what does it not handle, what are the risks in extending it this way.

```python
SYSTEM_COMPREHENSION_PROMPT = """\
You are Fwen. A team has given you the following system summary before asking you to implement a new feature.

EXISTING SYSTEM:
{system_summary}

PROPOSED FEATURE:
{feature_description}

Before writing any code:
1. What does the existing system currently handle that is relevant to this feature?
2. What does it NOT currently handle that this feature requires?
3. What are the top 2 risks of implementing this feature given the current system?
4. What should be clarified before starting?

Be specific. Reference actual modules, tables, and functions mentioned in the system summary.
"""
```

**Schema design pairs** (1,000 pairs) — given a contract, design the database schema, explain every decision. These are distinct from implementation pairs — the output is SQL, not application code.

**Failure mode analysis pairs** (800 pairs) — given a function and its context, enumerate what can go wrong and how to handle each case. Output is a table: failure → probability → impact → handling.

**Technical debt naming pairs** (400 pairs) — given implemented code that has known shortcuts, write the comment/PR description that honestly describes what was skipped and why it's acceptable now. Teaches Fwen to communicate tradeoffs rather than pretend shortcuts don't exist.

```python
TECH_DEBT_PROMPT = """\
You implemented the following feature under time pressure. Some things were simplified.

IMPLEMENTATION:
{code}

SHORTCUTS TAKEN:
{shortcuts}

Write a pull request description that:
1. Explains what was built and what it does
2. Is honest about what was simplified and why
3. Names the specific conditions under which the simplification would need to be revisited
4. Does not apologise excessively — treat shortcuts as engineering decisions, not failures

Tone: direct and professional. Not defensive. Not over-explaining.
"""
```

**Architecture review pairs** (600 pairs) — given a proposed architecture diagram or description, identify the weakest points. These train Fwen to read a system design and immediately see what breaks under load, what creates coupling, what the failure modes are.

**On-call reasoning pairs** (500 pairs) — given an alert, a stack trace, and a system summary, produce: hypothesis, investigation steps, immediate mitigation, root cause to investigate. Different from incident response (which is communication) — this is the reasoning process before the Slack message.

---

## Part 7 — Realistic Timeline and Sequencing

This is a multi-phase project. The phases are sequential — don't start phase 2 until phase 1 is complete.

### Phase 1: Fix and generate (4–6 weeks)

**What:** Fix the 6 bugs in the Fwen pipeline, generate the dataset with the API call reductions, fine-tune Fwen V4.

**Blueprint work needed:** None yet. Use the existing catalog as-is. The current 108 contracts are enough for V4 training.

**Output:** Fwen V4 — a specialised coding agent that implements Blueprint contracts correctly, communicates like a senior engineer, and doesn't drift across files.

**Measure success by:** Blueprint implementation pair quality on the held-out eval set, HumanEval retention, frontend state coverage rate in dry-run outputs.

### Phase 2: Blueprint expansion (6–10 weeks, parallel to V4 evaluation)

**What:** Add database schemas to all 108 contracts. Design and write 15–20 saga specs for the most common multi-module flows. Add distributed system patterns to the 30 most complex modules. Implement MCP tools 8–12.

**Fwen work needed:** None yet. Evaluate V4 first — understand what it gets right and wrong before designing V5 training.

**Output:** Blueprint v2 — a complete engineering reference with schemas, sagas, distributed patterns, and richer MCP tooling.

### Phase 3: Fwen V5 — software engineer (8–12 weeks)

**What:** New training categories for system comprehension, schema design, failure mode analysis, architecture review, on-call reasoning, technical debt communication. Pairs that include MCP tool call results in the instruction (teaching the agent loop). RAG updated with Blueprint v2 schemas and sagas.

**Dependency:** Phase 2 must be complete. Training pairs that reference schemas and sagas that don't exist in Blueprint yet will generate hallucinated content.

**Output:** Fwen V5 — a software engineer. Can read a system, design the data layer, implement against contracts, reason about failure modes, and communicate like a senior. Uses Blueprint MCP as a native part of its reasoning loop.

### Phase 4: Team integration (ongoing)

**What:** Deploy Fwen + Blueprint MCP to the team's tooling (Claude Desktop, Cursor, VS Code). Collect real usage patterns — what does the team actually ask, what does Fwen get wrong, what MCP queries are made most often. Feed this back into V6 training data.

**The flywheel:** Real usage → real failure cases → real training data → better model → more usage.

---

## Part 8 — What NOT to Do

These are the failure modes of this kind of project. Name them explicitly.

**Do not try to bake schemas into Fwen's weights.** Database schemas for 108 modules is verbatim structured data — weights are bad at this. Put schemas in Blueprint, query them via MCP, inject via RAG. Update them without retraining.

**Do not fine-tune V5 before evaluating V4.** You need to know what V4 gets wrong before designing V5 training. Running both in parallel wastes GPU time on a problem you haven't defined yet.

**Do not expand Blueprint before the MCP server can serve the additions.** Adding schemas to contracts before `get_schema` is implemented means the new content is in files but not queryable by Fwen. Build the tool, then add the content.

**Do not add more categories to the V4 dataset.** The V4 dataset is already at 160K+ pairs. Adding more categories at this stage delays generation without proportional quality improvement. Focus on generating what's planned and evaluating the result.

**Do not deploy Fwen to the team before establishing what "good" looks like.** Set 3–5 specific eval criteria for what Fwen V4 must achieve before it goes to the team. Eval first, deploy second. A bad first impression is hard to recover from.

---

## The Honest Summary

You have two strong assets: a Blueprint that is genuinely better than anything publicly available for AI-assisted backend development, and a Fwen training pipeline that is more rigorous than most fine-tune projects at this scale.

The realistic strategy in one sentence: **ship V4 as a specialised coding agent, expand Blueprint with schemas and sagas in parallel, then train V5 as a software engineer once you've seen what V4 gets wrong.**

The temptation is to try to build the final system all at once. The risk is that you spend 6 months building V5's training data against Blueprint contracts that don't yet have schemas, and discover when you evaluate that the model needed the schemas to reason correctly about data design. Phase 1 → measure → Phase 2 → measure → Phase 3 is slower on paper and faster in reality.

The MCP is the right architecture. RAG for verbatim recall, MCP for live queries, fine-tune for judgment. Don't collapse these layers.
