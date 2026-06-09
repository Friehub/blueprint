# Engineering Blueprinter

**Backend contracts that stick. For people who build things and the AI that helps them.**

Every backend system is made of the same puzzles: payments, notifications, auth, caching, queues. You solve them differently each time, but the shape of the problem stays the same. Stripe and Paystack both process payments. Twilio and Vonage both send texts. Redis and Memcached both cache things.

Blueprint captures that shape. It defines what `initiatePayment` must guarantee, what errors it can throw, and how it behaves under load -- once, in one place, so you (or your AI agent) never have to guess.

**155 modules. 83 adapters. 5 languages. No ambiguity.**

---

## What this actually looks like

A contract is just markdown with a strict structure. Here is what a module file contains:

```
Functions      -- what you can call, with types
Types          -- the data structures that move through those functions
Invariants     -- rules every implementation must follow, no exceptions
System-level   -- consistency, delivery guarantees, multi-region, observability
Dependencies   -- what else must be in the room for this module to work
```

Example. The `payments` contract says:

```typescript
initiatePayment(order_id, amount, currency, method) → Payment
verifyPayment(payment_id) → Payment
creditWallet(user_id, amount, currency, reference) → WalletTransaction
```

```typescript
Payment { id, order_id, amount, currency, status, method, provider_reference, created_at }
PaymentStatus = pending | processing | completed | failed | refunded | disputed
```

Every function has a type. Every type has fields. Every invariant is a hard rule. The parser enforces this, so you cannot slip in vague prose and call it a contract.

---

## Why this exists

An AI agent asked to build a payments feature has no reference for what `initiatePayment` must do. It guesses. Sometimes it guesses well, sometimes it reaches for Stripe-specific patterns that break on Paystack, and sometimes it quietly drops error handling because nobody told it the provider can go down.

A senior engineer knows these things. They have the mental model. But they cannot be in every PR, every code review, every pair programming session.

Blueprint puts that mental model into structured files that machines read reliably and humans extend predictably. It is the senior engineer's knowledge, captured.

---

## How the pieces fit together

```
contracts/*.md          adapters/*/*.yaml       sagas/*.md
      |                      |                    |
  [parser]               [loader]             [MCP tools]
      |                      |                    |
      +----------+-----------+--------------------+
                 |
           [catalog]  <-- everything resolved, typed, ready
                 |
      +----+-----+-----+------+------+
      |    |     |     |      |      |
   [gen] [MCP] [CLI] [verify] [saga] [schema]
```

Contracts go in. A typed catalog comes out. From there you generate code in 5 languages, query it through an MCP server, resolve dependencies, and verify implementations. All from the same source of truth.

---

## Getting started

```bash
npm install -g engineering-blueprint
```

Take the tour:

```bash
blueprint list                          # see all 155 modules
blueprint inspect payments              # read the full contract
blueprint graph billing                 # see what billing needs
blueprint search "checkout flow"        # find relevant modules
```

Pick your providers and generate code:

```bash
blueprint adapters add stripe payments
blueprint adapters add redis caching
blueprint generate --lang python
blueprint generate --module billing --lang go
```

Wire it into your project:

```typescript
import { loadCatalogFromRoot } from 'engineering-blueprint';

const catalog = await loadCatalogFromRoot('./contracts');
const billing = catalog.modules.find(m => m.name === 'billing');
console.log(billing?.functions.map(f => f.signature));
```

Full CLI reference:

| Command | What it does |
|---|---|
| `build` | Parse contracts, write catalog.json |
| `list` | All modules with dep counts |
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
| `mcp` | Start the MCP server for AI tools |

Flags: `--root`, `--strict`, `--output`, `--compact`, `--minimal`, `--quiet`, `--format ascii|mermaid`, `--lang typescript|python|go|rust|java`, `--module`, `--modules`, `--name`

---

## Code generation in 5 languages

Each generator produces three things: a typed interface, an adapter skeleton, and a conformance test. The interface is what you code against. The adapter skeleton wires it to a real provider. The test proves it works.

