# Blueprint Gap Analysis — vs Backend Engineering Curriculum

**Source:** `/Friehub/Taas/backend_notes/README.md` (1127 lines, 12 sections + DevOps deep dive)
**Date:** 2026-06-11
**Purpose:** Identify what backend domain knowledge is NOT covered by Blueprint contracts, and plan implementation.

---

## Coverage Summary

| Section | Blueprint Status |
|---|---|
| 1. Programming | Not applicable (language syntax, algorithms) |
| 2. Git | Not applicable (version control) |
| 3. Backend Tools | Not applicable (package managers, linters, build tools) |
| 4. Server-Side | **Partial** — HTTP, validation, auth covered. GraphQL, gRPC, SSE, API versioning, serialization formats missing |
| 5. Databases | **Partial** — Entity extraction done, migrations exist. Event sourcing, CQRS, query optimization patterns, migration strategies missing |
| 6. System Design | **Partial** — Reliability patterns exist. Chaos engineering, bottleneck analysis, graceful degradation patterns missing |
| 7. Distributed Systems | **Partial** — Sagas done, CAP covered. Consensus algorithms, replication models as configurable contracts missing |
| 8. Production Engineering | **Mostly missing** — Connection pooling, graceful shutdown, health check configuration, backpressure patterns not formalized |
| 9. Testing | **Mostly missing** — Conformance tests exist. Contract testing, property-based testing, load testing contracts missing |
| 10. DevOps | Not applicable (Docker, K8s, CI/CD are tool-specific) |
| 11. Security | **Well covered** — CSRF, SSRF, brute force, transport, token binding, error translation, refresh family tracking all done |
| 12. Serverless | **Missing** — Cold start optimization, FaaS lifecycle, edge computing patterns |

---

## High-Value Gaps (Contract-Appropriate)

### Gap 1: GraphQL (`contracts/graphql.md`)
**Source:** Section 4 — GraphQL Deep Dive
- Schema definition types (Query, Mutation, Subscription)
- Resolver contracts with DataLoader N+1 prevention
- Subscription patterns with backpressure
- Federation / schema stitching contracts
- Code-first vs schema-first patterns

### Gap 2: gRPC (`contracts/grpc.md`)
**Source:** Section 4 — API Design
- Service definition with 4 RPC types (unary, server-stream, client-stream, bidirectional)
- Protobuf schema versioning
- Deadline / timeout propagation
- Interceptor middleware patterns
- Health checking protocol (grpc.health.v1)

### Gap 3: Event Sourcing (`contracts/event_sourcing.md`)
**Source:** Section 5 — Schema Design Patterns
- Event store append contract
- Projection rebuild from event stream
- Snapshot management
- Catch-up subscription with offset tracking
- Event versioning and schema evolution

### Gap 4: CQRS (`contracts/cqrs.md`)
**Source:** Section 5 — Architecture Patterns
- Command model vs query model separation
- Read model projection contracts
- Eventual consistency synchronization
- Separate schemas for read/write sides
- Materialized view management

### Gap 5: Enhanced Connection Pool (`contracts/connection_pool.md` enhance)
**Source:** Section 8 — Performance Engineering
- Pool sizing ratios (max_active / max_idle)
- Acquisition timeout policies
- Eviction strategies (LRU, idle timeout, lifetime)
- Health-check-on-borrow vs periodic validation
- Metrics exposure for pool utilization

### Gap 6: Graceful Shutdown (`contracts/graceful_shutdown.md`)
**Source:** Section 8 — Reliability Engineering
- Shutdown phase ordering (stop accepting → drain in-flight → close resources → exit)
- In-flight request finalization with deadline
- Resource cleanup ordering (connections → caches → databases)
- SIGTERM / SIGINT handling patterns
- Kubernetes preStop hook integration

### Gap 7: Enhanced Health Check (`contracts/health.md` enhance)
**Source:** Section 8 — Production Safety
- Liveness vs readiness probe semantics
- Dependency health aggregation (if DB is down, readiness = false)
- Startup probe for slow-initializing services
- Failure threshold configuration
- Health check endpoint contracts (/healthz, /readyz)

### Gap 8: Load Testing (`contracts/load_testing.md`)
**Source:** Section 9 — Load Testing
- Scenario definition contracts (ramp-up, steady, ramp-down)
- Threshold configuration (p50/p95/p99 latency targets)
- SLA validation targets vs test results
- Report format contracts
- Distributed load generation patterns

### Gap 9: API Versioning (`contracts/api_versioning.md`)
**Source:** Section 4 — API Versioning Strategies
- URL versioning vs header versioning vs content negotiation
- Deprecation window policies
- Breaking change detection rules
- Migration guide requirements
- Sunset header and retirement policies

### Gap 10: SSE (`contracts/sse.md`)
**Source:** Section 4 — API Design
- Event stream contract (event:, data:, id:, retry:)
- Reconnection with Last-Event-ID
- Event ID tracking and deduplication
- Stream lifecycle management
- Backpressure for slow consumers

### Gap 11: Data Serialization (`contracts/data_serialization.md`)
**Source:** Section 4 — Data Serialization Formats
- Schema evolution rules (adding/removing/renaming fields)
- Backward and forward compatibility contracts
- Field numbering conventions (protobuf)
- Wire format versioning
- JSON vs binary format selection criteria

