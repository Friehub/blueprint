# Blueprint — Agent Guide

## What This Is

Blueprint is a catalog of 162 backend domain contracts (payments, auth, caching, etc.) with 83 provider adapters, 5 code generators (TypeScript, Python, Go, Rust, Java), 12 MCP tools, and a Vite docs site.

**Repo:** `github.com/Friehub/blueprint`
**Package:** `@friehub/blueprint` on npm
**Docs site:** `blueprint.friehub.cloud`
**Version:** 0.2.1 (v2 branch)
**License:** MIT

---

## Codebase Map

| Path | What |
|---|---|
| `/contracts/*.md` | 162 module contracts (functions, types, invariants, system constraints) |
| `/contracts/core/` | 3 core standards: global_standards.md, runtime_standards.md, sagas.md |
| `/adapters/<module>/*.yaml` | 83 adapter definitions (which functions implemented, which languages) |
| `/sagas/*.md` | 5 saga flow definitions (checkout, refund, subscription, offboarding, dispute) |
| `/src/cli.ts` | CLI entry point |
| `/src/core/` | Parser, resolver, graph, search, verifier, catalog types |
| `/src/generators/` | 5 language generators (typescript, python, go, rust, java) |
| `/src/generators/aliases.ts` | Alias/obfuscation system (functions, modules, classes, config, topics) |
| `/src/mcp/server.ts` | MCP server with 12 tools |
| `/src/utils/args.ts` | CLI argument parser |
| `/site/src/App.vue` | Single-file Vue 3 app for docs site |
| `/site/src/style.css` | Brand design system (ink, mint, ember, slate, steel, fog) |
| `/docs/` | Documentation (alias spec, strategy, governance) |
| `/scripts/` | Build, CI, and pre-commit scripts |

---

## Contract Format

Every contract in `/contracts/*.md` has this structure:

```
# Module Contract: `module_name`

**Version:** 0.1.0

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

## System-Level Integrations & Constraints

### Consistency Model
### Algorithm (for infra modules)
### Storage Model
### Observability
### Module Dependencies
```

The parser extracts this into `catalog.json`. The `dist/catalog.min.json` has the stripped version for npm (no invariants, no raw sections, no source paths).

---

## How the Catalog Data Flows

```
contracts/*.md  →  [parser.ts]  →  catalog.json  →  catalog.min.json (stripped)
                                                      ↓
                                            generators, MCP, CLI, docs site
```

The catalog is loaded at runtime by `load-catalog.ts`. It first checks for markdown files (dev mode), then falls back to `dist/catalog.min.json` (npm mode).

---

## Common Tasks

### Adding a new contract
1. Create `contracts/<name>.md` following the format above
2. Include Functions, Types, Invariants at minimum
3. Add System-Level Integrations for production modules
4. Rebuild: `npm run build`

### Adding a new adapter
1. Create `adapters/<module>/<provider>.yaml`
2. List implemented functions in `implements`
3. List explicitly not-implemented functions in `does_not_implement`
4. Add `languages` field listing supported generators

### Modifying the docs site
- Edit `/site/src/App.vue` — single-file app
- Add nav link, add `<template v-if="state.view === 'pageName'>` block, add method
- CSS in `/site/src/style.css`
- Build: `cd site && npx vite build`

### Running tests
```bash
npm test                 # all tests
npm run test:mcp         # MCP server tests only
bash scripts/pre-commit.sh  # full quality gate
```

### Building
```bash
npm run build            # TS compile + catalog generation + stripping + hash
npm run docs             # full build + docs site
```

---

## Key Architecture Decisions

- **Contracts are the single source of truth.** Never hardcode operational info in the docs site. Add it to the contract, parse it, read from `catalog.json`.
- **Security defaults are opt-out, not opt-in.** Generated schemas add audit columns, tenant isolation, RLS by default.
- **Adapters declare language support.** The `languages` field in adapter YAML tells generators whether to generate for that language.
- **The MCP server binds to localhost by default.** Use `--auth-token` for network-accessible deployments.
- **Aliases protect generated code, not the catalog.** The npm package ships a stripped catalog (no function names, invariants, or source paths).

---

## Doc Structure for Agents

When an agent reads the repo to understand a task, follow this order:

1. **AGENTS.md** (this file) — project map and conventions
2. **docs/system-design-strategy.md** — where the project is heading (v0.3.0+)
3. **docs/alias-spec.md** — alias system specification
4. **CONTRIBUTING.md** — how to add contracts and adapters
5. **README.md** — public-facing documentation

For contract modifications, read the existing contract first to match the style (indentation, section ordering, invariants tone).
