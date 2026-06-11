# Blueprint — Agent Handoff Document

## Project Overview

Blueprint is an open-source catalog of 162 backend domain contracts. Each contract is a markdown file defining function signatures, types, invariants, and system constraints. The project includes 83 provider adapters, 5 code generators (TypeScript, Python, Go, Rust, Java), 12 MCP tools, and a Vite documentation site.

**Repo:** `github.com/Friehub/blueprint`
**Package:** `@friehub/blueprint` on npm
**Docs site:** `blueprint.friehub.cloud`
**Version:** 0.2.1
**License:** MIT

---

## Codebase Structure

```
/contracts/           # 162 module contracts (.md)
  core/               # global_standards.md, runtime_standards.md, sagas.md
/adapters/            # 83 adapter definitions (.yaml)
/sagas/               # 5 saga flow definitions
/src/                 # TypeScript source
  cli.ts              # CLI entry point
  cli/commands.ts     # Command handlers (list, inspect, generate, etc.)
  core/               # Parser, resolver, graph, search, verifier, catalog types
  generators/         # Code generation engine + 5 language plugins
    typescript/       # TypeScript generator (reference implementation)
    python/           # Python generator
    go/               # Go generator
    rust/             # Rust generator
    java/             # Java generator
    prototype/        # Project scaffold generator
    aliases.ts        # Alias/obfuscation system
  mcp/server.ts       # MCP server (12 tools)
  utils/args.ts       # CLI argument parser
/site/                # Vite documentation site
  src/                # Vue 3 app (single-file component)
    App.vue           # All pages: Home, Quick Start, MCP, Architecture, Design, Modules, Adapters, Sagas
    main.js           # App entry, catalog data loader
    style.css         # Design system with brand colors
  vite.config.js      # Build config, injects adapters.json
/docs/                # Documentation
  alias-spec.md       # Aliasing specification
  system-design-strategy.md  # System design tool strategy
  supply-chain-security.md   # Supply chain governance
  feature-boundary.md        # Paid vs open feature decisions
/scripts/             # Build and CI scripts
/.github/workflows/   # CI and publish workflows
```

---

## Current State of Completeness

### Completed (all working):
- 162 module contracts with full structure (functions, types, invariants, system-level integrations)
- 83 adapter YAML definitions with per-language declarations
- 5 code generators (TS, Python, Go, Rust, Java) with namespace, alias, and obfuscation support
- 12 MCP tools covering module search, dependency resolution, saga retrieval, schema, patterns, validation, suggestions
- MCP server with `--auth-token` flag and untrusted content warning
- Recursive dependency tree on docs site (expand/collapse, cycle protection)
- Interactive system design tool on docs site (click-to-add canvas, auto-connections, topology scoring, export)
- Architecture page, Quick Start page, MCP page on docs site
- Security hardening: progressive lockout, timing floor, token binding, observability privacy, refresh token family tracking, error translation, CSRF standard
- Alias system: functions, modules, classes, config, topics
- `blueprint verify` with `--aliases` and `--obfuscate` support
- Compiled catalog (catalog.min.json) strips function signatures, invariants, source paths
- `.npmignore` cleaned (no contract leaks)
- All build artifacts excluded from git
- GitHub Actions CI + publish workflow
- npm package verified working from clean install

### Partially Complete (has gaps):
- Design tool is functional but limited (no drag-to-reposition, no grouping into services, no entity model preview)
- Some contracts lack operational metadata (algorithm choices, caching patterns, load balancing strategies)
- No production operations reference page on docs site

### Not Started:
- Reference database schemas (abstract entity models + multi-DB renderer)
- System design aggregator MCP tool (`design_system`, `compare_topologies`)
- Entity model extraction from contract types
- C# / Kotlin generators
- RAG index for inference-time retrieval
- Schema drift detection
- Service mesh + zero_trust bridge (contracts exist but need operational parameters connected)

---

## Contract Structure

Every contract in `/contracts/` is a `.md` file with this structure:

