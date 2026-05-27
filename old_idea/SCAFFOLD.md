# Code Scaffold Specification
## What Gets Generated, What Does Not, and Why

> The scaffold is the final, optional output of the pipeline. It exists to
> translate the verified engineering specification into language-specific
> structural stubs that enforce the design as a compiler constraint.
>
> The scaffold is NOT a code generator. It does not implement logic.
> Its purpose is to make it impossible to accidentally violate the
> engineering spec while writing the actual implementation.

---

## The Core Rule

**The scaffold encodes invariants as compiler-enforced contracts.**

If the spec says "every payment mutation requires an idempotency key,"
the scaffold expresses this as a function signature where `idempotency_key`
is a required, non-optional parameter — not a comment, not a docstring.
A developer who tries to call the function without the key gets a
compile error, not a code review comment.

This is the entire value of the scaffold layer. If your scaffold does not
enforce invariants at the type level, it is just documentation with worse
readability.

---

## What the Scaffold Contains

| Included | Not Included |
|----------|--------------|
| Module/package structure | Business logic |
| Type definitions and interfaces | Algorithm implementations |
| Function signatures with typed parameters | Database queries |
| Error type definitions | Network calls |
| Trait/interface definitions | Validation logic |
| TODO markers with spec references | Tests |
| Invariant assertions as type constraints | Configuration |

The TODO markers are not generic `// TODO: implement`. They are structured:

```rust
// SPEC[FR-003, INV-002]: Deduct sender balance atomically.
// Required pattern: ATOMIC_LEDGER_ENTRY (pessimistic locking).
// Failure modes addressed: FM-001, FM-002.
// Algorithm: PIPELINE.md § Pass 4, Algorithm: "Initiate Payment Transfer".
// Steps 4–11 of the algorithm must be implemented in this function body.
todo!("Implement per PIPELINE.md § Pass 4 — Initiate Payment Transfer")
```

This links every unimplemented function directly back to the exact section
of the specification it must satisfy.

---

## Scaffold Generation Rules Per Language

The scaffold output is determined by the `target_stack` field in the spec.
For the fintech domain, the supported targets are:

| Target | Language | Framework |
|--------|----------|-----------|
| `rust-axum` | Rust | Axum + SQLx + Tokio |
| `typescript-node` | TypeScript | Fastify + Prisma |
| `solidity` | Solidity | Foundry |

---

## Target: `rust-axum`

### Module Structure

Generated from the `Service[]` list in `DecompositionOutput`. One module
per bounded context.

```
src/
├── main.rs              ← Entry point. Health check only.
├── lib.rs               ← Re-exports all modules.
├── config.rs            ← Config struct with required env vars listed.
├── error.rs             ← Domain error enum. Every error variant named.
├── db.rs                ← Connection pool setup. No queries here.
│
├── wallet/
│   ├── mod.rs
│   ├── types.rs         ← AccountId, Amount, Currency, LedgerEntry
│   ├── service.rs       ← WalletService trait + stub impl
│   └── repository.rs    ← WalletRepository trait (no SQL, only method sigs)
│
├── payment/
│   ├── mod.rs
│   ├── types.rs         ← PaymentIntent, PaymentStatus state machine enum
│   ├── service.rs       ← PaymentService trait + stub impl
│   ├── repository.rs    ← PaymentRepository trait
│   ├── idempotency.rs   ← IdempotencyStore trait + stub impl
│   └── webhook.rs       ← Webhook handler stubs
│
├── compliance/
│   ├── mod.rs
│   ├── types.rs         ← ComplianceResult, VelocityCheck, SanctionsCheck
│   └── gate.rs          ← ComplianceGate trait + stub impl
│
└── outbox/
    ├── mod.rs
    ├── types.rs         ← OutboxEntry, EventType
    └── relay.rs         ← OutboxRelay trait + stub impl
```

### Type Scaffold Rules for Rust