### Gap 12: Incident Response (`contracts/incident_response.md`)
**Source:** DevOps deep dive — Incident Response section
- On-call schedule contract
- Incident severity classification (SEV1-SEV4)
- Escalation path contracts
- Postmortem template contracts
- Root cause analysis structure
- Blameless culture requirements

### Gap 13: Chaos Engineering (`contracts/chaos_engineering.md`)
**Source:** Section 8 — Chaos Engineering
- Failure injection scenario definitions
- Resilience testing contracts (steady-state hypothesis)
- Blast radius configuration
- Rollback / abort conditions
- Experiment schedule and approval workflow

### Gap 14: Database Topology (`contracts/database_topology.md`)
**Source:** Section 5 — Scaling Databases + Section 7 — Replication Models
- Sharding strategy selection (key-based, range-based, directory-based)
- Consistent hashing ring configuration
- Replication model selection (leader-follower, multi-leader, leaderless)
- Read replica configuration and consistency guarantees
- Failover mechanism contracts (automated vs manual)
- Cross-region replication topology

### Gap 15: Migration Strategies (`contracts/migration_strategies.md`)
**Source:** Section 5 — Migration Strategies (zero-downtime, backward compatible)
- Expand/contract pattern for backward-compatible changes
- Zero-downtime migration steps (expand → migrate → contract)
- Rollback procedure contracts per migration type
- Data migration vs schema migration distinction
- Long-running migration patterns (background backfill, dual-write)
- Migration testing requirements (pre-prod dry run, rollback test)

### Gap 16: Transaction Isolation (`contracts/transaction_isolation.md`)
**Source:** Section 5 — Transactions
- Per-module isolation level contracts (READ COMMITTED, REPEATABLE READ, SERIALIZABLE)
- Deadlock prevention patterns (lock ordering, timeout policies)
- Distributed transaction patterns (2PC, saga, TCC)
- Retry semantics for serialization failures
- Lock escalation and lock timeout configuration

---

## Low-Value Gaps (Not Contract-Appropriate)

These are tool-specific or operational concerns that Blueprint should NOT cover:

| Curriculum Item | Reason for Exclusion |
|---|---|
| Package managers (npm, pip, cargo) | Tool-specific. Not a domain contract. |
| Build tools (Webpack, esbuild, Vite) | Tool-specific. Change too frequently. |
| Linters (ESLint, Prettier, RuboCop) | Tool-specific. GenSense handles this. |
| Reverse proxies (Nginx, HAProxy) | Operational. Provider-specific. |
| CI/CD tools (GitHub Actions, Jenkins) | Tool-specific. Deployment models vary. |
| Docker / Kubernetes | Operational. Container orchestration is not a domain. |
| Infrastructure as Code (Terraform, Pulumi) | Tool-specific. Cloud-provider-specific. |
| Cloud providers (AWS, GCP, Azure) | Anti-pattern. Blueprint is provider-agnostic. |
| API documentation tools (Swagger, Redoc) | Output format, not a contract. |
| Logging libraries (Winston, Pino, log4j) | Tool-specific. GenSense handles observability. |
| Process managers (PM2, systemd, Supervisor) | Operational. Platform-specific. |

---

## Implementation Plan

### Phase 1 — Contract Files Only (No Generator Changes)
Write 14 new `.md` files + enhance 2 existing:
- `contracts/graphql.md`
- `contracts/grpc.md`
- `contracts/event_sourcing.md`
- `contracts/cqrs.md`
- `contracts/graceful_shutdown.md`
- `contracts/sse.md`
- `contracts/load_testing.md`
- `contracts/api_versioning.md`
- `contracts/data_serialization.md`
- `contracts/incident_response.md`
- `contracts/chaos_engineering.md`
- `contracts/database_topology.md`
- `contracts/migration_strategies.md`
- `contracts/transaction_isolation.md`
- Enhance `contracts/connection_pool.md` (add production config)
- Enhance `contracts/health.md` (add liveness/readiness/probes)

### Phase 2 — Generator Support
- Wire GraphQL schema types into TypeScript/Go generators
- Wire gRPC service definitions into Go generator
- Wire event sourcing projections into Rust generator
- Wire health check endpoints into all generators

### Phase 3 — MCP + Design Tool
- New contracts automatically surfaces via existing `suggest_modules` and `get_module` MCP tools
- Design tool picks up new dependencies automatically (contract deps)
- Entity extractor may find new entities from new contracts

---

## Priority Order

1. **GraphQL** — Most requested pattern, every modern API uses it
2. **gRPC** — Microservices standard, Go generator targets this
3. **Graceful Shutdown** — Every production system needs it, zero coverage
4. **Enhanced Health Check** — Every deployment needs it, current contract is minimal
5. **Event Sourcing + CQRS** — Often implemented together, high-value pattern
6. **SSE** — Lightweight alternative to WebSockets, missing from real-time contracts
7. **Migration Strategies** — Every team needs zero-downtime deployments, high pain
8. **Database Topology** — Sharding + replication decisions are hard to undo
9. **Transaction Isolation** — Wrong isolation level causes data corruption silently
10. **Data Serialization** — Schema evolution is a universal pain point
11. **Incident Response** — Missing operational contract, connects to GenSense
12. **Load Testing** — Helps teams validate, connects to GenSense observability
13. **Chaos Engineering** — Advanced reliability, lower immediate need
14. **API Versioning** — Important for long-lived APIs, connects to changelog contract
15. **Enhanced Connection Pool** — Existing contract exists, just needs production config
