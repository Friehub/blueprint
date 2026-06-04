# Changelog

## 0.1.0 — Initial Release

### Core
- **Parser:** Reads 108 markdown contracts, extracts functions, types, dependencies, invariants, and provider lists. 0 errors, 0 warnings.
- **Resolver:** Transitive dependency resolution with cycle detection. Walks hard deps, attaches implicit core contracts.
- **Type inference:** Automatic type detection from parameter names (`order_id` → `string`, `amount` → `number`, `created_at` → `Timestamp`). 35 inference rules.
- **Versioning:** Extracts `**Version:** 0.1.0` from contract preambles. All 108 contracts versioned.

### Adapters
- **83 adapters across 35 modules:** Stripe, Paystack, Adyen (payments), Redis, Memcached (caching), BullMQ, SQS, RabbitMQ (queues), Resend, Sendgrid, Mailgun (email), Twilio, Vonage (SMS), Clerk, Auth0, Supertokens (auth), and more.
- **Adapter validation:** Checks implementations against contracts. Reports missing functions, suggests similar names (Levenshtein distance).
- **Config extraction:** Required and optional config fields per adapter.

### Code Generation
- **TypeScript generator:** Interfaces, adapter skeletons, conformance tests. 276 files generated from 108 contracts.
- **SDK implementations:** Real Stripe, Redis, BullMQ code embedded in generated adapters. Not stubs — working implementations.
- **Dependency-aware:** Generating a module's code also generates its hard dep interfaces.
- **Type safety:** Inferred types throughout library API and generated code. Zero `any` in function signatures.

### CLI — 14 commands
| Command | What it does |
|---|---|
| `build` | Parse contracts → catalog.json |
| `list` | All 108 modules with deps |
| `inspect` | Full contract for one module |
| `graph` | ASCII or Mermaid dependency tree |
| `search` | Interactive module picker |
| `resolve` | Transitive dependency resolution |
| `adapters` | 83 adapters: list, add, remove, verify |
| `generate` | TypeScript code generation |
| `prototype` | Project scaffold with correct npm deps |
| `schema` | JSON Schema export |
| `verify` | Check implementation against contract |
| `implement` | Generate AI implementation prompts |
| `mcp` | Start MCP server for AI tools |

### Library API
```typescript
import { loadCatalogFromRoot } from 'blueprint';
const catalog = await loadCatalogFromRoot('./contracts');
```

### MCP Server
7 tools for AI integration: `list_modules`, `get_module`, `search_modules`, `resolve_deps`, `list_adapters`, `get_adapter`, `get_dependency_graph`. Stdio transport for Claude Desktop, Cursor, Copilot.

### Testing
- **91 tests:** 58 unit + 25 integration + 8 MCP
- **Edge cases:** Empty files, malformed markdown, 50-module chains, self-referencing modules, commented-out code, return type mismatches
- **CI:** GitHub Actions on Node 18, 20, 22

### Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) (coming soon).
