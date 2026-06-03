# MCP Server Design

## Problem

AI tools (Claude Desktop, Cursor, Copilot) want to query contracts but they can't run CLI commands reliably. They need a programmatic API exposed through the Model Context Protocol (MCP).

An MCP server lets an AI agent ask: "What functions does the payments module define?" and get typed JSON back, without shelling out to `blueprinter inspect payments`.

---

## Architecture

```
AI Tool (Claude Desktop, Cursor)
    ↓ MCP protocol (stdio)
MCP Server (node process)
    ↓ imports
blueprinter library (loadCatalog, resolveDeps, etc.)
    ↓ reads
contracts/ + adapters/
```

The MCP server is a thin wrapper. It starts when the AI tool connects, loads the catalog once, and exposes tools that query the in-memory catalog.

---

## Tools Exposed

### 1. `list_modules`
Lists all available modules with basic info.

```json
// Request
{ "tool": "list_modules" }

// Response
{
  "modules": [
    { "name": "payments", "version": "0.1.0", "functions": 10, "hardDeps": [], "softDeps": ["audit_log", "notifications", "fraud_detection"] },
    { "name": "billing", "version": "0.1.0", "functions": 10, "hardDeps": ["payments", "users"], "softDeps": ["notifications", "audit_log", "usage_metering"] }
  ]
}
```

### 2. `get_module`
Returns the full contract for a module.

```json
// Request
{ "tool": "get_module", "arguments": { "name": "payments" } }

// Response
{
  "name": "payments",
  "version": "0.1.0",
  "functions": [
    { "name": "initiatePayment", "params": [{"name": "order_id", "type": "string", "optional": false}, ...], "returns": "Payment" },
    ...
  ],
  "types": [{ "name": "Payment", "raw": "Payment { id, order_id, amount, currency, status, method }" }],
  "hardDeps": [],
  "softDeps": ["audit_log", "notifications", "fraud_detection"],
  "coreInherits": []
}
```

### 3. `search_modules`
Search modules by name, summary, or function name.

```json
// Request
{ "tool": "search_modules", "arguments": { "query": "payment" } }

// Response
{
  "results": [
    { "name": "payments", "score": 100, "matchType": "name" },
    { "name": "payouts", "score": 60, "matchType": "summary" }
  ]
}
```

### 4. `resolve_deps`
Resolve a set of modules with all transitive dependencies.

```json
// Request
{ "tool": "resolve_deps", "arguments": { "modules": ["billing"] } }

// Response
{
  "modules": [
    { "name": "billing", "source": "explicit", "hardDeps": ["payments", "users"] },
    { "name": "payments", "source": "hard-dep", "hardDeps": [] },
    { "name": "users", "source": "hard-dep", "hardDeps": [] },
    { "name": "notifications", "source": "soft-dep", "hardDeps": ["users"] }
  ],
  "core": [{ "name": "global_standards" }, { "name": "runtime_standards" }]
}
```

### 5. `list_adapters`
List available adapters for a module.

```json
// Request
{ "tool": "list_adapters", "arguments": { "module": "payments" } }

// Response
{
  "adapters": [
    { "name": "stripe", "implements": ["initiatePayment", "verifyPayment", ...], "does_not_implement": ["getWallet", ...] },
    { "name": "paystack", "implements": [...], "does_not_implement": ["getWallet", ...] }
  ]
}
```

### 6. `get_adapter`
Returns adapter details including config requirements.

```json
// Request
{ "tool": "get_adapter", "arguments": { "module": "payments", "provider": "stripe" } }

// Response
{
  "name": "stripe",
  "module": "payments",
  "config": {
    "required": [{ "name": "api_key", "type": "string", "secret": true }],
    "optional": [{ "name": "api_version", "type": "string", "default": "2023-10-16" }]
  },
  "implements": ["initiatePayment", "verifyPayment", ...],
  "does_not_implement": ["getWallet", "creditWallet", "debitWallet", "getWalletTransactions"]
}
```

