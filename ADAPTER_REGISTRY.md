# Adapter Registry — Design Document

## Problem

Contracts define interfaces. Users need concrete implementations. Today there is no way to:

1. Discover which providers exist for a module
2. Select a provider without changing application code
3. Switch providers without rewriting integrations
4. Verify that an implementation matches its contract

The adapter registry solves all four.

---

## Core Concepts

### Contract

A domain interface. Defined in `contracts/*.md`. Specifies function signatures, types, invariants, and behavioral rules.

Example: `payments` contract defines `initiatePayment`, `refundPayment`, `getPaymentStatus`.

### Adapter

A concrete implementation of a contract for a specific provider. Defined in `adapters/<module>/<provider>.yaml`.

Example: `adapters/payments/stripe.yaml` declares that Stripe implements the `payments` contract.

### Selection

A user decision. Defined in `blueprinter.json`. Maps module names to adapter names.

Example: `"payments": "stripe"` means use Stripe for the payments module.

### Registry

The collection of all known adapters. Lives in `adapters/` directory. Discoverable via CLI.

---

## How It Works

### Step 1: Discover Available Adapters

```bash
blueprinter adapters list
```

Output:
```
Module          Available Adapters
payments        stripe, paystack, adyen
queues          bullmq, sqs, rabbitmq
caching         redis, memcached, cloudflare
emails          resend, sendgrid, mailgun
storage         s3, gcs, azure-blob, local
sms             twilio, Vonage, aws-sns
```

### Step 2: Pick Adapters

```bash
blueprinter adapters add stripe payments
blueprinter adapters add redis caching
blueprinter adapters add bullmq queues
```

This updates `blueprinter.json`:
```json
{
  "adapters": {
    "payments": "stripe",
    "caching": "redis",
    "queues": "bullmq"
  }
}
```

### Step 3: Resolve Dependencies

The resolver checks:
- Does the selected adapter implement all required functions?
- Does the adapter have dependencies on other modules?
- Are there conflicts (two adapters for the same module)?
- Are there missing adapters (module needs payments, but none selected)?

```bash
blueprinter resolve --modules billing
```

Output includes adapter status:
```json
{
  "modules": [
    { "name": "billing", "source": "explicit" },
    { "name": "payments", "source": "hard-dep", "adapter": "stripe" },
    { "name": "users", "source": "hard-dep" }
  ],
  "adapters": {
    "payments": "stripe",
    "caching": "redis"
  },
  "warnings": [
    "Module users has no adapter selected"
  ]
}
```

### Step 4: Verify Conformance

```bash
blueprinter verify
```

Checks:
- Each selected adapter implements all required functions
- Function signatures match the contract
- Config requirements are satisfied
- Dependencies between adapters are resolved

Output:
```
Adapters verified:
  stripe → payments ✓
  redis → caching ✓
  bullmq → queues ✓

Warnings:
  users: no adapter selected (optional)
  notifications: no adapter selected (optional)
```

---

## Adapter Definition Format

Each adapter is a YAML file in `adapters/<module>/<provider>.yaml`:

```yaml
# adapters/payments/stripe.yaml
name: stripe
module: payments
version: 1.2.0
description: Stripe payment processing adapter

implements:
  - initiatePayment
  - refundPayment
  - getPaymentStatus
  - listTransactions

does_not_implement:
  - getWalletBalance  # Stripe doesn't support wallets

config:
  required:
    - name: api_key
      type: string
      description: Stripe secret API key
    - name: webhook_secret
      type: string
      description: Stripe webhook signing secret
  optional:
    - name: api_version
      type: string
      default: "2023-10-16"
      description: Stripe API version

dependencies:
  - module: notifications
    purpose: Send payment confirmation emails
    required: false
  - module: audit_log
    purpose: Log payment events
    required: false

metadata:
  provider_url: https://stripe.com
  docs_url: https://stripe.com/docs
  supported_regions:
    - us
    - eu
    - uk
  supported_currencies:
    - usd
    - eur
    - gbp
```

---

## Selection Rules

### Rule 1: One Adapter Per Module (Default)

By default, each module can have at most one adapter. This prevents conflicts.