```bash
blueprint generate --lang typescript
blueprint generate --module payments --lang typescript
blueprint generate --lang go --namespace acme   # prefixes names with Acme_
```

| Language | Interface | Adapter | Test |
|---|---|---|---|
| TypeScript | `interface` | SDK hint or TODO stub | Jest / node:test |
| Python | `ABC` with `@abstractmethod` | Class that implements it | pytest |
| Go | `interface` with sentinel errors | Struct with constructor | `testing` |
| Rust | `#[async_trait]` trait | Struct with `new()` | `#[cfg(test)]` |
| Java | `interface` with `CompletableFuture` | Class that implements it | JUnit 5 |

---

## Adapters: the bridge between contract and provider

83 adapters across 35 modules. Every adapter says exactly which functions it implements and which it does not. If it leaves one out without saying so, CI fails. Silence is not consent.

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

```bash
blueprint adapters list
blueprint adapters add stripe payments
blueprint adapters verify
```

---

## MCP server: 12 tools for AI agents

If your AI tool speaks MCP, it can query Blueprint directly. Add this to your Claude Desktop, Cursor, or Copilot config:

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

Then your agent gets access to:

| Tool | What it gives you |
|---|---|
| `list_modules` | All 155 modules with function counts and deps |
| `get_module` | Full contract: functions, types, invariants, constraints |
| `search_modules` | Find modules by name, summary, or function |
| `resolve_deps` | See every module you will need |
| `list_adapters` | What providers exist for a module |
| `get_adapter` | Adapter details + config requirements |
| `get_dependency_graph` | Hard deps, soft deps, reverse deps |
| `get_database_schema` | DDL for a module (PostgreSQL, etc.) |
| `get_saga` | Full flow spec for checkout, refund, offboarding |
| `get_distributed_patterns` | Saga, outbox, optimistic locking recommendations |
| `validate_implementation` | Check code against contract invariants |
| `suggest_modules` | "I want to build X" -- tells you where to start |

Start manually: `blueprint mcp` or `BLUEPRINTER_ROOT=/path/to/project blueprint mcp`

---

## Sagas that cross module boundaries

Some flows touch many modules. A checkout touches cart, orders, payments, inventory, notifications, and fulfillment. These are defined as sagas with step-by-step sequences, compensation logic, and failure modes.

| Saga | What it involves |
|---|---|
| checkout | cart, orders, payments, inventory, notifications, fulfillment |
| refund | orders, payments, inventory, notifications, ledger |
| subscription_lifecycle | billing, payments, subscriptions, notifications |
| user_offboarding | users, billing, subscriptions, storage, right_to_erasure |
| dispute_resolution | payments, disputes, notifications, chargebacks, fraud_detection |

For core financial modules (payments, billing, orders, inventory), we also ship database schemas and distributed patterns -- the DDL, the indexes, the optimistic locking strategy, the outbox table. Query them with the MCP tools.

---

## The quality gates (why you can trust this)

Four mechanisms keep the catalog honest.

**The parser is strict.** `Functions` and `Types` are required. A contract missing either one is rejected. You cannot write a vague contract. The structure forces specificity.

**Adapters mirror contracts.** Every adapter is checked against its contract. A function in the contract that the adapter neither implements nor explicitly exempts is a CI error. Adding a function to a contract means you owe coverage across every adapter for that module. You see the cost before merging.

**Dependencies are transparent.** `blueprint resolve --modules billing` shows you that billing depends on payments, users, notifications, audit_log, and usage_metering. You see the full price tag before you commit.

**The inclusion rule filters noise.** A module belongs here only if it is a named domain problem, recurs across 3+ application types, has a stable interface across providers, and is more than single-table CRUD. Every proposed module is judged against this before the PR is opened.

---

## What this is not

| If you are looking for | Blueprint is different because |
|---|---|
| OpenAPI / Swagger | This describes domain modules, not HTTP endpoints. Contracts work over any transport. |
| LangChain tools | This is what your tools should implement. The contract comes first. |
| ORM / Prisma schema | This defines behaviour, not storage. Schema is an addition, not the core. |
| Pasting markdown to an LLM | This is structured data with typed inference, dep resolution, and code gen. |

