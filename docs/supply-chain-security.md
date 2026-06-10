# Supply Chain Security & Governance

**Version:** 0.1.0
**Status:** Living document

---

## Dependency Pinning

All runtime dependencies in `package.json` use exact versions with lockfiles committed to the repository. The `npm shrinkwrap` or `package-lock.json` file is verified in CI before any build proceeds.

Dependencies are audited monthly for known vulnerabilities using `npm audit`. Critical-severity findings must be resolved within 7 days.

## Publish Pipeline Security

The npm publish step is triggered only from tagged commits on the `main` branch. The following checks run before every publish:

1. `scripts/pre-commit.sh` -- full test suite, strict TS, 5-language generation smoke test
2. `scripts/check-publish.sh` -- verifies package.json fields, version bump, changelog update
3. SHA-256 hash of `dist/catalog.min.json` is embedded in `package.json` (see Task A-3)
4. The hash is verified on CLI startup (`blueprint --version` checks catalog integrity)

## Package Integrity Verification

Consumers can verify they received an unmodified package by:

1. Checking the `blueprint.catalogHash` field in `package.json`
2. Running `openssl sha256 dist/catalog.min.json` and comparing to the embedded hash
3. Verifying the npm provenance attestation: `npm audit signatures`

## Incident Response

If the npm package or GitHub repository is compromised:

1. The `@friehub/blueprint` package will be deprecated immediately on npm
2. A security advisory will be published on the GitHub repository
3. All consumers will be notified via the GitHub security advisory feed
4. A post-mortem will be published within 14 days

## Contact

For supply chain security concerns: open a GitHub issue with the `security` label or email security@friehub.com (coming soon).
