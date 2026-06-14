# System Design, Database & Distributed Architecture — Strategy Document

**Status:** Design document for v0.3.0
**Audience:** Senior engineers, AI agents, and the Blueprint maintainer

---

## 1. What This Tool Is and Is Not

### What it is
A structured design assistant that helps engineers and AI agents understand what they are building before they write code. It reads module contracts and produces: entity models, storage schemas, topological recommendations, distributed patterns, saga flows, and implementation orders.

### What it is not
- A replacement for a senior engineer
- A production deployment plan
- A cloud provider recommendation engine
- A capacity planning tool
- A migration plan generator

Every output carries the disclaimer: *"This is a starting point. Review, test, and adapt before production use."*

---

## 2. The Two Audiences

### Senior Engineers (docs site)
They use the interactive tool on the docs site to:
1. Select modules for their system
2. See the resolved entity model and relationships
3. Pick databases per module and see generated schemas
4. Review the topology recommendation and adjust it
5. Copy generated schemas, patterns, and prompts into their IDE

### AI Agents (MCP tools)
They call the MCP tools to:
1. Given a plain-English description, resolve modules (`suggest_modules` — already exists)
2. Extract entity models from resolved modules (new tool: `get_entity_model`)
3. Get storage schemas for target databases (extends `get_database_schema`)
4. Get a complete architecture decision (new tool: `design_system`)

---

## 3. Data Store Classification

Blueprint modules interact with three categories of storage. Each has different semantics:

| Category | Examples | Semantics |
|---|---|---|
| **Primary data store** | PostgreSQL, MongoDB, DynamoDB | Durable, transactional, queryable. Entities live here. |
| **Ephemeral cache** | Redis, Memcached | Volatile, key-value, TTL-bound. Derived data lives here. |
| **Message broker** | Kafka, RabbitMQ, SQS, BullMQ | Transient, ordered, consumer-group. Events and jobs flow through here. |
| **Blob store** | S3, GCS, Azure Blob | Immutable, large objects. Files, backups, exports live here. |

The entity model extraction focuses on **primary data stores**. Modules that only use caches or message brokers (e.g., `caching`, `queues`, `rate_limiting`) do not produce entity models — they produce configuration patterns instead.

Redis is specifically treated as a cache and coordination primitive. Modules that use Redis for primary storage (as a document store) are an anti-pattern and must explicitly opt in with a documented justification.

---

## 4. Architecture Layers

### Layer 1 — Entity Model Extraction

**Input:** A set of module contracts.
**Output:** Entity models per module with fields, types, relationships, and access patterns.

**How it works:**
1. For each module in the resolved set, parse the `Types` section to extract struct definitions
2. Each struct with an `id` field is a candidate entity
3. Fields are typed from the contract: `string`, `number`, `boolean` — with additional storage type inference
4. Relationships are inferred from field naming: `*_id` → foreign key candidate
5. Access patterns are inferred from function signatures

```
Example: payments module
  Entity: Payment
    Fields:
      id: string (UUID, primary)
      order_id: string (UUID, foreign → orders.Order)
      amount: number (storage_type: i64_decicents)
      currency: string (char3)
      status: PaymentStatus (enum)
      method: PaymentMethod (enum)
      provider_reference: string? (nullable, optional)
      idempotency_key: string? (unique)
      created_at: datetime (auto)
      updated_at: datetime (auto)
    Access patterns:
      by_order:      findBy(order_id)
      by_status:     findWhere(status IN ['pending', 'processing'])
      by_idempotency: findByUnique(idempotency_key)
    Relationships:
      → orders.Order (via order_id)
      → users.User (via user_id, context-dependent)
```

**Limitations explicitly stated in the output:**
```
# This entity model is extracted from contract types and function signatures.
# It does NOT specify:
#   - Storage format (BIGINT vs DECIMAL — inferred from naming conventions)
#   - Index strategy (recommended, not optimal for all data volumes)
#   - Partitioning (tenant_id inferred if the module has a hard dep on tenants)
#   - Audit columns (added by the renderer, not the contract)
```