---

## Security: what ships and what does not

The npm package (`@friehub/blueprint`) ships only compiled code and a pre-built catalog JSON:

```
dist/             # compiled JS + catalog.json
schemas/          # JSON schemas
completions/      # shell completions
README.md, CHANGELOG.md, LICENSE
```

**Not included:** `contracts/`, `adapters/`, `sagas/`, `src/` -- these stay in the repo and are not in the npm tarball.

Code generation works without the raw contracts because `npm run build` compiles them into `dist/catalog.json` during release. The CLI loads from the catalog when contracts are not present.

To avoid generic names in generated code, pass `--namespace`:

```bash
blueprint generate --lang go --namespace acme
# generates: Acme_PaymentsService, Acme_StripeAdapter, acme_initiatePayment()
```

---

## Project structure

```
engineering-blueprint/
├── contracts/              # 155 module contracts (markdown)
│   └── core/               # Global standards, runtime rules
├── adapters/               # 83 adapter definitions (YAML)
├── sagas/                  # Cross-module flow specifications
├── src/
│   ├── core/               # Parser, resolver, graph, search, verifier
│   ├── generators/         # Code gen: typescript, python, go, rust, java
│   ├── mcp/                # MCP server (12 tools)
│   └── cli/                # CLI commands and rendering
├── generated/              # Output of blueprint generate
├── schemas/                # JSON Schema for catalog
├── completions/            # Bash and zsh completions
└── scripts/                # CI integration tests
```

---

## What shape is this in

| Check | Status |
|---|---|
| Module contracts | 155, zero parse errors |
| Adapters | 83 across 35 modules, zero issues |
| Tests | 180 passing across 28 suites |
| Edge cases | Generator edge cases, MCP unhappy paths, parser malformed input, cycle detection, 50-module dep chains |
| Languages | TypeScript, Python, Go, Rust, Java (all ship-ready) |
| MCP tools | 12 |
| Security | Contracts excluded from npm package, compiled catalog only. Namespace prefix for generated code. |

**Roadmap: v0.3.0.** C# generator, Kotlin generator, full RAG index, `design_system` MCP tool, `compare_topologies` MCP tool, database schemas on all 155 modules, distributed patterns on all qualifying modules.

---

## The boundary (expanded)

A module belongs in this catalog if:

1. **It is a named domain problem.** Payments, not database transactions. Notifications, not message queues. The name tells you what it does.
2. **It recurs across at least three different application types.** SaaS billing and e-commerce checkout both need payments. Social apps and support tools both need messaging. If only one kind of system needs it, it does not go here.
3. **Its interface is stable across providers.** Stripe, Adyen, and Paystack all let you initiate a payment, verify it, and refund it. The interface is the same even though the SDK calls are different.
4. **It is more than single-table CRUD.** If all it does is read and write one table, it belongs in your application code, not in a reusable contract catalog.

The catalog says *what* your system does. The generators give you the starting point. Adapters let you switch providers without rewriting interfaces. The business logic is yours to write.

If a module does not pass all four conditions, it does not belong here. No exceptions.

---

## Want to contribute?

Open a PR with a contract `.md` file that passes the four inclusion rules. Your PR should also include or explain the absence of adapter definitions for at least one provider. The parser runs in CI and rejects malformed contracts.

If you are not sure whether something belongs, open an issue first and we will walk through the inclusion rules together.

**Before committing, run the pre-check:**

```bash
bash scripts/pre-commit.sh
```

This compiles TypeScript with strict mode, builds the dist + compiled catalog, runs all 180 tests, verifies the catalog loads without errors, smoke-tests code generation in all 5 languages, and validates adapter language declarations. Any failure stops the commit.

If you are adding a new adapter, include a `languages` field in the YAML to declare which languages it supports:

```yaml
name: my_provider
module: payments
languages: [typescript, python, go]
```

If omitted, the adapter defaults to all 5 languages. The generators skip adapters that do not declare support for the target language.

---

*Version 0.1.0*
