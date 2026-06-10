# Engineering Blueprinter

Every backend system is made of the same puzzles: payments, notifications, auth, caching, queues. The implementations differ. The interface does not. Stripe and Paystack both process payments. Twilio and Vonage both send texts. Redis and Memcached both cache things.

Blueprint captures that shape. It defines what `initiatePayment` must guarantee, what errors it can throw, and how it behaves under load -- once, in one place, so an AI agent or a new team member never has to guess.

The catalog contains **155 module contracts** covering payments, billing, auth, messaging, storage, search, queuing, fraud detection, AI/ML gateways, data pipelines, compliance, real-time collaboration, infrastructure primitives, and more. Each contract is a markdown file with a strict structure: functions, types, invariants, system constraints, and dependencies. The parser validates every contract against this schema -- vague or incomplete contracts are rejected.

**83 adapter definitions** map these contracts to concrete providers. The payments contract works identically whether backed by Stripe, Paystack, or Adyen. The caching contract abstracts Redis, Memcached, or any key-value store. Each adapter declares exactly which functions it implements and which it does not -- omission is a CI error.

**5 code generators** (TypeScript, Python, Go, Rust, Java) produce typed interfaces, adapter skeletons, and conformance tests from any contract. Generated code can be further protected with namespace prefixes, JSON5 alias maps, or deterministic name obfuscation.

**12 MCP tools** expose the full catalog to AI agents over stdio -- dependency resolution, module search, saga retrieval, implementation validation, and system design suggestions.

**155 modules. 83 adapters. 5 languages. 12 MCP tools. 204 tests. No ambiguity.**

---

## How it works

```
contracts/*.md          adapters/*/*.yaml       sagas/*.md
      |                      |                    |
  [parser]               [loader]             [MCP tools]
      |                      |                    |
      +----------+-----------+--------------------+
                 |
           [catalog]
                 |
      +----+-----+-----+------+------+
      |    |     |     |      |      |
   [gen] [MCP] [CLI] [verify] [saga] [schema]
```

Contracts are parsed into a typed catalog. From there the system generates code, serves MCP tools, resolves dependencies, verifies implementations, and queries sagas.

---

## Quick start

```bash
npm install -g engineering-blueprint

# Explore the catalog
blueprint list
blueprint inspect payments
blueprint graph billing
blueprint search "checkout flow"

# Select adapters and generate code
blueprint adapters add stripe payments
blueprint adapters add redis caching
blueprint generate --lang python
blueprint generate --module billing --lang go --namespace acme

# Verify implementations
blueprint verify ./src/adapters/payments/stripe.ts --module payments
```

Use as a library:

```typescript
import { loadCatalogFromRoot } from 'engineering-blueprint';
const catalog = await loadCatalogFromRoot('./contracts');
const billing = catalog.modules.find(m => m.name === 'billing');
```

### CLI reference

| Command | Description |
|---|---|
| `build` | Parse contracts, write catalog.json |
| `list` | List all modules with dep counts |
| `inspect <module>` | Full contract for one module |
| `graph <module>` | Dependency tree (ASCII or Mermaid) |
| `search <query>` | Find modules by name, summary, function |
| `resolve` | Show transitive dependencies |
| `adapters` | List, add, remove, verify adapters |
| `generate` | Generate interfaces + adapters + tests |
| `prototype` | Scaffold a full project |
| `schema` | Export catalog as JSON Schema |
| `verify <file>` | Check implementation against contract |
| `implement` | Generate AI implementation prompts |
| `mcp` | Start the MCP server |

Flags: `--root`, `--strict`, `--strict-version`, `--output`, `--compact`, `--minimal`, `--quiet`, `--format ascii|mermaid`, `--lang typescript|python|go|rust|java`, `--module`, `--modules`, `--name`, `--namespace`, `--aliases`, `--obfuscate`

---

## Code generation

5 language generators. Each produces a typed interface, an adapter skeleton, and a conformance test.

| Language | Interface | Adapter | Test framework |
|---|---|---|---|
| TypeScript | `interface` | SDK stub | Jest / node:test |
| Python | `ABC` with `@abstractmethod` | Implementation class | pytest |
| Go | `interface` with sentinel errors | Struct with constructor | `testing` |
| Rust | `#[async_trait]` trait | Struct with `new()` | `#[cfg(test)]` |
| Java | `interface` with `CompletableFuture` | Implementation class | JUnit 5 |

```bash
blueprint generate --lang typescript
blueprint generate --module payments --lang go
blueprint generate --lang python --aliases blueprint.aliases.json5
blueprint generate --lang rust --obfuscate "project-secret"
```

---

## Contract structure

Each module contract has five sections:

```
Functions      -- function signatures with parameter names and types
Types          -- data structures consumed and returned by functions
Invariants     -- behavioural rules every implementation must uphold
System-level   -- consistency model, delivery guarantees, multi-region, observability
Dependencies   -- hard and soft dependencies on other modules
```

Example (`payments`):

```typescript
initiatePayment(order_id, amount, currency, method) → Payment
verifyPayment(payment_id) → Payment
creditWallet(user_id, amount, currency, reference) → WalletTransaction
```

```typescript
Payment { id, order_id, amount, currency, status, method, provider_reference, created_at }
PaymentStatus = pending | processing | completed | failed | refunded | disputed
```