### 7. `generate_code`
Generates code for a module in a specific language.

```json
// Request
{ "tool": "generate_code", "arguments": { "module": "payments", "language": "typescript", "type": "interfaces" } }

// Response
{
  "files": [{ "path": "interfaces/payments.ts", "content": "..." }]
}
```

---

## Implementation

### File: `src/mcp/server.ts`

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({ name: "blueprinter", version: "0.1.0" });

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: "list_modules", description: "List all available module contracts" },
    { name: "get_module", description: "Get a module's full contract" },
    { name: "search_modules", description: "Search modules by query" },
    { name: "resolve_deps", description: "Resolve modules with transitive dependencies" },
    { name: "list_adapters", description: "List available adapters for a module" },
    { name: "get_adapter", description: "Get adapter details including config" },
    { name: "generate_code", description: "Generate code from contracts" },
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  // Dispatch to handler functions
});

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
```

### Dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.0.0"
}
```

---

## Configuration

Users add this to their Claude Desktop config:

```json
{
  "mcpServers": {
    "blueprinter": {
      "command": "npx",
      "args": ["-y", "engineering-blueprinter", "mcp"],
      "cwd": "/path/to/project"
    }
  }
}
```

---

## Multi-Language Generator Design

Building on the existing plugin system (`src/generators/engine.ts`):

### Architecture
```
src/generators/
├── engine.ts          # Plugin registry (exists)
├── types.ts           # Shared types (exists)
├── typescript/        # TypeScript generator (exists)
├── rust/              # Rust generator (new)
│   └── index.ts       # One file, ~150 lines
├── python/            # Python generator (new)
│   └── index.ts       # One file, ~150 lines
└── go/                # Go generator (new)
    └── index.ts       # One file, ~150 lines
```

Each language generator follows the same pattern:
1. `generateInterfaces()` -- produces traits/protocols/interfaces
2. `generateAdapter()` -- produces adapter structs/classes
3. `generateTests()` -- produces conformance tests

### Code Snippets

**Rust output:**
```rust
// Generated from contracts/payments.md
#[async_trait]
pub trait PaymentsContract {
    async fn initiate_payment(&self, order_id: &str, amount: f64, currency: &str, method: &str) -> Result<Payment, Error>;
    async fn verify_payment(&self, payment_id: &str) -> Result<Payment, Error>;
}

pub struct StripeAdapter {
    config: StripeConfig,
    client: stripe::Client,
}
```

**Python output:**
```python
from typing import Protocol, Optional
from dataclasses import dataclass

class PaymentsContract(Protocol):
    async def initiate_payment(self, order_id: str, amount: float, currency: str, method: str) -> Payment: ...
    async def verify_payment(self, payment_id: str) -> Payment: ...

@dataclass
class Payment:
    id: str
    amount: float
    currency: str
```

**Go output:**
```go
type PaymentsContract interface {
    InitiatePayment(orderID string, amount float64, currency string, method string) (*Payment, error)
    VerifyPayment(paymentID string) (*Payment, error)
}

type StripeAdapter struct {
    config StripeConfig
    client *stripe.Client
}
```

---

## `blueprinter implement` Command (Next Version)

Uses AI to fill in `throw new Error()` stubs in generated adapters.

```bash
blueprinter implement payments --adapter stripe --lang typescript
```

Flow:
1. Load contract + generated adapter skeleton
2. For each `throw new Error('Not implemented: X')`:
   - Query the contract for the function signature
   - Call AI with: "Implement `${fn.name}(params)` for Stripe adapter. Contract says it should: ... SDK hint: ... Return type: ..."
   - Replace stub with AI-generated implementation
3. Write completed adapter file

This is deferred because it needs:
- AI model integration (Claude API, OpenAI API)
- Context window management for large contracts
- Error recovery for failed generations