```json
{
  "adapters": {
    "payments": "stripe"  // Only one adapter for payments
  }
}
```

### Rule 2: Fallback Chains (Optional)

For reliability, users can specify fallback adapters:

```json
{
  "adapters": {
    "payments": {
      "primary": "stripe",
      "fallback": "paystack"
    }
  }
}
```

### Rule 3: Environment-Specific Selection

Different adapters for different environments:

```json
{
  "adapters": {
    "payments": {
      "production": "stripe",
      "development": "stripe-test",
      "testing": "mock"
    }
  }
}
```

### Rule 4: Adapter Can Be Absent

If no adapter is selected for a module, the module works without concrete implementation. This allows:
- Using the module as a type-only dependency
- Deferring implementation decisions
- Mocking in tests

---

## Directory Structure

```
engineering-blueprinter/
├── contracts/                    # Domain contracts (existing)
│   ├── payments.md
│   ├── caching.md
│   └── queues.md
├── adapters/                     # Adapter definitions (new)
│   ├── payments/
│   │   ├── stripe.yaml
│   │   ├── paystack.yaml
│   │   └── adyen.yaml
│   ├── caching/
│   │   ├── redis.yaml
│   │   └── memcached.yaml
│   ├── queues/
│   │   ├── bullmq.yaml
│   │   ├── sqs.yaml
│   │   └── rabbitmq.yaml
│   └── _meta.yaml               # Registry metadata
├── blueprinter.json              # User selection (new)
└── ...
```

---

## CLI Commands

### List Available Adapters

```bash
blueprinter adapters list
blueprinter adapters list --module payments
```

### Add Adapter Selection

```bash
blueprinter adapters add <provider> <module>
blueprinter adapters add stripe payments
```

### Remove Adapter Selection

```bash
blueprinter adapters remove <module>
blueprinter adapters remove payments
```

### Show Current Selection

```bash
blueprinter adapters show
```

### Verify Adapters

```bash
blueprinter adapters verify
blueprinter adapters verify --module payments
```

### Search Adapters

```bash
blueprinter adapters search stripe
blueprinter adapters search "payment processing"
```

---

## Registry Metadata

The `_meta.yaml` file tracks registry-wide information:

```yaml
# adapters/_meta.yaml
version: 1.0.0
last_updated: 2026-05-27
modules:
  payments:
    adapters: 3
    recommended: stripe
  caching:
    adapters: 2
    recommended: redis
  queues:
    adapters: 3
    recommended: bullmq
```

---

## Verification Rules

### Signature Matching

Each adapter function must match the contract function signature:

| Check | Rule |
|---|---|
| Function name | Exact match |
| Parameters | Same names, types, optional flags |
| Return type | Exact match |
| Throws | Must throw contract-defined errors |

### Invariant Enforcement

Each adapter must satisfy contract invariants:

| Invariant Type | How Enforced |
|---|---|
| Idempotency | Generated test calls function twice with same key |
| State machine | Generated test follows valid state transitions |
| Error codes | Generated test verifies error responses match contract |

### Config Validation

Each adapter's config must be complete:

| Check | Rule |
|---|---|
| Required fields | All present in `blueprinter.json` |
| Type matching | Values match declared types |
| Secret handling | Secrets not logged or exposed |

---

## Integration with Existing System

### Discovery Integration

`blueprinter list` shows adapter status:

```
Modules:
  payments — Subscription and plan management.
    deps: users
    recommends: notifications, audit_log
    adapter: stripe ✓

  caching — In-memory caching layer.
    deps: (none)
    recommends: (none)
    adapter: redis ✓

  users — User identity and profiles.
    deps: (none)
    recommends: audit_log, notifications
    adapter: (none)
```

### Resolve Integration

Resolver includes adapter information in resolved set:

```json
{
  "modules": [
    { "name": "billing", "source": "explicit" },
    { "name": "payments", "source": "hard-dep", "adapter": "stripe" }
  ],
  "core": [...],
  "adapters": {
    "payments": "stripe",
    "caching": "redis"
  },
  "errors": [],
  "warnings": []
}
```

### Graph Integration