### Layer 2 — Storage Renderer

**Input:** Entity model + target database.
**Output:** Concrete schema in the target database's native format.

**Supported databases:**
| Database | What it generates |
|---|---|
| PostgreSQL | CREATE TABLE with columns, constraints, indexes, RLS policies, audit columns |
| MongoDB | Collection schema with field types, indexes, validation rules, shard keys |
| DynamoDB | Table definitions with partition/sort keys, GSIs, LSIs, capacity mode |

**Redis is NOT a database renderer.** For modules that use Redis (caching, rate_limiting, sessions), the tool generates key patterns and data structure recommendations instead of entity schemas.

**Default security baked into every generated schema:**
- `created_at` and `updated_at` columns on every entity
- `deleted_at` column for soft-delete support (configurable)
- `tenant_id` column if the module has a hard dependency on `tenants`
- Row-level security policy if tenant-scoped
- Comment block explaining every constraint and its purpose

**The renderer never:**
- Recommends a specific cloud provider
- Suggests a specific instance size or capacity
- Generates migration scripts (those are operational, not structural)
- Makes assumptions about data volume or throughput

### Layer 3 — System Design Aggregator

**Input:** A resolved module set + storage choices per module.
**Output:** A complete architecture decision document.

**What it produces:**
1. **Module set** — which contracts are involved
2. **Topology recommendation** — monolith, modular monolith, microservices, or cell-based
3. **Entity model** — all entities across all selected modules
4. **Storage schemas** — per-module, per-chosen database
5. **Service boundaries** — which modules group together, which communicate via API calls vs events
6. **Distributed patterns** — saga, outbox, idempotency table, circuit breaker, load shedding
7. **Saga flows** — relevant sagas for the selected module set
8. **Implementation order** — what to build first based on the dependency graph
9. **Prompts** — structured implementation prompts for each module (for AI agents or engineers)

---

## 5. Topology Recommendation Engine

The tool recommends one of four patterns. Each recommendation includes the tradeoffs specific to the selected module set, not generic advice.

### Pattern 1: Monolith
- **When:** 1-5 engineers, unclear domain boundaries, fast iteration required. Total modules < 20.
- **Blueprint usage:** All modules in one deployable, shared database, shared cache.
- **Output:** Single schema file, single deployable scaffold, shared configuration.

### Pattern 2: Modular Monolith
- **When:** 5-15 engineers, domain understood but scale not yet needed. 10-50 modules.
- **Blueprint usage:** Modules as packages within one deployable, separate database schemas per domain, shared cache.
- **Output:** Domain-grouped schema files, domain-grouped package scaffold.

### Pattern 3: Microservices (domain-grouped)
- **When:** 15+ engineers, independent scaling needed, per-service ownership. 30+ modules.
- **Blueprint usage:** Groups of cohesive modules per service. Example: billing, payments, invoicing, and ledger form one service.
- **Output:** Per-service schema files, per-service deployable scaffolds, event bus topology, saga orchestrator scaffold.

### Pattern 4: Cell-based (multi-tenant)
- **When:** Strict tenant isolation required (compliance, security, performance isolation). Enterprise B2B.
- **Blueprint usage:** Per-tenant routing, cross-cell reads forbidden. Each cell is a self-contained stack.
- **Output:** Per-cell schema, routing configuration, cell provisioning scaffold.

**The topology recommendation is a weighted score, not a binary choice.** The output shows the score for each pattern and the factors that influenced it. The engineer decides.

---

## 6. What Senior Engineers Would Ask

If a senior engineer reviewed this tool, here is what they would point out, and how the tool addresses each concern:

| Concern | How the tool addresses it |
|---|---|
| "Where is the data actually stored?" | Explicit storage classification: primary store, cache, broker, blob. No ambiguity. |
| "What happens when two modules share the same entity?" | Entity collision detection. The tool surfaces conflicts and offers merge or manual resolution. |
| "What index should I use for this query pattern?" | Access patterns are extracted from function signatures. Index recommendations are generated with a caveat: "review with your data volume." |
| "How do I handle multi-tenancy?" | If any selected module has a hard dependency on `tenants`, the renderer adds `tenant_id` and RLS by default. Configurable. |
| "What about security columns?" | `created_at`, `updated_at`, `deleted_at` are added to every entity by default. Opt-out, not opt-in. |
| "Can I override the generated schema?" | Every generated schema is a starting point. The engineer modifies it. The tool provides the baseline. |
| "How do I know if the schema is stale?" | Schema drift detection: compare the entity model against the last generated schema. Flag differences. Not yet implemented — planned. |

---

## 7. What Blueprint Does Not Do (And Will Not Do)

This is an explicit boundary document. Blueprint provides structure, not decisions.

**Blueprint will not:**
- Choose a cloud provider (patterns are provider-agnostic)
- Recommend instance sizes or capacity (that is operational, not structural)
- Generate infrastructure-as-code (Terraform, CloudFormation)
- Generate CI/CD pipelines
- Recommend monitoring thresholds (alerts are operational)
- Generate zero-downtime migration scripts (those depend on deployment topology)
- Predict query performance (that requires real data and profiling)
- Enforce which database to use (user chooses; tool renders for the chosen database)
- Generate Kubernetes manifests or Docker files (operational, not structural)

**Blueprint will:**
- Tell you what entities exist and how they relate
- Generate a secure-by-default starting schema
- Recommend a topology with tradeoffs
- Surface distributed patterns relevant to your consistency and delivery requirements
- Provide structured implementation prompts for AI agents

---

## 8. Implementation Phases

### Phase 1: Entity Model Extraction (now)
- Walk all 162 contracts, parse Types sections, extract struct definitions
- Infer storage types, relationships, and access patterns
- Produce `entities/<module>.json` for every module
- Add `get_entity_model` MCP tool

### Phase 2: PostgreSQL Renderer
- Render entity models to PostgreSQL DDL
- Include security defaults (audit columns, tenant_id, RLS)
- Generate index recommendations from access patterns
- Produce `db/postgresql/<module>.sql` output

### Phase 3: MongoDB Renderer
- Render entity models to MongoDB collection schemas
- Include validation rules, indexes, shard key recommendations

### Phase 4: System Design Aggregator
- `design_system` MCP tool: takes module selection → complete architecture document
- Interactive docs site tool: select modules, pick databases, see live output

### Phase 5: Redis + Cache Patterns
- For modules that use Redis (caching, rate_limiting, sessions), generate key patterns and data structure recommendations instead of entity schemas
- Distinguish between cache-aside, write-through, and read-through patterns

---

## 9. Reducing AI Hallucination

When an AI agent uses this tool for system design, the output must constrain the agent's generation, not expand it. Concrete strategies:

1. **Explicit boundaries in every output.** Every generated schema, topology recommendation, and distributed pattern document carries a limitations section.
2. **Structured over prose.** All outputs are structured JSON or typed markdown, not freeform text. This reduces the surface area for hallucination.
3. **Defaults are secure, not aggressive.** The renderer adds audit columns, RLS, and tenant isolation by default. The agent does not need to remember to add them — they are already there.
4. **Type mapping is explicit and documented.** The storage type inference table is public and overridable. No magic numbers. No hidden heuristics.
5. **Human review markers.** Every generated artifact includes `/* REVIEW */` markers at decision points where the tool made an inference. The human (or agent) must explicitly confirm or override these.

---

*This document is the design plan for the system design, database, and distributed architecture tools in Blueprint v0.3.0. All implementation decisions should reference this document.*