**Rule 1 — Monetary amounts are NEVER primitive floats.**
```rust
// CORRECT
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Amount(i64); // Minor units (kobo, cents)

impl Amount {
    pub fn from_minor_units(units: i64) -> Self { Self(units) }
    pub fn as_minor_units(&self) -> i64 { self.0 }
    // SPEC[MONETARY_PRECISION]: No From<f64> impl. Intentional.
}

// WRONG — never generated
type Amount = f64;
```

**Rule 2 — State machines are enums, not strings.**
```rust
// CORRECT — compiler prevents invalid transitions
#[derive(Debug, Clone, PartialEq)]
pub enum PaymentStatus {
    Initiated,
    Authorized { authorization_code: String },
    Captured,
    Settled,
    Voided,
    Failed { reason: FailureReason },
    Expired,
}
// SPEC[AUTH_CAPTURE_STATE_MACHINE]: Transitions are implemented in
// PaymentService::transition(). Invalid transitions return Err.
// No direct field mutation of PaymentStatus allowed outside service layer.

// WRONG — never generated
type PaymentStatus = String;
```

**Rule 3 — Idempotency key is non-optional on all mutation signatures.**
```rust
// CORRECT
pub async fn initiate_transfer(
    &self,
    idempotency_key: IdempotencyKey, // Non-optional. Required by FM-001.
    sender_id: AccountId,
    receiver_id: AccountId,
    amount: Amount,
    currency: Currency,
) -> Result<PaymentIntent, PaymentError> {
    // SPEC[FR-001, FM-001, FM-002, FM-003]:
    // REQUIRED PATTERN: IDEMPOTENCY_KEY, ATOMIC_LEDGER_ENTRY, DOUBLE_ENTRY_LEDGER
    // See PIPELINE.md § Pass 4 — Algorithm: Initiate Payment Transfer
    // Steps 1-14 must be implemented here.
    todo!("Implement per spec")
}

// WRONG — never generated
pub async fn initiate_transfer(
    &self,
    sender_id: AccountId,
    receiver_id: AccountId,
    amount: f64, // also wrong — not Amount type
) -> Result<(), Error>
```

**Rule 4 — Error types are exhaustive, named enums.**
```rust
// Generated from the failure paths in each Algorithm in DesignOutput.
#[derive(Debug, thiserror::Error)]
pub enum PaymentError {
    #[error("Duplicate request: idempotency key already processed")]
    DuplicateRequest,

    #[error("Compliance rejected: {reason}")]
    ComplianceRejected { reason: String },

    #[error("Insufficient funds")]
    InsufficientFunds,

    #[error("Account not found: {account_id}")]
    AccountNotFound { account_id: AccountId },

    #[error("Payment processor error: {0}")]
    ProcessorError(#[from] ProcessorClientError),

    #[error("Concurrent modification conflict — retry with backoff")]
    // SPEC[FM-002, ATOMIC_LEDGER_ENTRY]: Returned on optimistic lock failure.
    // Caller MUST retry with exponential backoff. Max 3 retries.
    ConcurrentModification,

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}
```

**Rule 5 — Repository traits are separated from service traits.**
```rust
// Service: business logic interface (no DB details)
#[async_trait::async_trait]
pub trait WalletService: Send + Sync {
    async fn get_balance(&self, account_id: AccountId) -> Result<Amount, WalletError>;
    async fn debit(
        &self,
        idempotency_key: IdempotencyKey,
        account_id: AccountId,
        amount: Amount,
        reference: TransactionReference,
    ) -> Result<LedgerEntry, WalletError>;
    async fn credit(
        &self,
        idempotency_key: IdempotencyKey,
        account_id: AccountId,
        amount: Amount,
        reference: TransactionReference,
    ) -> Result<LedgerEntry, WalletError>;
}

// Repository: data access interface (no business logic)
#[async_trait::async_trait]
pub trait WalletRepository: Send + Sync {
    // SPEC[ATOMIC_LEDGER_ENTRY]: This method MUST use SELECT FOR UPDATE
    // or equivalent atomic operation. See PIPELINE.md § Pass 4, Step 4-11.
    async fn debit_atomic(
        &self,
        account_id: AccountId,
        amount: Amount,
        entry: &NewLedgerEntry,
    ) -> Result<LedgerEntry, RepositoryError>;

    async fn credit_atomic(
        &self,
        account_id: AccountId,
        amount: Amount,
        entry: &NewLedgerEntry,
    ) -> Result<LedgerEntry, RepositoryError>;

    // SPEC[DOUBLE_ENTRY_LEDGER]: balance() MUST be computed from SUM of
    // ledger entries, not a cached column, unless cache invalidation is
    // explicitly implemented and documented.
    async fn balance(&self, account_id: AccountId) -> Result<Amount, RepositoryError>;
}
```