Graph shows adapter selection:

```
Dependency graph for: billing

billing *
├── payments (hard) [stripe]
├── users (hard)
├── notifications (soft)
└── audit_log (soft)
```

---

## Future Extensions

### 1. Adapter Templates

Generate adapter skeletons from templates:

```bash
blueprinter generate adapter stripe payments
```

Produces:
```typescript
export class StripeAdapter implements PaymentsContract {
  // Generated skeleton with TODO comments
}
```

### 2. Conformance Tests

Generate tests that verify implementations:

```bash
blueprinter generate tests stripe payments
```

Produces test suite that checks:
- All functions exist with correct signatures
- Idempotency invariants hold
- Error codes match contract
- Config is validated

### 3. Adapter Marketplace

Community-contributed adapters:

```bash
blueprinter adapters search stripe
# Found 3 adapters:
#   @company/stripe-adapter (official)
#   @community/stripe-lite (lightweight)
#   @enterprise/stripe-enterprise (with compliance)
```

### 4. Adapter Versioning

Track contract version compatibility:

```yaml
# adapters/payments/stripe.yaml
implements:
  - contract: payments
    version: ">=1.0.0 <2.0.0"
```

---

## Adapter Capabilities

Not all providers support all features. Adapters declare their capabilities:

```yaml
# adapters/payments/stripe.yaml
capabilities:
  supports:
    - recurring_payments
    - refunds
    - disputes
    - webhooks
    - multi_currency
  does_not_support:
    - wallet_payments
    - offline_payments
```

This allows the resolver to warn when a selected adapter doesn't support required features:

```bash
blueprinter resolve --modules billing
# Warning: billing requires wallet_payments, but stripe does not support it
```

---

## Provider-Specific Features

Some providers have features outside the contract. Two approaches:

### Approach A: Escape Hatches (Recommended)

Adapter defines additional methods not in the contract:

```yaml
# adapters/payments/stripe.yaml
escape_hatches:
  - name: createCheckoutSession
    description: Stripe-specific checkout flow
    not_in_contract: true
```

Users can access these via the adapter directly:

```typescript
const stripe = getAdapter('payments');
const session = await stripe.createCheckoutSession({...}); // Stripe-specific
```

### Approach B: Ignore

Stay contract-only. Provider-specific features are not exposed. Simpler but limiting.

**Recommendation:** Start with Approach A for critical features, fall back to Approach B for everything else.

---

## Adapter Testing Strategies

### Level 1: Signature Tests (Generated)

Verify function exists with correct signature:

```typescript
test('initiatePayment exists with correct signature', () => {
  const adapter = new StripeAdapter(config);
  expect(typeof adapter.initiatePayment).toBe('function');
});
```

### Level 2: Contract Tests (Generated)

Verify behavior matches contract:

```typescript
test('initiatePayment returns Payment object', async () => {
  const adapter = new StripeAdapter(config);
  const result = await adapter.initiatePayment({
    amount: 1000,
    currency: 'usd',
    method: 'card'
  });
  expect(result).toHaveProperty('id');
  expect(result).toHaveProperty('status');
});
```

### Level 3: Invariant Tests (Generated)

Verify behavioral constraints:

```typescript
test('initiatePayment is idempotent', async () => {
  const adapter = new StripeAdapter(config);
  const key = 'test-key-123';
  const result1 = await adapter.initiatePayment({...}, key);
  const result2 = await adapter.initiatePayment({...}, key);
  expect(result1.id).toBe(result2.id); // Same result
});
```

### Level 4: Integration Tests (Manual)

Real provider tests with API keys:

```typescript
test('initiatePayment works with real Stripe', async () => {
  const adapter = new StripeAdapter({ apiKey: process.env.STRIPE_KEY });
  const result = await adapter.initiatePayment({...});
  expect(result.status).toBe('pending');
});
```

---

## Adapter Discovery from Package Registries

Adapters can be discovered from npm:

```bash
blueprinter adapters search stripe
# Found 3 adapters:
#   @engineering-blueprinter/payments-stripe (official)
#   @community/stripe-lite (lightweight)
#   @enterprise/stripe-enterprise (with compliance)
```

