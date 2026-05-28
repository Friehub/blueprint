# Multi-Language Code Generation -- Design Document

## Problem

Contracts are written in markdown. Adapters are declared in YAML. Users still need to write actual implementation code in their target language. Without code generation:

- Users manually translate markdown signatures to TypeScript/Rust/Python
- Interface drift happens when contracts change
- No type safety between contract and implementation
- Adapter skeletons are written from scratch each time

Code generation closes the loop: Contract → Generated Interface → User Implements → Verified Against Contract

---

## Architecture

```
contracts/*.md
    ↓
[parser] → catalog.json
    ↓
[code generator] → language-specific output
    ↓
TypeScript interfaces, Rust traits, Python protocols, Go interfaces
```

### Generator as Plugin System

Each language is a generator plugin:

```
src/generators/
├── typescript/
│   ├── index.ts          # Generator entry point
│   ├── interfaces.ts     # Generate interfaces from contracts
│   ├── adapters.ts       # Generate adapter skeletons
│   ├── tests.ts          # Generate conformance tests
│   └── templates/        # Code templates
├── rust/
│   ├── index.ts
│   ├── traits.rs.template
│   └── ...
├── python/
│   ├── index.ts
│   ├── protocols.py.template
│   └── ...
└── go/
    ├── index.ts
    ├── interfaces.go.template
    └── ...
```

---

## What Gets Generated

### 1. Contract Interfaces

From `contracts/payments.md`:

```markdown
## Functions
initiatePayment(amount, currency, method) → Payment
refundPayment(payment_id, amount?) → Refund
getPaymentStatus(payment_id) → PaymentStatus
```

Generate TypeScript:

```typescript
// generated/interfaces/payments.ts

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
}

export type PaymentStatus = "pending" | "processing" | "completed" | "failed" | "refunded";

export interface PaymentsContract {
  initiatePayment(amount: number, currency: string, method: string): Promise<Payment>;
  refundPayment(paymentId: string, amount?: number): Promise<Refund>;
  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
}
```

Generate Rust:

```rust
// generated/src/payments.rs

#[async_trait]
pub trait PaymentsContract {
    async fn initiate_payment(&self, amount: f64, currency: &str, method: &str) -> Result<Payment, Error>;
    async fn refund_payment(&self, payment_id: &str, amount: Option<f64>) -> Result<Refund, Error>;
    async fn get_payment_status(&self, payment_id: &str) -> Result<PaymentStatus, Error>;
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payment {
    pub id: String,
    pub amount: f64,
    pub currency: String,
    pub status: PaymentStatus,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PaymentStatus {
    Pending,
    Processing,
    Completed,
    Failed,
    Refunded,
}
```

Generate Python:

```python
# generated/payments.py

from typing import Protocol, Optional
from dataclasses import dataclass
from enum import Enum

class PaymentStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

@dataclass
class Payment:
    id: str
    amount: float
    currency: str
    status: PaymentStatus
    created_at: str

class PaymentsContract(Protocol):
    async def initiate_payment(self, amount: float, currency: str, method: str) -> Payment: ...
    async def refund_payment(self, payment_id: str, amount: Optional[float] = None) -> Refund: ...
    async def get_payment_status(self, payment_id: str) -> PaymentStatus: ...
```

### 2. Adapter Skeletons

From `adapters/payments/stripe.yaml`:

```yaml
name: stripe
module: payments
implements:
  - initiatePayment
  - refundPayment
  - getPaymentStatus
```

Generate TypeScript:

```typescript
// generated/adapters/payments/stripe.ts

import type { PaymentsContract, Payment, PaymentStatus } from '../interfaces/payments';

export class StripeAdapter implements PaymentsContract {
  constructor(private config: { apiKey: string; webhookSecret: string }) {}

  async initiatePayment(amount: number, currency: string, method: string): Promise<Payment> {
    // TODO: Implement with Stripe SDK
    throw new Error('Not implemented');
  }

  async refundPayment(paymentId: string, amount?: number): Promise<Refund> {
    // TODO: Implement with Stripe SDK
    throw new Error('Not implemented');
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    // TODO: Implement with Stripe SDK
    throw new Error('Not implemented');
  }
}
```

### 3. Conformance Tests

