We just open-sourced Blueprint.

162 backend contracts. 83 provider adapters. 5 code generators (TypeScript, Python, Go, Rust, Java). 12 MCP tools for AI agents. All MIT.

The idea is simple: every backend needs payments, auth, notifications, caching, and queues. The implementations differ across providers, but the interface stays the same. Stripe and Paystack both process payments. Twilio and Vonage both send SMS. Redis and Memcached both cache data.

Blueprint captures that interface once. One contract for payments that Stripe, Paystack, and Adyen all implement. The same contract generates typed interfaces in TypeScript, Python, Go, Rust, and Java.

Why this matters for engineering leaders:

1. **Provider independence.** Switching from Stripe to Paystack means changing one line in adapter selection, not rewriting business logic. The contract stays the same.

2. **Transparent dependencies.** Selecting billing automatically resolves payments, users, notifications, audit_log, and usage_metering. You see the full dependency graph before committing to implementation.

3. **AI agent integration.** 12 MCP tools let AI agents query contracts, resolve dependencies, retrieve sagas, and validate implementations. An agent can design a checkout flow, implement it against Stripe, and verify compliance against the contract.

4. **Name protection.** --namespace, --aliases, and --obfuscate flags prevent generic name scanning and code fingerprinting in production builds.

5. **Security-hardened shipping.** The npm package ships a stripped catalog with no raw contracts, no function signatures, and an integrity hash verified at startup.

We built this because every team we know has re-implemented payments, auth, and notifications at least twice. Some teams have done it five times across different projects and languages. That knowledge should live in one place, not scattered across codebases.

Blueprint is that place.

npm install -g @friehub/blueprint
blueprint list
blueprint inspect payments
blueprint generate --lang typescript

Docs: blueprint.friehub.cloud
GitHub: github.com/Friehub/blueprint
MIT license. Open source. No ambiguity.