Registry metadata:

```yaml
# adapters/_meta.yaml
npm_packages:
  stripe: "@engineering-blueprinter/payments-stripe"
  redis: "@engineering-blueprinter/caching-redis"
  bullmq: "@engineering-blueprinter/queues-bullmq"
```

---

## Adapter Compatibility Matrix

Some adapters conflict with others:

```yaml
# adapters/_meta.yaml
conflicts:
  - adapters: [stripe, paystack]
    reason: "Both implement payments, cannot use simultaneously"
  - adapters: [redis, memcached]
    reason: "Both implement caching, choose one"
  - adapters: [sqs, rabbitmq]
    reason: "Both implement queues, choose one"
```

Resolver checks for conflicts:

```bash
blueprinter adapters add stripe payments
blueprinter adapters add paystack payments
# Error: Cannot add paystack - conflicts with stripe for payments
```

---

## Open Questions

1. **Should adapters be separate npm packages?**
   - Pro: Tree-shakeable, versionable, distributable
   - Con: More complex setup, npm dependency management
   - Recommendation: Start with local files, extract to packages later

2. **How to handle provider-specific features?**
   - Some providers have features outside the contract
   - Option A: Ignore them (stay contract-only)
   - Option B: Allow escape hatches in adapter config
   - Recommendation: Ignore for now, add escape hatches later

3. **Should the registry be centralized or distributed?**
   - Centralized: Single registry everyone contributes to
   - Distributed: Each project maintains its own adapters
   - Recommendation: Distributed (local files), with optional shared registry later

4. **How to handle adapter conflicts?**
   - Two adapters for the same module with different capabilities
   - Option A: Error on conflict
   - Option B: Allow multiple adapters (e.g., primary + fallback)
   - Recommendation: Error on conflict, allow fallback chains

5. **How to handle adapter versioning?**
   - Contract evolves, adapters may not keep up
   - Option A: Adapters declare compatible contract versions
   - Option B: Adapters must implement latest contract version
   - Recommendation: Adapters declare version range, resolver checks compatibility

6. **Should adapters be auto-generated from provider SDKs?**
   - Could scan Stripe SDK and generate adapter YAML
   - Pro: Always up-to-date
   - Con: May not match our contract exactly
   - Recommendation: Manual for now, auto-generation as future feature

---

## Adapter Installation

When a user selects an adapter, the system can auto-install its dependencies:

```bash
blueprinter adapters add stripe payments
# Installing @engineering-blueprinter/payments-stripe...
# Installing stripe (peer dependency)...
# Stripe adapter added for payments module
```

The adapter YAML specifies required packages:

```yaml
# adapters/payments/stripe.yaml
packages:
  npm:
    - name: stripe
      version: "^14.0.0"
      peer: true
  python:
    - name: stripe
      version: ">=7.0.0"
```

---

## Adapter Marketplace Contributions

Community members can contribute adapters:

### Contributing an Adapter

1. Fork the registry
2. Create `adapters/<module>/<provider>.yaml`
3. Fill in the adapter definition
4. Add tests
5. Submit PR

### Adapter Quality Tiers

| Tier | Requirements |
|---|---|
| **Official** | Maintained by engineering-blueprinter team, full test coverage |
| **Community** | Maintained by community, basic test coverage |
| **Experimental** | Proof of concept, may be incomplete |

### Adapter Review Process

1. Check: Does adapter implement all required functions?
2. Check: Are config requirements documented?
3. Check: Are dependencies declared?
4. Check: Do tests pass?
5. Check: Is documentation complete?

---

## Summary

The adapter registry bridges contracts and implementations:

| Layer | What It Does |
|---|---|
| Contract | Defines the interface (function signatures, types, invariants) |
| Adapter | Implements the interface for a specific provider |
| Selection | User picks which adapter to use |
| Registry | Collection of all known adapters |
| Verification | Ensures implementations match contracts |
| Capabilities | Tracks what each adapter supports |
| Discovery | Finds adapters from local files or npm |
| Installation | Auto-installs adapter dependencies |

This makes the contracts usable in real code while preserving the provider-agnostic design.