---

## Target: `typescript-node`

### Module Structure

```
src/
├── index.ts             ← Entry point. Server setup only.
├── config.ts            ← Zod-validated env schema. No defaults for secrets.
├── errors.ts            ← Error class hierarchy.
├── types/
│   ├── money.ts         ← Money class (integer minor units only)
│   ├── payment.ts       ← PaymentStatus union type (not enum string)
│   └── common.ts        ← AccountId, IdempotencyKey branded types
│
├── wallet/
│   ├── wallet.service.ts     ← Interface + stub class
│   └── wallet.repository.ts  ← Interface + stub class
│
├── payment/
│   ├── payment.service.ts
│   ├── payment.repository.ts
│   ├── idempotency.service.ts
│   └── webhook.handler.ts
│
├── compliance/
│   └── compliance.gate.ts
│
└── outbox/
    └── outbox.relay.ts
```

### Type Scaffold Rules for TypeScript

**Rule 1 — Branded types for domain identifiers.**
```typescript
// Prevents mixing up AccountId and PaymentId at compile time.
// SPEC[IMPLICIT_CONSTRAINT_3]: Domain identifiers are never raw strings.
declare const __brand: unique symbol;
type Brand<T, B> = T & { [__brand]: B };

export type AccountId = Brand<string, "AccountId">;
export type PaymentId = Brand<string, "PaymentId">;
export type IdempotencyKey = Brand<string, "IdempotencyKey">;
export type TransactionReference = Brand<string, "TransactionReference">;

// WRONG — never generated
type AccountId = string;
```

**Rule 2 — Money class, never number.**
```typescript
// SPEC[MONETARY_PRECISION, FM-006]: All monetary values in minor units.
export class Money {
  private constructor(private readonly minorUnits: bigint, readonly currency: Currency) {}

  static fromMinorUnits(units: bigint, currency: Currency): Money {
    return new Money(units, currency);
  }

  toMinorUnits(): bigint { return this.minorUnits; }

  // SPEC[MONETARY_PRECISION]: No fromNumber() with float. Intentional omission.
  // Conversion from display amounts must go through a controlled parsing path
  // that applies currency-specific rounding rules.

  add(other: Money): Money {
    if (other.currency !== this.currency) throw new CurrencyMismatchError();
    return new Money(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    if (other.currency !== this.currency) throw new CurrencyMismatchError();
    if (other.minorUnits > this.minorUnits) throw new InsufficientFundsError();
    return new Money(this.minorUnits - other.minorUnits, this.currency);
  }
}

// WRONG — never generated
type Amount = number;
```

**Rule 3 — Payment status as discriminated union.**
```typescript
// SPEC[AUTH_CAPTURE_STATE_MACHINE]: Every state carries only its
// relevant data. Invalid state data is impossible to represent.
export type PaymentStatus =
  | { status: "initiated" }
  | { status: "authorized"; authorizationCode: string; expiresAt: Date }
  | { status: "captured"; capturedAt: Date }
  | { status: "settled"; settledAt: Date }
  | { status: "voided"; voidedAt: Date; reason: string }
  | { status: "failed"; reason: FailureReason; failedAt: Date }
  | { status: "expired"; expiredAt: Date };

// WRONG — never generated
type PaymentStatus = "initiated" | "authorized" | "captured" | "failed";
```

