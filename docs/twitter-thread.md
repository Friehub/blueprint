1/ We just open-sourced Blueprint.

162 backend contracts. 83 adapters. 5 code generators. 12 MCP tools for AI agents.

One interface for payments whether you use Stripe, Paystack, or Adyen.

MIT. github.com/Friehub/blueprint

2/ The problem: every backend needs payments, auth, notifications, caching. Every team builds them differently. Every time you switch providers, you rewrite.

An AI agent asked to implement payments has no reference for what initiatePayment must guarantee. It guesses.

3/ Blueprint defines the interface once. One contract for payments that Stripe, Paystack, and Adyen all satisfy. Same contract generates code in TypeScript, Python, Go, Rust, and Java.

4/ The resolver walks transitive dependencies. Selecting billing automatically pulls in payments, users, notifications, audit_log, and usage_metering. You see the true cost before you write a line of code.

5/ 12 MCP tools for AI agents. Claude Desktop, Cursor, or Copilot can query contracts, resolve deps, retrieve sagas, and validate implementations directly over stdio.

"Design a checkout flow with fraud detection" → the agent picks modules, resolves deps, shows the saga, lists adapters.

6/ Name protection built in. --namespace to prefix identifiers. --aliases to rename everything via a JSON5 file. --obfuscate to replace all names with deterministic hashes from a secret seed.

7/ The npm package ships 51 files, 62KB compressed. No raw contracts. No function signatures in the shipped catalog. SHA-256 hash verified on CLI startup.

8/ Quick start:

npm install -g @friehub/blueprint
blueprint list
blueprint inspect payments
blueprint generate --lang typescript

Full docs at blueprint.friehub.cloud

MIT. Open source. No ambiguity.
