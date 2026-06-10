# Feature Boundary: Open vs Paid

**Version:** 0.1.0
**Status:** Decision document

---

## Principle

All contract definitions, the CLI, and the core generation pipeline remain open and freely available. Paid features are those that provide ongoing operational value, hosted infrastructure, or compliance automation that is expensive to maintain as open-source.

## Open (always free)

- Contract markdown files and the module catalog
- Dependency graph, resolver, and search
- CLI: `list`, `inspect`, `graph`, `search`, `resolve`, `build`, `schema`
- Code generation in all 5 languages
- MCP server (12 tools)
- Namespace prefix and file path isolation
- Function, module, class, and config field aliasing
- Pre-commit checks and CI integration scripts
- All documentation and specifications

## Paid / Registered Tier (candidates)

- Hosted runtime verification service (continuous compliance monitoring)
- Contract version mismatch CI service (managed, with dashboard)
- Compliance mapping layer (connecting modules to SOC2, HIPAA, GDPR frameworks)
- Automated alias generation from existing codebase analysis
- Priority support and SLA for contract updates

## Risks

Placing security features behind a paywall creates a perverse incentive: the teams that most need protection (small teams, startups, open-source projects) may skip paid features. All core security features (aliasing, obfuscation, transport security contracts, CSRF, SSRF, brute force protection) remain open for this reason.

## Timeline

| Phase | What | When |
|---|---|---|
| 1 | Open: all current features | Now (v0.2.0) |
| 2 | Open: remaining contract tasks | v0.3.0 |
| 3 | Evaluate: paid tier feasibility | Post v0.3.0 |