---

## Adapters

83 adapters across 35 modules. Each adapter declares which contract functions it implements and which it explicitly does not -- omission is a CI error.

| Module | Adapters |
|---|---|
| payments | stripe, paystack, adyen |
| billing | stripe, paddle |
| subscriptions | stripe, chargebee |
| emails | resend, sendgrid, mailgun |
| sms | twilio, vonage |
| notifications | onesignal, firebase, novu |
| caching | redis, memcached |
| storage | s3, gcs, azure-blob |
| search | algolia, meilisearch, typesense |
| queues | bullmq, sqs, rabbitmq |
| auth | clerk, auth0, supertokens |
| kyc | jumio, onfido |
| analytics | segment, mixpanel, amplitude |
| fraud_detection | sift, riskified |
| error_tracking | sentry, bugsnag |
| incident_management | pagerduty, opsgenie |
| trace_query | jaeger, datadog, honeycomb |
| *and 18 more* | |

---

## MCP server -- 12 tools

The MCP server provides AI agents with direct access to the contract catalog. Compatible with Claude Desktop, Cursor, Copilot, and any MCP-compatible tool.

```json
{
  "mcpServers": {
    "blueprint": {
      "command": "npx",
      "args": ["engineering-blueprint", "mcp"]
    }
  }
}
```

| Tool | Description |
|---|---|
| `list_modules` | All 155 modules with function counts and deps |
| `get_module` | Full contract: functions, types, invariants, constraints |
| `search_modules` | Find modules by name, summary, or function |
| `resolve_deps` | Transitive dependency resolution |
| `list_adapters` | Available providers for a module |
| `get_adapter` | Adapter details and config requirements |
| `get_dependency_graph` | Hard deps, soft deps, reverse deps |
| `get_database_schema` | DDL for a module (PostgreSQL, MySQL, etc.) |
| `get_saga` | Full saga specification (checkout, refund, offboarding) |
| `get_distributed_patterns` | Recommended patterns (saga, outbox, optimistic locking) |
| `validate_implementation` | Check code against contract invariants |
| `suggest_modules` | Module suggestions from plain-English descriptions |

---

## Quality assurance

**Parser validation.** Contracts are structurally validated. `Functions` and `Types` are required sections. Missing sections produce hard errors.

**Adapter validation.** Every adapter is checked against its contract at load time. Functions not implemented and not explicitly exempted produce CI errors.

**Dependency resolution.** `blueprint resolve --modules billing` reveals the full transitive dependency graph before implementation begins.

**Inclusion rules.** A module belongs in the catalog if it is a named domain problem present across at least three application types, has a stable interface across providers, and is more than single-table CRUD.

---

## Security

The npm package ships compiled code and a pre-built catalog JSON only:

```
dist/             # compiled JS + catalog.min.json
schemas/          # JSON schemas
completions/      # shell completions
README.md, CHANGELOG.md, LICENSE
```

Raw contracts, adapter definitions, and source code remain in the repository and are excluded from the npm tarball.

Generated code can be protected with:

- **`--namespace <name>`** -- prefixes all generated identifiers with a project-specific name
- **`--aliases <file>`** -- replaces function, module, class, and config names via a JSON5 alias map
- **`--obfuscate <seed>`** -- replaces all names with deterministic hashes derived from a secret seed

`blueprint verify` supports `--aliases` and `--obfuscate` flags to reverse-map names during compliance checks.

---

## Sagas

Cross-module flows with step sequences, compensation logic, and failure modes:

| Saga | Modules |
|---|---|
| checkout | cart, orders, payments, inventory, notifications, fulfillment |
| refund | orders, payments, inventory, notifications, ledger |
| subscription_lifecycle | billing, payments, subscriptions, notifications |
| user_offboarding | users, billing, subscriptions, storage, right_to_erasure |
| dispute_resolution | payments, disputes, notifications, chargebacks, fraud_detection |

Database schemas and distributed patterns are defined for payments, billing, orders, and inventory.

---

## Project structure

```
engineering-blueprint/
├── contracts/              # 155 module contracts
│   └── core/               # Global standards, runtime rules
├── adapters/               # 83 adapter definitions (YAML)
├── sagas/                  # Cross-module saga specifications
├── src/
│   ├── core/               # Parser, resolver, graph, search, verifier
│   ├── generators/         # Code generators (5 languages)
│   ├── mcp/                # MCP server (12 tools)
│   └── cli/                # CLI commands and rendering
├── schemas/                # JSON Schema for catalog
├── completions/            # Bash and zsh completions
└── scripts/                # CI and build scripts
```

---

## Current status

| Check | Status |
|---|---|
| Module contracts | 155, zero parse errors |
| Adapters | 83 across 35 modules, zero validation errors |
| Tests | 204 passing across 29 suites |
| Languages supported | TypeScript, Python, Go, Rust, Java |
| MCP tools | 12 |
| CLI commands | 13 |

## Roadmap

v0.3.0 targets: C# generator, Kotlin generator, RAG index, `design_system` MCP tool, `compare_topologies` MCP tool, database schemas on all modules, distributed patterns on all qualifying modules.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add contracts, adapters, and generators.

To report a security vulnerability, see [SECURITY.md](SECURITY.md).

Our community standards are documented in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

*Version 0.2.0*