```typescript
// generated/__tests__/payments-stripe.test.ts

import { StripeAdapter } from '../adapters/payments/stripe';
import type { PaymentsContract } from '../interfaces/payments';

describe('StripeAdapter implements PaymentsContract', () => {
  const adapter: PaymentsContract = new StripeAdapter({
    apiKey: 'test',
    webhookSecret: 'test'
  });

  it('has initiatePayment method', () => {
    expect(typeof adapter.initiatePayment).toBe('function');
  });

  it('has refundPayment method', () => {
    expect(typeof adapter.refundPayment).toBe('function');
  });

  it('has getPaymentStatus method', () => {
    expect(typeof adapter.getPaymentStatus).toBe('function');
  });
});
```

---

## CLI Commands

### Generate All

```bash
blueprinter generate --lang typescript
```

### Generate Interfaces Only

```bash
blueprinter generate interfaces --lang typescript
blueprinter generate interfaces --lang rust
blueprinter generate interfaces --lang python
```

### Generate Adapter Skeleton

```bash
blueprinter generate adapter stripe payments --lang typescript
blueprinter generate adapter stripe payments --lang rust
```

### Generate Conformance Tests

```bash
blueprinter generate tests stripe payments --lang typescript
```

---

## Language Support

| Language | Interfaces | Adapters | Tests | Status |
|----------|-----------|----------|-------|--------|
| TypeScript | Yes | Yes | Yes | Priority 1 |
| Rust | Yes | Yes | No | Priority 2 |
| Python | Yes | Yes | No | Priority 3 |
| Go | Yes | Yes | No | Priority 4 |

---

## Template System

Each language uses templates for consistent output:

```
src/generators/typescript/templates/
├── interface.hbs          # Handlebars template for interfaces
├── adapter.hbs            # Handlebars template for adapters
├── test.hbs               # Handlebars template for tests
└── index.ts               # Template loader
```

Template example:

```handlebars
// generated/interfaces/{{module}}.ts

{{#each types}}
export interface {{name}} {
  {{#each fields}}
  {{name}}: {{type}};
  {{/each}}
}
{{/each}}

export interface {{pascalCase module}}Contract {
  {{#each functions}}
  {{name}}({{params}}): Promise<{{returns}}>;
  {{/each}}
}
```

---

## Type Mapping

| Contract Type | TypeScript | Rust | Python | Go |
|---------------|-----------|------|--------|-----|
| string | string | String | str | string |
| number | number | f64 | float | float64 |
| boolean | boolean | bool | bool | bool |
| null | null | Option::None | None | nil |
| T[] | T[] | Vec\<T\> | list[T] | []T |
| T? | T \| undefined | Option\<T\> | Optional[T] | *T |
| Record | Record\<K,V\> | HashMap\<K,V\> | dict[K,V] | map[K]V |

---

## Implementation Order

1. **TypeScript generator** -- most users, fastest value
2. **Rust generator** -- systems programming, WebAssembly
3. **Python generator** -- data science, ML pipelines
4. **Go generator** -- cloud infrastructure, microservices

---

## Open Questions

1. **Should generated code be committed or gitignored?**
   - Commit: version control, CI/CD integration
   - Gitignore: no merge conflicts, always fresh
   - Recommendation: Commit with CI check that regenerates and diffs

2. **How to handle custom types?**
   - Some contracts define complex types (e.g., `PaginatedResult<T>`)
   - Need language-specific mappings for generic types
   - Recommendation: Define type mappings in generator config

3. **How to handle errors?**
   - Contracts define error codes, languages handle errors differently
   - TypeScript: custom error classes
   - Rust: Result\<T, Error\> with error enum
   - Python: custom exceptions
   - Go: error interface
   - Recommendation: Generate error types per language

4. **How to handle events?**
   - Contracts define event types
   - Need to generate event handlers/callbacks
   - Recommendation: Generate event type definitions, leave handler implementation to user

---

## Summary

Code generation closes the loop between contracts and implementations:

| Layer | What It Does |
|-------|--------------|
| Contract | Defines the interface in markdown |
| Parser | Extracts functions, types, invariants |
| Generator | Produces language-specific code |
| User | Implements the generated interface |
| Verifier | Checks implementation matches contract |

This ensures type safety, reduces boilerplate, and prevents interface drift.
