# Blueprint: 183 Backend Contracts, 7 Languages, 183 Adapters, 20 MCP Tools

**Open source. MIT. No ambiguity.**

---

Every backend system needs payments, auth, notifications, caching, and queues. Every team builds them from scratch. Every time, the interface is slightly different. Every time, switching providers means rewriting code.

Blueprint is a catalog of 183 backend domain contracts. Each contract defines what a module does, what types it uses, what invariants it enforces, and what it depends on. The same contract works across all providers and generates code in 7 languages.

---

## What a contract looks like

A contract is a markdown file with a strict structure. Every contract includes Functions, Types, Invariants, Event Emissions, Database Schema, Observability, Distributed Patterns, Failure Modes, and Breaking Change Policy.

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

---

## What generated code looks like

One contract, 7 languages. Here is the TypeScript output for `payments`:

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

Python, Go, Rust, Java, C#, and PHP generators produce the same contract in their native idioms.

---

## Stats

| Metric | Value |
|---|---|
| Module contracts | 183 |
| Core standards | 3 |
| Provider adapters | 183 |
| Code generators | TypeScript, Python, Go, Rust, Java, C#, PHP |
| MCP tools | 20 |
| Sagas | 10 |
| Languages | 7 |
| License | MIT |

---

## Quick start

```bash
npm install -g @friehub/blueprint

# Browse the catalog
blueprint list
blueprint inspect payments
blueprint graph billing

# Select providers and generate code
blueprint generate --lang typescript
blueprint generate --lang go --namespace acme

# Start the MCP server for AI agents
blueprint mcp
```

---

## MCP Tools

Blueprint ships 20 MCP tools for AI agents:

| Tool | Description |
|---|---|
| `list_modules` | List all contracts |
| `get_module` | Full contract for one module |
| `search_modules` | Search by name/function |
| `resolve_deps` | Transitive dependency graph |
| `list_adapters` | Available adapters |
| `get_adapter` | Adapter config and details |
| `get_dependency_graph` | Dep tree (ASCII/Mermaid) |
| `get_database_schema` | PostgreSQL/MongoDB DDL |
| `get_saga` | Saga flow specification |
| `get_distributed_patterns` | Saga/outbox/idempotency patterns |
| `get_entity_model` | Entity relationships |
| `design_system` | Full architecture from description |
| `validate_implementation` | Check code against invariants |
| `suggest_modules` | Modules from plain-English description |
| `generate_openapi` | OpenAPI 3.1 spec (2 module limit) |
| `compare_modules` | Module relationship analysis |
| `explain_invariant` | Invariant explanation with examples |
| `generate_seed_data` | Realistic seed data generation |
| `get_implementation_order` | Dependency-based ordering |
| `get_test_cases` | Contract conformance tests (2/module limit) |

---

## Links

- **npm**: `npm install @friehub/blueprint`
- **GitHub**: [github.com/Friehub/blueprint](https://github.com/Friehub/blueprint)
- **License**: MIT
