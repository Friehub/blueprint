# Prototype Generation System

## Problem

The code generator produces isolated files (interfaces, adapters, tests). But users need a complete working project they can run and extend. Without a prototype system:

- Users manually create package.json, tsconfig, etc.
- Users manually wire adapters together
- Users manually create entry points
- No project structure is enforced

The prototype system generates a complete, runnable project from contracts and adapters.

---

## What Gets Generated

### Project Structure

```
my-project/
├── package.json              # Dependencies, scripts
├── tsconfig.json             # TypeScript config
├── .gitignore               # Ignore dist, node_modules
├── src/
│   ├── interfaces/          # Generated interfaces
│   │   ├── billing.ts
│   │   ├── payments.ts
│   │   └── index.ts
│   ├── adapters/            # Generated adapter skeletons
│   │   ├── billing/
│   │   │   └── stripe.ts
│   │   └── payments/
│   │       └── stripe.ts
│   ├── config/              # Configuration
│   │   └── adapters.ts      # Adapter registry
│   └── index.ts             # Main entry point
├── __tests__/               # Generated tests
│   ├── billing/
│   │   └── stripe.test.ts
│   └── payments/
│       └── stripe.test.ts
└── README.md                # Project documentation
```

### package.json

```json
{
  "name": "my-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc",
    "test": "node --test dist/__tests__/**/*.test.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "stripe": "^14.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0"
  }
}
```

### Configuration

```typescript
// src/config/adapters.ts
import { StripeAdapter } from '../adapters/billing/stripe';
import { StripeAdapter as PaymentsStripe } from '../adapters/payments/stripe';

export const adapters = {
  billing: new StripeAdapter({ apiKey: process.env.STRIPE_API_KEY! }),
  payments: new PaymentsStripe({ apiKey: process.env.STRIPE_API_KEY! }),
};
```

### Main Entry Point

```typescript
// src/index.ts
import { adapters } from './config/adapters';

async function main() {
  console.log('Application started');
  
  // Example usage
  const subscription = await adapters.billing.createSubscription({
    userId: 'user-123',
    planId: 'plan-456',
    paymentMethod: 'pm_789',
  });
  
  console.log('Subscription created:', subscription);
}

main().catch(console.error);
```

---

## CLI Commands

### Generate Complete Prototype

```bash
blueprinter prototype --modules billing,payments,users --adapters stripe
```

### Generate with Specific Configuration

```bash
blueprinter prototype \
  --modules billing,payments,users \
  --adapters billing:stripe,payments:stripe \
  --name my-saas \
  --output ./my-saas
```

### Generate from Resolved Set

```bash
blueprinter resolve --modules billing,payments,users --output resolved.json
blueprinter prototype --from resolved.json
```

---

## Implementation Plan

### Phase 1: Project Structure Generator
- Generate package.json with correct dependencies
- Generate tsconfig.json
- Generate .gitignore
- Generate README.md

### Phase 2: Code Generator Integration
- Use existing generator engine
- Generate interfaces for all selected modules
- Generate adapter skeletons for selected adapters
- Generate conformance tests

### Phase 3: Configuration Generator
- Generate adapter registry
- Generate environment variable templates
- Generate configuration validation

### Phase 4: Entry Point Generator
- Generate main entry point
- Generate example usage code
- Generate health check endpoints

---

## Open Questions

1. **Should the prototype be runnable immediately?**
   - Yes, but with placeholder implementations
   - Users fill in the TODO comments

2. **How to handle dependencies?**
   - Auto-install with npm install
   - Or just generate package.json and let user install

3. **How to handle environment variables?**
   - Generate .env.example
   - Generate config validation

4. **How to handle multiple environments?**
   - Generate development, production, test configs
   - Or keep it simple with one environment

---

## Summary

The prototype system generates a complete, runnable project from contracts and adapters. Users get a working skeleton they can extend with their business logic.
