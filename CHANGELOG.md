# Changelog

## 0.3.0 — Production-Grade Generators, Pro Tier, 183 Adapters, 20 MCP Tools

### Generators (5 → 7 languages)
- **C# generator:** `Task<T>` interfaces with `CancellationToken`, record types (C# 9+), `IServiceCollection` DI extensions, xUnit tests, nullable reference types
- **PHP generator (Laravel):** Interfaces, adapter classes with constructor injection, Service Providers, PHPUnit tests, config files with env() defaults
- **TypeScript generator:** OpenTelemetry spans in every adapter, error translation layer (SDK → contract codes), Zod validation schemas, typed event types, ESM/CJS dual package support
- **Python generator:** Pydantic v2 model support (`--python-models pydantic|dataclass`), structlog contextual logging, SQLAlchemy async session management, FastAPI router generation, Hypothesis property-based tests
- **Go generator:** `context.Context` propagation on all functions, `log/slog` structured logging, `Close()` graceful shutdown hooks, database/sql transaction patterns, Wire DI provider sets
- **Rust generator:** Tokio runtime config (`#[tokio::main(flavor = "multi_thread")]`), Tower middleware for HTTP modules, OpenTelemetry spans, SQLx compile-time checked queries
- **Java generator:** Spring Boot autoconfiguration, Micrometer metrics (Counter/Timer), virtual threads (Java 21+, `--virtual-threads`), record types (`--java-records`)

### Contract Quality (162 → 183 contracts)
- **3 new contracts:** `billing_metered`, `billing_proration`, `mfa` (split from billing and auth)
- **110 C/D grade contracts upgraded to B+**: All 6 audit weaknesses fixed — strengthened invariants, added DB schemas, event emissions, observability metrics, distributed patterns, multi-tenancy standards
- **Contract versioning:** 36 at 0.1.0 (untouched A-grade), 143 at 0.2.0 (upgraded), 7 at 1.0.0 (breaking changes)
- **Auto version bump script:** `scripts/bump-versions.cjs` detects function signature changes (MAJOR), new types/events (MINOR), formatting (PATCH)
- **Naming:** All metrics renamed from `gensense_*` to `blueprint_*`
- **Format additions:** Failure Modes table + Breaking Change Policy section on all contracts

### Adapters (83 → 183)
- **100 new adapters across all tiers:**
  - P0: openai, pgvector, chroma, socket_io, redis sessions, firebase auth, supabase auth, custom_postgres (users, orders, inventory, ledger), postgresql (event_sourcing, sessions)
  - P1: firebase_fcm, apns, slack, discord, telegram (notifications), openai/cohere/google/huggingface (embeddings), kafka/rabbitmq/eventbridge/pubsub/nats (event_bus), casbin/ory_keto/openfga (permissions), notion/confluence/gitbook (knowledge_base), google_calendar/microsoft_graph/caldav (calendar), pipedrive/zoho_crm/attio (crm_leads), aws_s3/mux/bunny_cdn (media)
  - P2: bigquery/snowflake/redshift/databricks/clickhouse (data_warehouse), airbyte/fivetran/dbt/beam (data_pipeline), flink/kafka_streams/kinesis/dataflow (stream_processing), opensearch/meilisearch/typesense (search), stripe_identity/persona/smile/youverify (kyc), posthog/june/plausible (analytics), agora/twilio_video/livekit/daily_co (voice_video)
  - P3: wise/payoneer/paystack_transfers (payouts), chargebee/recurly/maxio (billing), wave/zoho_invoice (invoicing), taxjar/avalara/sovos (taxation), termii/infobip (sms), postmark/sparkpost/amazon_ses (emails), onesignal/braze (push_notifications)

### MCP Server (12 → 20 tools)
- **6 new tools:** `generate_openapi` (OpenAPI 3.1 spec), `compare_modules` (relationship analysis), `explain_invariant` (with implementation examples), `generate_seed_data` (realistic test data), `get_implementation_order` (dependency-based phasing), `get_test_cases` (contract conformance tests)
- All tools include full input/output JSON schemas

### Sagas (5 → 10)
- **5 new sagas:** `kyc_verification`, `b2b_onboarding`, `payment_chargeback`, `data_export_gdpr`, `order_fulfillment`
- Each with step-by-step compensation actions and failure mode tables

### Database Schemas
- PostgreSQL DDL added to: users, sessions, messaging, notifications, ledger, loyalty, referrals (7 previously missing)
- Redis key patterns for sessions and push_tokens

### CLI
- `--lang` supports `csharp` and `php`
- New flags: `--java-records`, `--virtual-threads`, `--python-models`

---

## 0.2.0 — Contracts, Generators, MCP Tools & Quality Gates

### Module Expansion (108 → 155)
- **47 new contracts** across 6 clusters:
  - Infrastructure & Platform (12): circuit_breaker, service_mesh, distributed_lock, scheduled_tasks, event_bus, connection_pool, migrations, seed_data, load_shedding, telemetry, config_schema, deployment_hooks
  - Data Engineering (8): data_pipeline, data_warehouse, data_catalog, stream_processing, change_data_capture, data_quality, export_pipeline, vector_store
  - Developer Platform (7): sdk_generation, sandbox_environment, api_mock, developer_portal, changelog, cli_framework, plugin_system
  - Enterprise & Compliance (9): data_retention, data_residency, access_governance, policy_engine, compliance_reporting, data_masking, right_to_erasure, sla_tracking, vendor_management
  - Real-Time & Collaboration (6): live_updates, collaborative_editing, typing_indicators, read_receipts, broadcast, voice_video
  - AI/ML (5): llm_gateway, prompt_registry, rag_pipeline, model_evaluation, content_safety