```markdown
# Module Contract: `module_name`

**Version:** 0.1.0

---

### `module_name`
Short description

**Functions**
```
functionName(param1, param2?) → ReturnType
```

**Types**
```
TypeName { field1, field2? }
TypeName = value1 | value2
```

**Invariants**
- Rule that must always hold

**Providers:** Provider1, Provider2

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong|eventual|causal`
* **Details:** Explanation

### Algorithm (add this to infrastructure modules)
* **Recommended:** Specific algorithm recommendation
* **Details:** When to use which variant

### Storage Model
* **Model:** Description
* **Details:** Details

### Observability
* **Tracing Spans:** pattern
* **Telemetry Metrics:** metric definitions
* **SLO Targets:** reference

### Module Dependencies
* **Depends On:** modules this requires
* **Emits To:** events this emits
* **Recommends:** optional integrations
```

The markdown is parsed by `src/core/parser.ts` and related files. The parsed data flows into `catalog.json`.

---

## How to Add Operational Metadata to Contracts

The infrastructure contracts need an `### Algorithm` subsection added to their System-Level Integrations section. This subsection should specify:

1. **Recommended algorithm(s)** for the module's core operation
2. **When to use each variant** (tradeoffs)
3. **Atomicity or correctness requirements**
4. **References** to related modules

Contracts that need this:
| Contract | What to add |
|---|---|
| `rate_limiting` | Sliding window counter (distributed), token bucket (burst-tolerant), leaky bucket (smoothing) |
| `caching` | Cache-aside (read-heavy), write-through (consistency), write-behind (performance), tag-based invalidation |
| `queues` | Ordering guarantees (FIFO per partition), at-least-once delivery, dead-letter retention |
| `load_shedding` | Priority scheme (critical/background), admission control, SLO budget tracking |
| `circuit_breaker` | State machine (closed/open/half-open), failure threshold, recovery timeout, half-open max requests |
| `event_bus` | Partitioning strategy, ordering per partition, replay semantics, consumer group rebalancing |
| `service_mesh` | Load balancing (round-robin, least-connections, consistent hashing), traffic splitting, circuit breaking |
| `distributed_lock` | Consensus algorithm (Redlock, ZooKeeper, etcd), fencing tokens, lease renewal |

**Format convention for the Algorithm section:**
```markdown
### Algorithm
* **Recommended:** [Primary algorithm] for [use case]. [Alternative] for [different use case].
* **Details:** Explanation of when to use each variant and the tradeoff.
* **Atomicity:** Specific correctness requirement.
```

---

## How to Modify the Docs Site

The docs site is a single Vue 3 file: `/site/src/App.vue`. Key patterns:

- **Nav links** are at the top of the template
- **Each page** is a `<template v-if="state.view === 'pageName'>` block
- **Methods** are in the `methods: {}` block
- **Computed properties** are in `computed: {}`
- **CSS** is in `/site/src/style.css`
- **To add a new page:** add nav link, add template block, add method for navigation

## How to Build and Test

```bash
# Full build (TS compile + catalog + site)
npm run build

# Build just the docs site
cd site && npx vite build

# Test
npm test

# Quick dev server for docs site
cd site && npm run dev

# Pre-commit check (all the things)
bash scripts/pre-commit.sh
```

---

## Design Patterns to Follow

1. **Contracts are the source of truth.** Never hardcode operational information in the docs site. Add it to the contract, let the parser extract it, read from `catalog.json` at runtime.

2. **The catalog data flows through `state.catalog`.** In the Vue app, catalog data is loaded asynchronously in `main.js` via `fetch('./catalog.json')`. All computed properties access it through `this.state.catalog`.

3. **Infrastructure contracts use the standard format.** Follow the pattern in `rate_limiting`, `caching`, `queues` — functions, types, invariants, providers, then system integrations.

4. **Adapters are YAML in `/adapters/<module>/`.** Each adapter declares `implements` (function names) and `does_not_implement`. Add a `languages` field listing supported code generators.

5. **Security defaults are opt-out, not opt-in.** Generated schemas add audit columns, tenant isolation, RLS by default. The engineer removes them if not needed.