**Rule 4 — Service interface with required idempotency key.**
```typescript
export interface PaymentService {
  /**
   * SPEC[FR-001, FM-001, FM-002, FM-003]
   * REQUIRED PATTERNS: IDEMPOTENCY_KEY, ATOMIC_LEDGER_ENTRY, DOUBLE_ENTRY_LEDGER
   * See PIPELINE.md § Pass 4 — Algorithm: Initiate Payment Transfer
   */
  initiateTransfer(params: {
    idempotencyKey: IdempotencyKey; // Non-optional. FM-001.
    senderId: AccountId;
    receiverId: AccountId;
    amount: Money;
  }): Promise<Result<PaymentIntent, PaymentError>>;
}

// Stub implementation — logic is TODO with spec references
export class PaymentServiceImpl implements PaymentService {
  constructor(
    private readonly walletRepo: WalletRepository,
    private readonly idempotencyStore: IdempotencyStore,
    private readonly complianceGate: ComplianceGate,
    private readonly outbox: OutboxService,
  ) {}

  async initiateTransfer(params: {
    idempotencyKey: IdempotencyKey;
    senderId: AccountId;
    receiverId: AccountId;
    amount: Money;
  }): Promise<Result<PaymentIntent, PaymentError>> {
    // SPEC[FM-001, IDEMPOTENCY_KEY]: Check idempotency store first.
    // SPEC[FM-010, COMPLIANCE_GATE]: Run compliance gate synchronously.
    // SPEC[FM-002, ATOMIC_LEDGER_ENTRY]: Use atomic debit+credit in one tx.
    // SPEC[FM-004, OUTBOX_PATTERN]: Insert outbox entry in same transaction.
    // Full algorithm: PIPELINE.md § Pass 4, Steps 1-14.
    throw new Error("Not implemented — see PIPELINE.md § Pass 4");
  }
}
```

**Rule 5 — Config is validated at startup, not at runtime.**
```typescript
import { z } from "zod";

// SPEC[IMPLICIT_CONSTRAINT_3]: All secrets from environment.
// The process exits immediately if required env vars are missing.
const ConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  PAYMENT_PROCESSOR_API_KEY: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(32),
  IDEMPOTENCY_KEY_TTL_SECONDS: z.coerce.number().default(86400),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const result = ConfigSchema.safeParse(process.env);
  if (!result.success) {
    console.error("FATAL: Invalid configuration:", result.error.format());
    process.exit(1);
  }
  return result.data;
}
```

---

## Target: `solidity`

### Module Structure

```
src/
├── interfaces/
│   ├── IPaymentGateway.sol    ← External interface
│   ├── ILedger.sol            ← Internal ledger interface
│   └── IComplianceOracle.sol  ← Compliance gate interface
│
├── types/
│   └── PaymentTypes.sol       ← Structs and enums
│
├── PaymentGateway.sol         ← Main contract stub
├── Ledger.sol                 ← Ledger contract stub
└── ComplianceOracle.sol       ← Compliance contract stub
```

### Type Scaffold Rules for Solidity

**Rule 1 — Use custom errors, never string reverts.**
```solidity
// CORRECT
error InsufficientFunds(address account, uint256 balance, uint256 required);
error DuplicateRequest(bytes32 idempotencyKey);
error ComplianceRejected(address account, string reason);
error UnauthorizedStateTransition(PaymentStatus from, PaymentStatus to);

// WRONG — never generated
revert("Insufficient funds");
```

**Rule 2 — Amounts use fixed-point with explicit denomination.**
```solidity
// SPEC[MONETARY_PRECISION]: All amounts in smallest denomination.
// For USD: 1 USD = 100 cents = stored as 100.
// Denomination is documented per function, not assumed.

struct Money {
    uint256 amount;        // In minor units
    bytes3 currency;       // ISO 4217: "USD", "EUR", "NGN"
    uint8 decimals;        // 2 for USD, 0 for JPY
}
```

