# Contributing

## How to add a new contract

1. Create a `.md` file in `contracts/` following the existing contract structure
2. Include: Functions, Types, Invariants, System-Level Integrations, Dependencies
3. Verify it satisfies the four inclusion rules:
   - Named domain problem (payments, not database transactions)
   - Recurs across at least 3 application types
   - Stable interface across providers
   - More than single-table CRUD
4. Run `bash scripts/pre-commit.sh` to validate parsing

## How to add a new adapter

1. Create a `.yaml` file in `adapters/<module>/`
2. Declare which contract functions are implemented and which are not
3. Include a `languages` field listing supported code generators
4. Run `bash scripts/pre-commit.sh` to validate

## How to add a new generator

1. Create a directory under `src/generators/<language>/`
2. Implement the `LanguageGenerator` interface from `src/generators/types.ts`
3. Register it in `src/cli.ts`
4. Add tests following the pattern in `src/generators/generator.test.ts`

## Running tests

```bash
npm test              # all tests
npm run test:mcp      # MCP server tests only
npm run precommit     # full quality gate
npm run lint          # strict TypeScript check
```

## Pull request process

1. Open a PR with a clear description of what it adds and why
2. Ensure all tests pass and pre-commit checks are green
3. If adding a contract, justify the inclusion against the four rules
4. If adding an adapter, include or explain absence of `does_not_implement` entries
5. Maintainers will review within 5 business days
