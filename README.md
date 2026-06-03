# Engineering Blueprinter

## A Provider-Agnostic Interface Specification for AI-Assisted Backend Development

Every backend system is an assembly of recurring domain problems: payments, notifications, auth, caching. The implementations differ. The interface does not.

This catalogue defines those interfaces -- function signatures, types, and error contracts for 108 backend domain modules. Each contract is:

- **Provider-agnostic** -- Stripe, Twilio, or S3. Pick any
- **Language-portable** -- TypeScript types, Rust traits, Python protocols, Go interfaces
- **AI-consumable** -- no ambiguous prose, just structured data
- **Versioned** -- semver discipline, adapters declare compatible versions

---

## Why Blueprinter?

| Task | Raw Markdown | Blueprinter |
|---|---|---|
| Get module contract | Read 108 `.md` files, parse `→` by eye | `loadCatalog()`, 1 call |
| Parameter types | Guess from context | `order_id: string`, `amount: number` inferred |
| Dependencies | Scan prose for "Depends On" | `hardDeps: ["payments", "users"]` resolved |
| Transitive deps | Trace manually across files | `resolve(["billing"])` walks entire graph |
| Available providers | Search for "Providers" section | `adapters list payments` shows 3 options |
| Write types | Manually from scratch | Generated interfaces with full SDK code |
| Verify completeness | Hope you didn't miss a function | `verify` says "10/10" or "missing: X" |
| Feed to AI | Paste markdown, hope it parses correctly | `mcp` server, 7 tools, typed JSON over stdio |
| Project scaffold | Create package.json, tsconfig, dirs | `prototype` generates complete structure |

---

## Quick Start

```bash
npm install -g engineering-blueprinter
blueprinter list
blueprinter inspect billing
blueprinter graph billing
blueprinter resolve --modules billing,payments,users
```

Or import as a library:

```typescript
import { loadCatalogFromRoot } from 'engineering-blueprinter';
const catalog = await loadCatalogFromRoot('./contracts');
```

---

## CLI Reference

### Commands

| Command | Description |
|---|---|
| `build` | Load contracts, output catalog.json |
| `list` | List all modules with deps and adapter status |
| `search <query>` | Interactive module picker |
| `inspect <module>` | Full contract for a module |
| `graph <module>` | ASCII or Mermaid dependency graph |
| `resolve` | Resolve modules with transitive deps |
| `adapters` | Manage adapter selections (83 adapters, 35 modules) |
| `generate` | Generate TypeScript code from contracts |
| `prototype` | Generate project scaffold with dependencies |
| `schema` | Export catalog as JSON Schema |
| `verify <file>` | Check implementation against contract |
| `implement` | Generate AI prompts for implementation |
| `mcp` | Start MCP server for AI tools |

### Flags

`--root`, `--strict`, `--output`, `--compact`, `--minimal`, `--quiet`, `--format <ascii|mermaid>`, `--lang <typescript|rust|python|go>`, `--module`, `--modules`, `--name`

---

## Adapter Registry

33 modules with 83 adapters. Bridge between contracts and concrete providers:

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
| *and 17 more modules* | |

```bash
blueprinter adapters list
blueprinter adapters add stripe payments
blueprinter adapters verify
```

---

## Code Generation

Generates TypeScript interfaces, adapter skeletons, and conformance tests from contracts:

```bash
blueprinter generate --lang typescript
blueprinter generate --module billing --lang typescript
```

Output for payments module:

```typescript
// generated/interfaces/payments.ts
export interface PaymentsContract {
  initiatePayment(orderId: string, amount: number, currency: string, method: string): Promise<Payment>;
  verifyPayment(paymentId: string): Promise<Payment>;
  getWallet(userId: string): Promise<Wallet>;
  // ... 10 functions with inferred types
}

// generated/adapters/payments/stripe.ts
import Stripe from 'stripe';

export class StripeAdapter implements PaymentsContract {
  async initiatePayment(orderId: string, amount: number, currency: string, method: string): Promise<Payment> {
    const paymentIntent = await this.stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      payment_method: method,
      metadata: { orderId },
    });
    return this.toPayment(paymentIntent);
  }
  // ... full SDK implementations
}
```

Languages supported: TypeScript (full), Rust/Go/Python (planned).

---

## Prototype Generation

Generate a project scaffold with selected adapters and correct dependencies:

```bash
blueprinter adapters add stripe payments
blueprinter adapters add redis caching
blueprinter adapters add bullmq queues
blueprinter prototype --name my-saas
```

Produces:
- `package.json` with stripe, redis, bullmq dependencies
- `tsconfig.json`, `.gitignore`, `.env.example`
- `src/config/adapters.ts` with working configuration
- `src/index.ts` with entry point and function list

---

## MCP Server

AI tools (Claude Desktop, Cursor, Copilot) can query the catalog directly via the Model Context Protocol.

**Configuration** -- add to Claude Desktop config:

```json
{
  "mcpServers": {
    "blueprinter": {
      "command": "npx",
      "args": ["engineering-blueprinter", "mcp"]
    }
  }
}
```

**7 tools exposed:**

| Tool | What it does |
|---|---|
| `list_modules` | List all 108 modules with deps |
| `get_module` | Full contract with functions, types |
| `search_modules` | Search by name, summary, function |
| `resolve_deps` | Transitive dependency resolution |
| `list_adapters` | 83 adapters across 35 modules |
| `get_adapter` | Adapter details with config |
| `get_dependency_graph` | Hard/soft deps + reverse deps |

**Start manually:**
```bash
blueprinter mcp
# or with a specific root:
BLUEPRINTER_ROOT=/path/to/project blueprinter mcp
```

---

## Project Structure

```
engineering-blueprinter/
├── contracts/              # 108 markdown contract files
│   └── core/               # Global standards, runtime, sagas
├── adapters/               # 83 YAML adapter definitions
├── src/
│   ├── core/               # Parser, resolver, search, adapters
│   ├── generators/         # Code generation engine
│   ├── cli.ts              # CLI entrypoint (68 lines)
│   └── utils/              # Argument parsing
├── schemas/                # JSON schemas
├── completions/            # Bash/zsh completions
└── scripts/                # CI integration tests
```

---

## Verification

Check that implementations match contracts:

```bash
blueprinter verify ./src/adapters/payments/stripe.ts --module payments
# All 10 functions implemented. PASS
```

---

## Production Status

| Check | Result |
|---|---|
| 108 contracts parsed | 0 errors, 0 warnings |
| 83 adapters loaded | 0 errors |
| Adapter validation | 0 errors, 0 warnings |
| Tests | 91 passing (58 unit + 25 integration + 8 MCP) |
| Edge cases | 33 tests covering malformed input, empty state, 50-module chains |
| CI (Node 18/20/22) | Passing |
| MCP server | 7 tools, stdio transport |
| npm publish | On GitHub release |

---

## The Boundary

A module belongs here if:

1. It is a named domain problem (payments, not database transactions)
2. It recurs across at least three different application types
3. Its interface is stable across providers
4. It cannot be trivially derived from a single-table CRUD

The catalogue defines *what* your system does. The prototype generator produces the project structure (*how* you start). Adapter implementations and business logic are yours to write.

---

*Version 0.1.0 -- Production Ready*