### Generators (1 → 5 languages)
- **Python generator:** `@dataclass` types, ABC with `@abstractmethod`, exception hierarchy, pytest conformance tests
- **Go generator:** Structs with JSON tags, interfaces with sentinel errors, constructor functions, Go test files
- **Rust generator:** `#[derive(Debug, Clone)]` structs, `#[async_trait]` traits, `thiserror::Error` enums, `#[cfg(test)]` modules
- **Java generator:** `CompletableFuture<T>` interfaces, POJO classes, adapter implementations, JUnit 5 tests
- **TypeScript generator:** Extended to cover all 155 contracts, SDK hints for Stripe, Redis, BullMQ

### MCP Server (7 → 12 tools)
- `get_database_schema` — Canonical DDL for a module (PostgreSQL, MySQL, etc.)
- `get_saga` — Full saga specification for multi-module flows
- `get_distributed_patterns` — Recommended patterns (saga, outbox, optimistic locking)
- `validate_implementation` — Checks code summary against contract invariants
- `suggest_modules` — Plain-English description to module suggestions + dependency order

### Adapter Language Declarations
- `languages` field in adapter YAML: adapters declare which of the 5 languages they support
- All generators filter adapters by language — Go generators skip TypeScript-only adapters
- 36 adapters explicitly declare languages, 47 default to all

### Database Schemas, Sagas & Distributed Patterns
- Canonical DDL for payments, billing, orders, inventory (PostgreSQL)
- Distributed patterns: saga, outbox, idempotency table, optimistic locking
- Sagas: checkout, refund, subscription_lifecycle, user_offboarding, dispute_resolution

### CLI Improvements
- `--lang` flag on `adapters list` and `prototype` (added Java support)
- `prototype --lang go` generates Go-appropriate scaffold and README

### Testing & Quality
- **170 tests** across 27 suites (was 91 in 7 suites)
- Pre-commit pipeline: `tsc --strict`, full test suite, catalog validation, 5-language generation smoke test
- Generator edge case tests: empty modules, no functions, void returns, null types, malformed input
- MCP unhappy path tests: non-existent modules, empty args, missing required params, cycle detection
- Language-filtered adapter generation tests

### Documentation
- Single README.md replaces 11 design docs
- Architecture flow diagram, quality gates explained, "What Blueprint is not" comparison, contributing guide

---

## 0.1.0 — Initial Release

### Core
- **Parser:** Reads 108 markdown contracts, extracts functions, types, dependencies, invariants, and provider lists. 0 errors, 0 warnings.
- **Resolver:** Transitive dependency resolution with cycle detection. Walks hard deps, attaches implicit core contracts.
- **Type inference:** Automatic type detection from parameter names (`order_id` → `string`, `amount` → `number`, `created_at` → `Timestamp`). 35 inference rules.
- **Versioning:** Extracts `**Version:** 0.1.0` from contract preambles. All 108 contracts versioned.

### Adapters
- **83 adapters across 35 modules:** Stripe, Paystack, Adyen (payments), Redis, Memcached (caching), BullMQ, SQS, RabbitMQ (queues), Resend, Sendgrid, Mailgun (email), Twilio, Vonage (SMS), Clerk, Auth0, Supertokens (auth), and more.
- **Adapter validation:** Checks implementations against contracts. Reports missing functions, suggests similar names (Levenshtein distance).
- **Config extraction:** Required and optional config fields per adapter.

### Code Generation
- **TypeScript generator:** Interfaces, adapter skeletons, conformance tests. 276 files generated from 108 contracts.
- **SDK implementations:** Real Stripe, Redis, BullMQ code embedded in generated adapters. Not stubs — working implementations.
- **Dependency-aware:** Generating a module's code also generates its hard dep interfaces.
- **Type safety:** Inferred types throughout library API and generated code. Zero `any` in function signatures.

### CLI — 14 commands
| Command | What it does |
|---|---|
| `build` | Parse contracts → catalog.json |
| `list` | All 108 modules with deps |
| `inspect` | Full contract for one module |
| `graph` | ASCII or Mermaid dependency tree |
| `search` | Interactive module picker |
| `resolve` | Transitive dependency resolution |
| `adapters` | 83 adapters: list, add, remove, verify |
| `generate` | TypeScript code generation |
| `prototype` | Project scaffold with correct npm deps |
| `schema` | JSON Schema export |
| `verify` | Check implementation against contract |
| `implement` | Generate AI implementation prompts |
| `mcp` | Start MCP server for AI tools |

### Library API
```typescript
import { loadCatalogFromRoot } from 'blueprint';
const catalog = await loadCatalogFromRoot('./contracts');
```

### MCP Server
7 tools for AI integration: `list_modules`, `get_module`, `search_modules`, `resolve_deps`, `list_adapters`, `get_adapter`, `get_dependency_graph`. Stdio transport for Claude Desktop, Cursor, Copilot.

### Testing
- **91 tests:** 58 unit + 25 integration + 8 MCP
- **Edge cases:** Empty files, malformed markdown, 50-module chains, self-referencing modules, commented-out code, return type mismatches
- **CI:** GitHub Actions on Node 18, 20, 22
