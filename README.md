# Blueprint: 162 Backend Contracts, 5 Languages, 83 Adapters, 12 MCP Tools

**Open source. MIT. No ambiguity.**

---

Every backend system needs payments, auth, notifications, caching, and queues. Every team builds them from scratch. Every time, the interface is slightly different. Every time, switching providers means rewriting code.

Blueprint is a catalog of 162 backend domain contracts. Each contract defines what a module does, what types it uses, what invariants it enforces, and what it depends on. The same contract works across all providers and generates code in 5 languages.

---

## What a contract looks like

A contract is a markdown file with a strict structure. Here is the `payments` contract:

```typescript
// Functions
initiatePayment(order_id, amount, currency, method) → Payment
verifyPayment(payment_id) → Payment
getWallet(user_id) → Wallet
creditWallet(user_id, amount, currency, reference) → WalletTransaction
debitWallet(user_id, amount, currency, reference) → WalletTransaction
initiateRefund(payment_id, amount?, reason) → Refund

// Types
Payment { id, order_id, amount, currency, status, method, provider_reference, created_at }
PaymentStatus = pending | processing | completed | failed | refunded | disputed

// Invariants
- creditWallet with the same reference must be idempotent
- debitWallet must not reduce balance below zero unless allow_negative: true
```

Every function has a type. Every type has fields. Every invariant is a hard rule. The parser rejects vague or incomplete contracts.

---

## What the dependency graph looks like

Blueprint's resolver walks the full transitive graph. Selecting one module reveals the true cost:

```
billing *
├── payments (hard)
│   ├── audit_log (soft)
│   ├── fraud_detection (soft)
│   └── notifications (soft)
├── users (hard)
├── notifications (soft)
├── audit_log (soft)
└── usage_metering (soft)
```

This runs before you write any code. If the dependency chain is too expensive for what you need, you know immediately.

---

## What generated code looks like

One contract, five languages. Here is the TypeScript output for `payments`:

```typescript
// generated/interfaces/payments.ts
export interface PaymentsContract {
  initiatePayment(orderId: string, amount: number, currency: string,
    method: PaymentMethod, idempotencyKey?: string): Promise<Payment>;
  verifyPayment(paymentId: string): Promise<Payment>;
  getWallet(userId: string): Promise<Wallet>;
  creditWallet(userId: string, amount: number, currency: string,
    reference: string): Promise<WalletTransaction>;
  debitWallet(userId: string, amount: number, currency: string,
    reference: string): Promise<WalletTransaction>;
  initiateRefund(paymentId: string, amount?: number,
    reason: string, idempotencyKey?: string): Promise<Refund>;
}
```

Python output:

```python
@dataclass
class Payment:
    id: str
    order_id: str
    amount: int
    currency: str
    status: PaymentStatus
    method: PaymentMethod
    provider_reference: Optional[str]
    created_at: datetime

class PaymentsContract(ABC):
    @abstractmethod
    async def initiate_payment(...): ...
    @abstractmethod
    async def verify_payment(...): ...
```

Go output generates interfaces with sentinel errors. Rust generates `#[async_trait]` traits. Java generates `CompletableFuture` interfaces with JUnit tests.

---

## What an AI agent can do with the MCP server

The MCP server exposes 12 tools over stdio. Connect any MCP-compatible AI tool (Claude Desktop, Cursor, Copilot) and add this configuration:

```json
{
  "mcpServers": {
    "blueprint": {
      "command": "npx",
      "args": ["@friehub/blueprint", "mcp"]
    }
  }
}
```

An agent with access to Blueprint can:

**Design a system:**
> "I need a checkout flow with fraud detection."

The agent calls `suggest_modules` to get the module list, `resolve_deps` to understand the dependency graph, `get_saga` to see the checkout flow, and `list_adapters` to find available providers.

**Implement a module:**
> "Implement payments with Stripe."

The agent calls `get_module` to read the full contract, `get_adapter` to get Stripe-specific config, and `get_database_schema` for the DDL.

**Validate generated code:**
> "Check my payments code against the contract."

The agent calls `validate_implementation` with a code summary and receives invariant violations to fix. Supports aliases and obfuscation for reverse-mapping.

---

## Name protection

Generated code uses generic names like `PaymentsContract` and `StripeAdapter` by default. For production use:

```bash
# Prefix all names with a project identifier
blueprint generate --lang go --namespace acme
# Produces: Acme_PaymentsService, Acme_StripeAdapter

# Replace names entirely via an alias file
blueprint generate --lang python --aliases blueprint.aliases.json5
# initiatePayment → chargeCustomer, StripeAdapter → CardProcessor

# Obfuscate with a deterministic seed hash
blueprint generate --lang rust --obfuscate "project-secret"
# All names become opaque hashes: fn_a1b2c3d4
```

---

## What ships in the npm package

The npm package contains only compiled code and a stripped catalog:

- **51 files, 62KB compressed, 338KB unpacked**
- No raw contract markdown
- No function signatures or invariants in the shipped catalog
- SHA-256 hash verified on CLI startup
- Namespace, aliasing, and obfuscation for generated code

---

## Quick start

```bash
npm install -g @friehub/blueprint

# Browse the catalog
blueprint list
blueprint inspect payments
blueprint graph billing

# Select providers and generate code
blueprint adapters add stripe payments
blueprint adapters add redis caching
blueprint generate --lang typescript
blueprint generate --lang go --namespace acme

# Verify your implementation
blueprint verify ./src/payments/stripe.ts --module payments

# Start the MCP server for AI agents
blueprint mcp
```

---

## Stats

| Metric | Value |
|---|---|
| Module contracts | 162 |
| Core standards | 3 |
| Provider adapters | 83 |
| Modules with adapters | 35 |
| Code generators | TypeScript, Python, Go, Rust, Java |
| MCP tools | 12 |
| Tests | 201 passing, 29 suites |
| Package size | 62KB compressed, 51 files |
| License | MIT |

---

## Roadmap

**v0.3.0:**
- C# and Kotlin generators
- RAG index for inference-time retrieval
- `design_system` MCP tool (architecture decision engine)
- `compare_topologies` MCP tool (monolith vs microservices vs cell-based analysis)
- Database schemas on all 162 modules
- Distributed patterns on all qualifying modules

---

## Links

- **npm**: `npm install @friehub/blueprint`
- **Docs**: [blueprint.friehub.cloud](https://blueprint.friehub.cloud)
- **GitHub**: [github.com/Friehub/blueprint](https://github.com/Friehub/blueprint)
- **License**: MIT
