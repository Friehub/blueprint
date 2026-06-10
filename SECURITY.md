# Security Policy

## Reporting a Vulnerability

Blueprint generates backend infrastructure code. A vulnerability in the catalog definitions or the generation pipeline could affect all projects built with it.

If you discover a security issue, please report it privately before disclosing it publicly.

**Contact:** Open a GitHub issue with the `security` label, or email security@friehub.com.

Do not report security issues via public GitHub issues, discussions, or pull requests.

## Response Timeline

- Acknowledgement within 3 business days
- Status update within 7 days
- Fix published within 90 days for critical/high severity issues

## What to include

- A description of the vulnerability
- Steps to reproduce
- Affected versions
- Any proposed fix (optional)

## Scope

The following are in scope for security reports:

- Contract definition flaws that could lead to insecure generated code
- Exposure of sensitive data through the npm package or CLI
- Authentication or authorization bypass in the MCP server
- Supply chain integrity issues in the build or publish pipeline

## Out of scope

- Vulnerabilities in generated code itself (generated code is a starting point, not a finished product)
- Dependency vulnerabilities that are already tracked by npm audit
- Theoretical attacks without a concrete reproduction path