**Rule 3 — Payment status as explicit enum with transition guards.**
```solidity
// SPEC[AUTH_CAPTURE_STATE_MACHINE]
enum PaymentStatus {
    Initiated,    // 0
    Authorized,   // 1
    Captured,     // 2
    Settled,      // 3
    Voided,       // 4
    Failed,       // 5
    Expired       // 6
}

// Transition guard — called before every state change
function _assertValidTransition(
    PaymentStatus from,
    PaymentStatus to
) internal pure {
    // SPEC[AUTH_CAPTURE_STATE_MACHINE]: Implement valid transition matrix.
    // Valid: Initiated→Authorized, Authorized→Captured, Authorized→Voided,
    //        Authorized→Expired, Captured→Settled, Initiated→Failed
    // All other transitions revert with UnauthorizedStateTransition.
    // TODO: implement transition matrix
    revert("Not implemented — see PIPELINE.md § Pass 4");
}
```

**Rule 4 — Reentrancy protection on all state-changing functions.**
```solidity
// SPEC[FM-003]: Every external call that follows a state change
// must be protected against reentrancy.
// Pattern: checks-effects-interactions (CEI).
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PaymentGateway is ReentrancyGuard {
    // SPEC[FR-001, FM-001]: idempotencyKey required on all mutations.
    function initiateTransfer(
        bytes32 idempotencyKey,
        address sender,
        address receiver,
        Money calldata amount
    ) external nonReentrant returns (bytes32 paymentId) {
        // SPEC: CEI pattern MUST be followed:
        // 1. All checks (idempotency, balance, compliance) FIRST.
        // 2. All effects (state changes) SECOND.
        // 3. All interactions (external calls) LAST.
        // See PIPELINE.md § Pass 4 — Algorithm: Initiate Payment Transfer
        revert("Not implemented");
    }
}
```

---

## Anti-Patterns the Scaffold Explicitly Blocks

The scaffold generation engine must never produce the following, regardless
of what the LLM might suggest:

| Anti-Pattern | Why Blocked | What to Generate Instead |
|--------------|-------------|--------------------------|
| `amount: number` or `amount: f64` | Floating point precision loss (FM-006) | `amount: Amount` newtype or `Money` class |
| `status: string` | Invalid states representable | Discriminated union or enum |
| Optional idempotency key | Enables double charge (FM-001) | Required parameter, no default |
| `catch (e) {}` empty catch | Silences FM-004, FM-005 failures | Typed error handling with explicit cases |
| `any` type annotation | Defeats the entire type system | Named interface or `unknown` with guard |
| `console.log` for errors | Not structured observability | Structured logger with transaction_id field |
| Hardcoded secrets | Security violation | `loadConfig()` pattern with env var validation |
| `// TODO: handle errors` comment | Not a compiler constraint | Typed `Result` or error enum with variants |
| Direct DB query in service layer | Violates service/repo separation | Call to repository interface method |
| Floating promise (`asyncFn()` without await) | Silent failure | `await asyncFn()` always. ESLint rule: `@typescript-eslint/no-floating-promises` |

---

## The Scaffold Completeness Invariant

When scaffold generation is complete, the following must be true:

1. **Every functional requirement maps to at least one function signature.**
   Unimplemented functions have TODO markers with spec references.

2. **Every identified failure mode maps to at least one type constraint.**
   The type system must make the failure mode harder (not impossible —
   that's the implementation's job) to introduce accidentally.

3. **Every algorithm step that requires a specific pattern has a comment**
   citing the pattern by name and the spec section.

4. **No logic is present.** If a function body contains anything other than
   a `todo!()`, `throw new Error()`, `revert()`, or structural setup code,
   the scaffold generator has overstepped its boundary.

5. **Every module compiles.** The scaffold must pass `cargo check`,
   `tsc --noEmit`, or `forge build` without errors. It should produce
   warnings only for unimplemented functions.
