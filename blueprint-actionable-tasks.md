# Blueprint — Actionable Task List
## Derived from the Security & Feature Gap Report and the Protection Guide

**Total tasks:** 54
**Completed:** 13 (Section A all, Section B all)
**Pending:** 41 (C-1 through C-13, D-1 through D-11)
**Format:** Each task carries an owner, a priority tier, a clear definition of done, and enough context to execute without reading the source documents.

Priority tiers: **P0 — Critical / ship blocker** · **P1 — High / next release** · **P2 — Medium / planned** · **P3 — Low / backlog**

---

## Section A — Package Hygiene (What Ships in the npm Package)

These tasks fix what is currently exposed to anyone who installs `engineering-blueprint` from npm. They have no dependencies on new features and can all be done before the next publish.

---

### Task A-1 — Remove raw contract files from the published package ✅ DONE
**Priority:** P0
**Owner:** Package maintainer
**File to change:** `.npmignore`

The current `.npmignore` file contains a line that explicitly overrides the general markdown exclusion rule, causing all 133 contract files to be included in every npm install. This means anyone who installs the package can read the exact function names, error codes, lockout durations, state machines, and provider hints for every module in the catalog, directly from their `node_modules` folder.

The fix is to remove the two contract-exception lines from `.npmignore`. The contracts will remain available in the public GitHub repository for developers who need to read them. What they do not need is those files sitting inside the installed package on every developer's machine and every CI server that runs `npm install`.

**Definition of done:** After running the equivalent of a publish dry-run, the resulting package tarball contains no files under the `contracts/` directory. The README and CHANGELOG continue to ship. All other exclusion rules remain unchanged.

---

### Task A-2 — Strip sensitive fields from catalog.json before publishing ✅ DONE
**Priority:** P0
**Owner:** Build pipeline / package maintainer
**File to create:** `scripts/strip-catalog.cjs`

`catalog.json` is the parsed, machine-readable version of every contract in the catalog. It currently contains the full function names and parameter names for all 108 modules, the complete type definition strings for every type, the full invariant prose for every contract, raw section content from each markdown file, the names of all recommended providers and integrations, and the absolute file paths from the developer's local machine where the contracts were parsed.

All of that is more dangerous than the markdown files because it can be consumed programmatically at scale. An attacker who parses `catalog.json` gets a structured index of every method name, every event topic, every error code, and every adapter config field across the entire system — without reading any documentation.

A pre-publish script should produce a second artifact, `catalog.min.json`, which retains only what the runtime genuinely needs: module names, contract version numbers, hard and soft dependency edges, and adapter compatibility declarations. The full `catalog.json` stays in the repository for development use. The published package references only `catalog.min.json`.

The fields to strip from the published artifact are: all function definitions and their parameters, all type raw definitions, all invariant arrays, all rawSections content, all integrations arrays, and all source file path references.

**Definition of done:** The published package contains `catalog.min.json` with no function names, no type definitions, no invariants, and no source paths. The CLI and all runtime features continue to work correctly against this reduced catalog. The full `catalog.json` is present in the repository but excluded from the npm tarball.

---

### Task A-3 — Add a catalog integrity hash to package.json ✅ DONE
**Priority:** P1
**Owner:** Build pipeline / package maintainer

After `catalog.min.json` is produced by the strip-catalog script, the publish pipeline should compute a SHA-256 hash of the file and embed it as a field in `package.json` before publishing. This creates a tamper-evident seal between the version of the catalog that was tested and the version that gets installed by users.

When the CLI starts up for the first time after installation, it should verify that the hash of the installed `catalog.min.json` matches the hash recorded in `package.json`. If there is a mismatch — which would indicate the catalog was modified after publishing, either through a supply chain compromise or an accidental overwrite — the CLI should refuse to operate and instruct the user to reinstall a clean copy of the package.

This does not prevent a determined attacker from reading the catalog, but it does catch the scenario where an attacker or a corrupted registry has replaced the catalog with a modified version containing backdoored function definitions or altered dependency edges.

**Definition of done:** The publish pipeline writes a hash field to `package.json` as part of the release process. The CLI verifies this hash on startup and exits with a clear error message if the verification fails. The hash field is documented in the project's internal architecture notes.

---

### Task A-4 — Scope .env.example to selected adapters only ✅ DONE
**Priority:** P1
**Owner:** Generator / prototype scaffold
**File affected:** `my-saas/.env.example` generation logic

The current `.env.example` file lists credential variable names for all 83 adapters simultaneously, regardless of which adapters a project has actually selected. This creates an unnecessary map of every external service the entire catalog integrates with, which reveals the full set of services Blueprint supports even to someone who only intends to use three of them.

The `.env.example` should be generated dynamically based on whatever adapters are declared in the project's `blueprint.json`. A project using only Redis, Stripe, and Clerk should see only the environment variable names for those three adapters, nothing else. The generation should be triggered by `blueprint prototype` and should re-run automatically whenever `blueprint.json` is updated.

A clear warning comment should be added to the top of the generated file stating that it must never be committed with real values, must be added to `.gitignore` if it contains anything beyond placeholder text, and must never be included in any generated SDK, package, or deployable artifact.

**Definition of done:** Running `blueprint prototype` with a `blueprint.json` that declares three adapters produces an `.env.example` containing only the variable names for those three adapters. The file contains a prominent warning comment at the top. The full 83-adapter list is never generated for any project configuration.

---

### Task A-5 — Remove Blueprint attribution from generated file headers ✅ DONE
**Priority:** P1
**Owner:** Generator (all five language generators)
**Files affected:** TypeScript, Python, Go, Rust, and Java generators

Every file generated by Blueprint currently opens with a comment that names the source contract file, the contract version, and the generator tool. For example, a generated auth interface opens by explicitly stating it came from `contracts/auth.md` at version `0.1.0` and was auto-generated by the Blueprint tool.

This is a complete fingerprint. Anyone who reads a generated source file — or obtains it through a repository breach, a build artifact leak, or a public GitHub repository — immediately knows the project was built with Blueprint, which module the file implements, and which version of the contract it was generated from. From there they can look up the corresponding contract to understand the full function set, error taxonomy, and behavioural invariants.

The attribution comment should be replaced with a neutral, project-agnostic comment that provides no information about the tool or the contract. The contract provenance should be tracked separately in internal CI metadata, not embedded in the generated source files themselves.

**Definition of done:** No generated file in any of the five supported languages contains the strings `contracts/`, `Auto-generated from`, `blueprint`, or any contract version reference in its header comment. The replacement comment is neutral and contains no information useful for fingerprinting.

---

## Section B — Generator Features (Protecting the Generated Code)

These tasks add new capabilities to the `blueprint generate` command that allow developers to produce code that does not expose Blueprint's naming conventions.

---

### Task B-1 — Design the blueprint.aliases.json specification ✅ DONE
**Priority:** P1
**Owner:** Core team / spec author

Before any aliasing code is written, the alias configuration format needs to be fully specified as a document. This task is the design work, not the implementation.

The specification must cover four aliasing dimensions: function aliases (mapping contract function names to project-specific names), module aliases (mapping contract module names to project-specific module names), class aliases (mapping generated class names like StripeAdapter to project-specific names), and config field aliases (mapping adapter constructor config keys to project-specific environment variable names).

The specification must address how the alias map is loaded (from a separate `blueprint.aliases.json` file, not the main `blueprint.json`), how it is merged with the main configuration at generation time, how partial aliases work (some functions aliased, others left at their contract names), what happens when an alias map references a function name that does not exist in the current catalog version, and how the `blueprint verify` command reverses the alias map to validate the generated implementation against the original contract.

The spec should also define which aspects of aliasing are in scope for the open version and which, if any, are reserved for a paid tier.

**Definition of done:** A written specification document exists covering all four aliasing dimensions, the file format, the merge behaviour, the error handling for unknown function names, and the verify reversal logic. The specification has been reviewed and is ready to hand to an implementer.

---

### Task B-2 — Implement function name aliasing in the TypeScript generator ✅ DONE
**Priority:** P1
**Owner:** TypeScript generator
**Depends on:** Task B-1

When a `blueprint.aliases.json` file is present and loaded, the TypeScript generator must substitute every contract function name with its aliased name in all generated output — interfaces, adapter classes, and conformance tests. The substitution must be complete and consistent: if `signIn` is aliased to `authenticate`, then every occurrence of `signIn` across every generated file must become `authenticate`, with no partial substitutions.

The internal mapping between the alias and the original contract function name must be preserved somewhere accessible to the `blueprint verify` command so that verification can function correctly. The alias map is a presentation-layer concern; the underlying contract is unchanged.

Generated interfaces must use the aliased names in their method signatures. Generated adapter classes must implement those aliased methods. Generated test files must call the aliased method names in their assertions. No generated file should contain the original contract function name after aliasing is applied.

**Definition of done:** With a populated `blueprint.aliases.json`, running `blueprint generate --lang typescript` produces files where every aliased function name appears under the new name and the original contract name does not appear anywhere in the generated output. Running `blueprint verify` against the aliased implementation still reports correct compliance against the original contract.

---

### Task B-3 — Implement function name aliasing in the Python, Go, Rust, and Java generators ✅ DONE
**Priority:** P2
**Owner:** Language generator owners
**Depends on:** Task B-2

The same aliasing logic implemented for TypeScript in Task B-2 must be applied to the other four language generators. Each language has its own naming conventions (Python uses snake_case, Go uses PascalCase for exported names, Rust uses snake_case, Java uses camelCase), so the aliasing layer must apply aliases consistently within each language's conventions rather than forcing the user to define separate aliases per language.

If the user provides an alias like `signIn → authenticate`, the TypeScript generator should produce `authenticate`, the Python generator should produce `authenticate`, the Go generator should produce `Authenticate` for exported symbols, and the Java generator should produce `authenticate`. The user defines the alias once; each generator applies the appropriate case transformation.

**Definition of done:** All five language generators apply aliases from `blueprint.aliases.json` in a way that is idiomatic for each language. A single alias definition works correctly across all five generators without per-language duplication.

---

### Task B-4 — Implement module and class name aliasing ✅ DONE
**Priority:** P2
**Owner:** Generator engine
**Depends on:** Task B-2

Beyond function names, the module name and class name are both fingerprints. A file named `auth.ts` containing a class named `ClerkAdapter` that implements `AuthContract` exposes the module name, the provider name, and the contract name simultaneously.

Module aliasing should affect generated file paths, interface names, and import statements. If `auth` is aliased to `identity`, the generated interface should be in a file named `identity.ts`, the interface should be named `IdentityContract`, and all import statements in other generated files should reference `identity`, not `auth`.

Class aliasing should replace generated adapter class names entirely. If `ClerkAdapter` is aliased to `IdentityProvider`, the class declaration, all instantiation sites in generated tests, and all import references should use `IdentityProvider`.

**Definition of done:** With module and class aliases configured, no generated file contains the original module name or the original adapter class name in its file path, class declaration, interface name, or import statements.

---

### Task B-5 — Implement config field aliasing in adapter constructors ✅ DONE
**Priority:** P2
**Owner:** Generator engine
**Depends on:** Task B-1

Adapter constructor config field names are as revealing as function names. The field names `api_key`, `webhook_secret`, and `publishable_key` are recognisably Stripe and Clerk vocabulary regardless of what the containing class is named.

Config field aliasing should replace the constructor parameter names and corresponding environment variable suggestions in generated adapters with the names specified in the alias map. The aliased names apply in the constructor signature, in any generated setup documentation, and in the scoped `.env.example` that Task A-4 produces.

The aliasing applies only to the generated output. The adapter's internal logic that reads those config fields and passes them to the underlying SDK must continue to work correctly regardless of what the fields are named externally.

**Definition of done:** With config field aliases configured, the generated adapter constructor uses only the aliased field names. The scoped `.env.example` uses the aliased environment variable names. The underlying SDK integration continues to function correctly.

---

### Task B-6 — Implement the --obfuscate flag in the generator engine ✅ DONE
**Priority:** P2
**Owner:** Generator engine
**Depends on:** Task B-1

Some teams will not want to maintain a manual alias map. For them, the generator should offer an automatic obfuscation mode that derives stable, opaque identifiers from a project-specific secret seed rather than readable aliases.

The obfuscation flag takes a seed value as input. The seed is combined with each contract function name using a deterministic keyed hash function, and the resulting identifier is used as the function name in all generated output. Because the hash is deterministic, the same seed always produces the same identifiers for the same function names, making the generated code stable and reproducible across CI runs and team members without requiring anyone to manage an explicit alias map.

The seed itself is a secret. It must be stored in the project's secrets manager and injected into the generation command at CI time, never committed to version control. The `blueprint.aliases.json` file is not used in obfuscation mode; the seed replaces it.

The `blueprint verify` command must accept the same seed and use it to reverse the obfuscation when checking compliance against the original contract.

**Definition of done:** Running the generate command with the obfuscation flag and a seed produces generated files where no function name, class name, or module name is recognisable as a Blueprint identifier. Providing the same seed again produces identical output. Running verify with the same seed passes. The seed is never written to any generated file.

---

### Task B-7 — Extend --namespace to cover file paths, not just class names ✅ DONE
**Priority:** P2
**Owner:** Generator engine

The existing `--namespace` flag prefixes class and interface names but does not affect generated file paths. A generated file that lives at `adapters/auth/clerk.ts` still exposes the module name (`auth`) and the adapter name (`clerk`) in its path, even if the class inside it has been prefixed with the namespace.

The namespace flag should be extended so that it also determines the directory structure of generated output. With a namespace of `acme`, generated files should live under a path structure that reflects the namespace rather than the raw contract module names. This prevents directory listings from revealing which Blueprint modules a project has implemented.

**Definition of done:** With a namespace specified, the generated file paths do not contain the original contract module names or adapter names. The namespace is consistently reflected in both the file paths and the type names within those files.

---

### Task B-8 — Make blueprint verify perform alias-aware validation ✅ DONE
**Priority:** P1
**Owner:** Verify command
**Depends on:** Task B-2

The `blueprint verify` command currently checks that an implementation file satisfies the contract's function list by name. Once aliasing is in use, the implementation will contain aliased names, not contract names, so the current verification logic will fail on any aliased implementation even if it is fully compliant.

The verify command must be updated to load the alias map if one is present and reverse-map all aliased function names back to their original contract names before running the compliance check. A function named `authenticate` in the implementation should be recognised as satisfying the `signIn` contract requirement if the alias map declares that mapping.

In obfuscation mode, the verify command must accept the seed and perform the reverse hash derivation to map obfuscated identifiers back to contract function names before checking compliance.

**Definition of done:** Running `blueprint verify` against an implementation that uses aliases or obfuscated names reports correct compliance results. A fully compliant aliased implementation passes verification. A non-compliant aliased implementation fails verification with a message that names the missing contract function using both its contract name and its aliased name.

---

## Section C — Contract Gaps (New Contracts to Write)

Each task in this section is a new contract document that must be written and added to the `contracts/` directory, following the same structure as existing contracts: functions, types, invariants, system-level integrations, dependencies, and observability.

---

### Task C-1 — Write the transport_security section in core/global_standards.md
**Priority:** P0
**Owner:** Contract author
**File:** `contracts/core/global_standards.md`

No existing contract, in the global standards or in any module, requires that communication be encrypted in transit. A backend that satisfies every contract in the catalog could legally serve all traffic over plain HTTP. This is the most fundamental security gap in the entire catalog.

A new section in `global_standards.md` must establish the following as universal requirements that every module inherits: all external-facing endpoints must be served exclusively over TLS, the minimum acceptable TLS version must be specified, HTTP must either be disabled entirely or redirect unconditionally to HTTPS, all inter-service communication within the same deployment must use at minimum TLS and ideally mutual TLS, and HSTS with a defined minimum max-age must be enforced on all browser-facing endpoints.

The section should also specify what happens when a module cannot satisfy these requirements — for example, a module that runs in a private network where TLS termination happens at the load balancer — and how that exception must be declared.

**Definition of done:** `global_standards.md` contains a Transport Security section that establishes TLS as a universal requirement, specifies minimum version and HSTS requirements, addresses inter-service mTLS, and defines the exception declaration process. All existing modules inherit this section by default.

---

### Task C-2 — Write the http_security_headers contract
**Priority:** P1
**Owner:** Contract author
**File:** `contracts/http_security_headers.md`

No contract anywhere specifies which HTTP security headers a generated backend must send. An AI agent implementing from Blueprint contracts would have no guidance to set Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or Permissions-Policy. All of these are standard defences against well-understood browser-based attacks.

The new contract should define the minimum required headers, the values or value patterns that satisfy the requirement for each header, the distinction between API-only endpoints (which do not need CSP but do need CORS headers) and browser-facing endpoints (which need the full set), and the behaviour for endpoints that serve both.

The contract must also cover CORS policy: which origins are allowed, whether credentials are permitted, which methods are allowed, and what the maximum preflight cache duration should be. Currently no contract addresses CORS at all.

**Definition of done:** A `contracts/http_security_headers.md` contract exists that specifies required headers, acceptable values, the API versus browser endpoint distinction, and CORS policy requirements. The contract declares dependencies on `auth` and `sessions` and is listed in the module catalog.

---

### Task C-3 — Write CSRF protection invariants into auth and sessions contracts
**Priority:** P1
**Owner:** Contract author
**Files:** `contracts/auth.md`, `contracts/sessions.md`

No contract addresses Cross-Site Request Forgery. Session tokens are defined in the `auth` and `sessions` contracts but neither says anything about how those tokens should be transmitted, what cookie attributes must be set, or how state-mutating requests must be protected from cross-site replay.

New invariants must be added to both contracts. The `sessions` contract should specify that session cookies must use the SameSite attribute set to Strict or Lax, must use the HttpOnly attribute, and must use the Secure attribute when served over HTTPS. The `auth` contract should specify that any state-mutating function callable via a browser session must require a CSRF token or equivalent double-submit mechanism in addition to the session token.

The invariants must be specific enough that an implementation either satisfies them or does not — vague statements like "CSRF should be considered" are not acceptable contract language.

**Definition of done:** Both contracts contain new invariants covering cookie attributes for session tokens and CSRF token requirements for state-mutating browser-facing endpoints. The invariants are specific, testable, and written in the same style as existing invariants in those contracts.

---

### Task C-4 — Write the request_validation contract
**Priority:** P1
**Owner:** Contract author
**File:** `contracts/request_validation.md`

The `config_schema` contract validates configuration values, but there is no contract governing how incoming request payloads must be validated before they reach any module function. The global standards define a `validation_error` error code but say nothing about what validation must occur to produce that error.

The new contract should define the universal requirements for request-level validation: every module function that accepts external input must validate payload size against a declared maximum before processing, every string field must be validated against an allowed character set appropriate to its expected content, structured inputs must be validated against their declared type before any business logic runs, and any input that fails validation must be rejected with a `validation_error` before it touches the database, cache, or any downstream service.

The contract should also specify the injection-prevention requirements: inputs that will be used in database queries, shell commands, template rendering, or XML/HTML output must pass through the appropriate context-aware escaping or parameterisation layer. The contract does not specify the implementation mechanism — prepared statements, an ORM, a template engine — but it does require that one is used and that it is declared in the adapter.

**Definition of done:** A `contracts/request_validation.md` contract exists and is added to the catalog. It defines functions, types, and invariants covering payload size limits, type coercion, character set validation, and injection-prevention requirements. The contract is referenced from `global_standards.md` as a universally inherited standard.

---

### Task C-5 — Write the bot_protection contract
**Priority:** P1
**Owner:** Contract author
**File:** `contracts/bot_protection.md`

The `fraud_detection` module scores logins and transactions, and `rate_limiting` throttles per-key requests, but neither module owns the problem of distinguishing automated bot traffic from human traffic. High-value flows — account registration, password reset, payment initiation, coupon redemption — have no contract governing bot challenge requirements.

The new contract should define the functions needed to issue a challenge, verify a challenge response, score a request for automation probability, and configure which endpoints require challenges. It should define the types for different challenge methods — CAPTCHA, invisible challenge, proof-of-work — and the invariants that must hold: a challenge must be required for account creation when the request has not been scored as human, a failed challenge response must not advance the underlying operation, and challenge bypass must not be possible through replay of a previously valid challenge token.

The contract must declare its dependency on `rate_limiting` and `fraud_detection` and specify how bot protection integrates with the existing brute force controls in the `auth` contract.

**Definition of done:** A `contracts/bot_protection.md` contract exists covering challenge issuance, challenge verification, automation scoring, and endpoint configuration. It integrates coherently with `rate_limiting` and `fraud_detection` and is added to the module catalog.

---

### Task C-6 — Write SSRF prevention invariants into webhooks, storage, and media contracts
**Priority:** P1
**Owner:** Contract author
**Files:** `contracts/webhooks.md`, `contracts/storage.md`, `contracts/media.md`

Server-Side Request Forgery is entirely unaddressed across the three contracts that accept arbitrary external URLs from users. An attacker who can register a webhook endpoint pointing to an internal service, or upload a media file that redirects to an internal URL, can use the backend as a proxy to reach otherwise inaccessible internal services.

Each of the three contracts must gain new invariants covering URL acceptance: any URL submitted for webhook registration, signed upload, or media processing must be validated against a configured allowlist of permitted domains or CIDR ranges before the URL is used, any URL that resolves to a private IP address range or a cloud metadata endpoint must be rejected unconditionally, and redirect following must either be disabled or constrained to the original allowed domain.

Additionally, `webhooks.md` must add an invariant requiring that a webhook secret is mandatory — registering an endpoint without providing a secret must be rejected, not silently accepted.

**Definition of done:** All three contracts contain new invariants specifying URL validation requirements, private IP blocking, and metadata endpoint protection. The `webhooks` contract contains a mandatory secret invariant. All changes are written in the same invariant style as existing contract invariants.

---

### Task C-7 — Write the brute_force_protection section in global_standards.md
**Priority:** P1
**Owner:** Contract author
**File:** `contracts/core/global_standards.md`

The `auth` contract addresses brute force only for the sign-in function. Every other credential-checking function in the catalog — API key validation, TOTP verification, password reset token submission, recovery code use, and backup code use — has no standardised brute force protection requirement.

A new section in `global_standards.md` should establish brute force protection as a universal requirement for all credential-checking functions across the catalog. The section must specify: the maximum number of failed attempts permitted within a rolling time window, the lockout duration after the threshold is exceeded, the notification requirement when a lockout is triggered, the behaviour for distributed attacks that spread attempts across IP addresses, and the administrator override path for unlocking a locked account.

The section must be specific enough to be testable. It should define what counts as a credential-checking function so that contract authors writing new modules know whether their functions inherit this requirement.

**Definition of done:** `global_standards.md` contains a Brute Force Protection section that applies universally to all credential-checking functions, specifies attempt limits, lockout durations, notification requirements, and the administrator override. Existing contracts whose functions are in scope are updated to explicitly inherit this section.

---

### Task C-8 — Write the ddos_mitigation section in core/runtime_standards.md
**Priority:** P2
**Owner:** Contract author
**File:** `contracts/core/runtime_standards.md`

The existing `load_shedding` and `rate_limiting` contracts both assume the attacker is an authenticated or at least identifiable caller. Neither addresses volumetric attacks from unauthenticated sources — connection floods, amplification attacks, or traffic spikes that arrive before any request can be authenticated.

A new section in `runtime_standards.md` should declare the perimeter defence requirements that all deployments must satisfy: the module must declare whether it relies on a managed DDoS mitigation layer or implements its own, the module must specify its behaviour when the mitigation layer is unavailable, and any module that exposes a publicly reachable endpoint must declare its maximum acceptable unauthenticated request rate.

The section should integrate with the existing `rate_limiting` contract by defining the unauthenticated tier — requests that have not yet proven identity — as a distinct and more aggressive rate limit scope.

**Definition of done:** `runtime_standards.md` contains a DDoS Mitigation section that covers perimeter defence declaration requirements, unauthenticated request rate limits, and integration with the existing `rate_limiting` contract.

---

### Task C-9 — Write the ip_blocklist contract
**Priority:** P2
**Owner:** Contract author
**File:** `contracts/ip_blocklist.md`

The `ip_intelligence` contract can identify threats associated with an IP address but provides no mechanism for acting on that intelligence by blocking specific addresses, ranges, or autonomous systems. There is no contract that defines how a blocklist is managed, how entries are added and removed, how the blocklist is enforced at the request level, or how blocklist state is propagated across regions.

The new contract should define functions for adding single IPs, CIDR ranges, and ASN entries to the blocklist, removing entries, checking whether a given IP is blocked, listing active entries with their reasons and expiry times, and bulk-importing threat intelligence feeds. It should define the types for entries, expiry behaviour, and enforcement modes, and the invariants that must hold — a blocked IP must be rejected before any authentication or business logic runs.

**Definition of done:** A `contracts/ip_blocklist.md` contract exists covering blocklist management, enforcement, and feed ingestion. It declares a dependency on `ip_intelligence` and `rate_limiting` and is added to the catalog.

---

### Task C-10 — Write the session_fixation_prevention invariants
**Priority:** P1
**Owner:** Contract author
**Files:** `contracts/auth.md`, `contracts/sessions.md`

Session fixation is a well-understood attack in which an attacker pre-sets a session identifier and tricks a victim into authenticating with that identifier, giving the attacker a valid authenticated session. No contract in the catalog addresses this.

New invariants must be added to the `sessions` contract requiring that any session created before authentication is completed must be invalidated and replaced with a new session identifier at the moment authentication succeeds. The same requirement applies at every privilege escalation point: when MFA is completed, when a role is elevated, and when a user switches between tenants or workspaces.

The `auth` contract must reference these session regeneration requirements and declare that the completion of any authentication step that elevates privilege must trigger a new session identifier, not reuse the pre-authentication session.

**Definition of done:** Both contracts contain invariants that explicitly require session identifier regeneration at authentication completion and at every privilege escalation event. The invariants define what constitutes a privilege escalation for the purposes of this requirement.

---

### Task C-11 — Write the credential_rotation_policy contract
**Priority:** P2
**Owner:** Contract author
**File:** `contracts/credential_rotation_policy.md`

The `secrets` contract defines how individual secrets are rotated on demand or on schedule. However, there is no contract that governs the rotation policy for adapter credentials — the API keys, webhook secrets, and service tokens that are configured as environment variables and listed in `.env.example`. These credentials are long-lived by default and often never rotated until a breach occurs.

The new contract should define the maximum acceptable lifetime for different credential types before rotation is required, the mechanism for rotating credentials without causing downtime (grace period during which both old and new credentials are accepted), the notification requirements when credentials are approaching expiry, the incident response requirements when a credential is suspected of compromise, and the audit requirements for tracking rotation history.

**Definition of done:** A `contracts/credential_rotation_policy.md` contract exists covering credential lifetime limits, zero-downtime rotation mechanics, expiry notifications, and compromise response. It integrates with the existing `secrets` contract and is added to the catalog.

---

### Task C-12 — Write the vulnerability_disclosure contract
**Priority:** P2
**Owner:** Contract author
**File:** `contracts/vulnerability_disclosure.md`

There is a `developer_portal` contract for managing external developer access, but no contract for how security researchers should report vulnerabilities, how reports should be routed and tracked, what the response timeline commitments are, or how credits and CVE assignments are handled. This gap means backends built from Blueprint have no standardised security contact surface.

The new contract should define functions for submitting a vulnerability report, acknowledging receipt, updating report status, issuing a CVE identifier, publishing a security advisory, and notifying the reporter of a fix. It should define the response timeline invariants: acknowledgement within a specified window, status updates at defined intervals, and a maximum time from report to published fix or formal rejection.

**Definition of done:** A `contracts/vulnerability_disclosure.md` contract exists covering the full disclosure lifecycle. It declares a dependency on `notifications` and `audit_log` and is added to the catalog.

---

### Task C-13 — Write the zero_trust_network_policy contract
**Priority:** P2
**Owner:** Contract author
**File:** `contracts/zero_trust_network_policy.md`

Inter-service calls in the blueprint are authenticated at the application layer using API keys or session tokens, but there is no contract governing network-layer identity for calls between modules in the same deployment. A compromised module could call any other module on the internal network without any network-layer authentication requirement.

The new contract should define the requirements for service-to-service authentication: each service must present a verifiable identity for every call to another service, the acceptable identity mechanisms must be declared (mTLS client certificates, signed JWTs with service identity claims, or equivalent), the service identity registry must be defined, and the requirements for rotating service identities must be specified.

**Definition of done:** A `contracts/zero_trust_network_policy.md` contract exists defining service identity requirements, acceptable mechanisms, the identity registry, and rotation requirements. It integrates with the `service_mesh` contract and is added to the catalog.

---

## Section D — Existing Contract Updates

These tasks amend specific existing contracts with new invariants, types, or functions to close the security gaps identified in the report.

---

### Task D-1 — Add account enumeration prevention invariants to the auth contract
**Priority:** P1
**Owner:** Contract author
**File:** `contracts/auth.md`

The `signIn` and `signUp` functions have no invariants preventing account existence disclosure. A timing difference between "email not found" and "password incorrect" in `signIn` leaks which accounts exist. A specific error on `signUp` that reveals an email is already registered leaks account existence. Neither is addressed.

Add invariants to both functions. `signIn` must return the same error with the same response timing whether the failure reason is an unknown email or a wrong password. `signUp` must return a generic success response whether or not the email already exists in the system, with any follow-up action handled out-of-band. Both functions must use a constant-time comparison for credential validation so that execution time does not leak information about which check failed first.

**Definition of done:** The `auth` contract contains new invariants on `signIn` and `signUp` covering identical error responses for all authentication failure reasons, constant-time comparison requirements, and the generic success response for `signUp` regardless of email existence.

---

### Task D-2 — Add MFA enforcement to the auth contract's signIn flow
**Priority:** P0
**Owner:** Contract author
**Files:** `contracts/auth.md`, `contracts/sessions.md`

The `security_settings` contract allows users to enable MFA, but the `auth.signIn` function has no invariant that enforces MFA before issuing a complete session. An implementation that satisfies both contracts as currently written could issue full sessions to users who have MFA enabled without requiring them to complete the second factor.

A new intermediate session state — representing authentication that has passed the first factor but not yet completed the second — must be defined in the `sessions` contract. The `auth.signIn` invariant must state that when a user has MFA enabled, the function must return this intermediate state rather than a full session, and no operation that requires an authenticated session may proceed until the second factor is completed and the session is promoted to the full state.

**Definition of done:** The `sessions` contract defines the intermediate post-first-factor session state. The `auth` contract has an invariant requiring that `signIn` returns this intermediate state for MFA-enabled accounts and that a separate MFA-completion step must be called before a full session is issued.

---

### Task D-3 — Add session anomaly detection integration to the sessions contract
**Priority:** P2
**Owner:** Contract author
**File:** `contracts/sessions.md`

The `sessions` contract accepts device information at session creation but has no invariant requiring that this information be used to detect anomalies during the session's lifetime. A session token used from a significantly different IP, country, or device from the one it was created on has no contract-defined response.

Add a `suspicious` flag to the `Session` type and add an invariant stating that when a request arrives using a session token and the request context differs materially from the session's creation context, the module must set the `suspicious` flag and emit an event that the `security_monitoring` and `fraud_detection` modules can consume. The contract must define what constitutes a material difference — country change, device class change, simultaneous use from two geographically distant locations — as a configurable policy.

**Definition of done:** The `Session` type includes a `suspicious` field. New invariants define when the flag must be set. The contract declares a recommended integration with `security_monitoring` and `fraud_detection` for anomaly response.

---

### Task D-4 — Add key strength and storage algorithm requirements to the api_keys contract
**Priority:** P1
**Owner:** Contract author
**File:** `contracts/api_keys.md`

The `api_keys` contract requires that raw keys are shown only once and never stored in plaintext, but it specifies nothing about the minimum length, the encoding format, the prefix scheme, or the hashing algorithm used for storage. An implementation generating 8-character keys satisfies the contract.

Add invariants specifying: the minimum entropy of generated keys (a concrete bit count, not a vague guideline), the required encoding format, a mandatory prefix scheme so that different credential types are programmatically distinguishable and so that scanners like GitHub's secret scanning can identify accidentally committed keys, and the specific hashing algorithm acceptable for storing key material — a slow, key-stretching algorithm is required, not a fast hash.

**Definition of done:** The `api_keys` contract contains invariants specifying minimum key entropy, encoding format, prefix requirements, and the acceptable range of storage hash algorithms.

---

### Task D-5 — Add mandatory secret and replay protection to the webhooks contract
**Priority:** P1
**Owner:** Contract author
**File:** `contracts/webhooks.md`

The `webhooks` contract requires HMAC-SHA256 signing but does not require that a secret be provided at endpoint registration. An endpoint registered without a secret receives unsigned payloads. There is also no timestamp tolerance window or replay prevention mechanism specified.

Add three invariants: first, that endpoint registration must be rejected if no secret is provided; second, that every dispatched payload must include a canonical timestamp in the signature input; and third, that the receiver must reject any delivery where the timestamp in the signature is older than a defined maximum age (making replay attacks with captured valid signatures ineffective after that window passes).

**Definition of done:** The `webhooks` contract has invariants making the endpoint secret mandatory at registration, requiring a timestamp in the signing input, and specifying the maximum age tolerance for signature verification.

---

### Task D-6 — Add caller authentication prerequisite to the secrets contract
**Priority:** P1
**Owner:** Contract author
**File:** `contracts/secrets.md`

The `secrets` contract requires a `SecretGrant` for `getSecretValue` but does not specify that the caller must prove their identity before the grant check runs. An unauthenticated caller who receives an `ACCESS_DENIED` error rather than an `UNAUTHENTICATED` error learns that the grant check ran, which confirms the secret exists.

Add a prerequisite invariant to `getSecretValue` and to all other functions that evaluate grants: the caller must present a verifiable identity token before any grant evaluation occurs. The error returned to an unauthenticated caller must be `UNAUTHENTICATED`, not `ACCESS_DENIED`, and must be indistinguishable in timing and body from the response for an authenticated caller whose grant check fails — so that neither the existence of the secret nor the grant state can be inferred from the error alone.

**Definition of done:** The `secrets` contract has a new invariant requiring authenticated caller identity before grant evaluation and specifying that unauthenticated callers receive an `UNAUTHENTICATED` error that is timing-equivalent to an `ACCESS_DENIED` error.

---

### Task D-7 — Add feedback loop and block appeal functions to fraud_detection
**Priority:** P2
**Owner:** Contract author
**File:** `contracts/fraud_detection.md`

The `fraud_detection` contract has no mechanism for feeding decision outcomes back to improve scoring accuracy, and no process for operators to review or appeal an entity block. Without feedback, false positives and false negatives accumulate silently. Without an appeal path, a wrongly blocked legitimate user has no route to resolution.

Add functions for submitting a feedback event (outcome of a scored decision), querying the feedback history for an entity, requesting a block review, and resolving a block review with an explicit decision. Add invariants specifying that blocks must carry a stated reason, that blocks created by automated scoring must be reviewable by a human operator, and that a block without a specified expiry or without a review schedule is a contract violation.

**Definition of done:** The `fraud_detection` contract contains new functions for feedback ingestion and block review, and new invariants requiring stated reasons, human reviewability for automated blocks, and block expiry or review schedule requirements.

---

### Task D-8 — Add explicit deny semantics to the permissions contract
**Priority:** P2
**Owner:** Contract author
**File:** `contracts/permissions.md`

The `permissions` contract can grant and revoke permissions but has no concept of an explicit deny that overrides a role-level grant. This is a well-known privilege escalation pathway in RBAC systems: if a role grants access and there is no mechanism to create a user-level exception without modifying the role, the only option is to remove the user from the role entirely, which may revoke unrelated permissions.

Add a `denyPermission` function that creates an explicit deny record for a specific user, action, and resource. Add an invariant to the `can` function stating that an explicit deny for the requesting identity always overrides any role-level grant — deny wins over allow when both are present for the same identity, action, and resource combination. Document the precedence rules clearly in the contract.

**Definition of done:** The `permissions` contract has a `denyPermission` function, a corresponding `revokeDeny` function for removing explicit denies, and an invariant on `can` that specifies deny-over-grant precedence rules.

---

### Task D-9 — Add cryptographic tamper evidence to the audit_log contract
**Priority:** P1
**Owner:** Contract author
**File:** `contracts/audit_log.md`

The `audit_log` contract guarantees immutability by declaration, but provides no mechanism for detecting whether that guarantee has been violated. A database administrator with direct access can delete or modify records without triggering any contract-defined detection.

Add a tamper evidence mechanism to the contract: each new audit event must be stored alongside a hash that includes the content of the current event and the hash of the previous event, forming a hash chain. Any verification query that detects a broken link in the chain — a missing event, a modified event hash, or an inconsistency between the stored previous-hash and the actual hash of the preceding event — must surface that finding immediately. The contract should also define a `verifyChain` function that performs an integrity check across a range of events and returns a verification report.

**Definition of done:** The `audit_log` contract includes hash chaining in the `AuditEvent` type, a `verifyChain` function, and invariants requiring that the chain is maintained on every write and that chain breaks are immediately surfaced through the verification function.

---

### Task D-10 — Add PII discovery to the data_masking contract
**Priority:** P2
**Owner:** Contract author
**File:** `contracts/data_masking.md`

The `data_masking` contract can mask, tokenise, and redact fields that are already known to be sensitive, but it provides no way to discover which fields in an arbitrary document or schema are PII before masking rules are applied. Implementations must know in advance what to mask; there is no scanning primitive.

Add a `scanForPii` function that accepts a document or schema and returns a list of fields that are likely to contain PII, along with the confidence level and the PII category detected for each. Add a recommended integration with `data_catalog` so that classification rules derived from the data catalog's schema metadata can be used to seed the masking rule registry automatically rather than requiring manual rule authoring for every field.

**Definition of done:** The `data_masking` contract includes a `scanForPii` function, a type for the classification result, and a documented integration path with `data_catalog` for automatic masking rule derivation.

---

### Task D-11 — Add prompt injection as a policy category in content_safety
**Priority:** P1
**Owner:** Contract author
**Files:** `contracts/content_safety.md`, `contracts/llm_gateway.md`

The `content_safety` contract defines policies for categories like hate speech, harassment, and spam, but says nothing about prompt injection — malicious content embedded in user input to hijack AI-assisted processing pipelines. Given that Blueprint includes `llm_gateway`, `rag_pipeline`, `prompt_registry`, and `embeddings` contracts, prompt injection is a realistic and specific attack surface.

Add `prompt_injection` as a new value in the `Policy` type enum. Add an invariant stating that any content passed to `llm_gateway` functions must be screened by `content_safety` with the prompt injection policy enabled before it is used as part of a prompt. The `llm_gateway` contract must declare a dependency on `content_safety` and add an invariant requiring pre-screening for all user-supplied inputs.

**Definition of done:** `content_safety` has `prompt_injection` as a policy category with defined detection behaviours. `llm_gateway` declares a dependency on `content_safety` and contains an invariant requiring prompt injection screening for all user inputs.

---

### Task D-12 — Add credential isolation enforcement to sandbox_environment
**Priority:** P1
**Owner:** Contract author
**File:** `contracts/sandbox_environment.md`

The `sandbox_environment` contract declares that sandboxes must not have access to production credentials, but provides no mechanism for enforcing or verifying this at the contract level. An implementation could pass production API keys through a sandbox template and satisfy the invariant's wording while violating its intent.

Add a `validateSandboxCredentials` function that inspects a provisioned sandbox's configuration and confirms that no credential in the sandbox matches any known production credential. Add an invariant requiring that this validation runs automatically at provisioning time and that provisioning must fail if any production credential is detected. Add a `SandboxCredentialPolicy` type that defines the allowed credential sources for sandbox environments — test provider keys, mock service endpoints, in-memory simulators — and require that every sandbox template declares its credential policy.

**Definition of done:** The contract includes `validateSandboxCredentials`, `SandboxCredentialPolicy`, and invariants requiring automatic validation at provisioning time with a provisioning failure on detection of production credentials.

---

### Task D-13 — Add code signing and integrity verification to plugin_system
**Priority:** P1
**Owner:** Contract author
**File:** `contracts/plugin_system.md`

The `plugin_system` contract requires sandboxing and declared permissions but has no invariant requiring that plugins be cryptographically signed or that their integrity be verified before execution. A compromised plugin registry or distribution channel can deliver malicious code that runs with the declared permissions.

Add a `verifyPluginSignature` function and an invariant requiring that every plugin must carry a valid signature from a registered publisher before it can be loaded, regardless of source. The `PluginManifest` type must include a signature field and a publisher identifier. Add a publisher registry concept — a list of trusted publisher public keys — and an invariant that plugin loading must be rejected if the publisher is not in the registry or if the signature is invalid.

**Definition of done:** The contract includes `verifyPluginSignature`, updated `PluginManifest` with signature and publisher fields, a publisher registry type, and an invariant making valid signature verification mandatory before any plugin is loaded.

---

## Section E — Operational and Structural Tasks

These tasks address the structural concerns identified in the report and the protection guide — things that affect how Blueprint is operated and consumed rather than what the contracts say.

---

### Task E-1 — Add contract_version enforcement to blueprint verify
**Priority:** P1
**Owner:** CLI / verify command
**File:** `src/cli/commands.ts` and the verify logic

`global_standards.md` Section 7 requires that every adapter declare the contract version it implements. The `blueprint verify` command checks structural compliance but does not check whether the declared version in an adapter matches the current version in the catalog. A stale adapter claiming version 1.0.0 when the contract is at 1.2.0 passes verification with no warning.

Add a `--strict-version` flag to `blueprint verify` that fails when any adapter's declared version is behind the current catalog version. In default mode (without the flag), emit a warning for version mismatches rather than a failure, so existing workflows are not broken. Document the flag in the CLI help output. Add the `--strict-version` flag to the default CI workflow so that version drift is caught automatically before it becomes a silent compliance problem.

**Definition of done:** Running `blueprint verify --strict-version` fails and reports an error for any adapter whose declared contract version does not match the current catalog version. Running without the flag emits a warning. The CI workflow template includes `--strict-version` by default.

---

### Task E-2 — Add least-privilege deployment guidance to global_standards.md
**Priority:** P2
**Owner:** Contract author and DevOps
**File:** `contracts/core/global_standards.md`

The deployment order section of `global_standards.md` defines which modules can be deployed in which sequence but says nothing about what permissions each module should run with. A generated backend could deploy all modules under the same database user with full read-write access to all tables and satisfy every contract requirement without violation.

Add a Deployment Permissions section to `global_standards.md` that establishes: each module should have its own service identity and must not share credentials with other modules, each module's service identity must have access only to the data stores it owns, modules must not have write access to tables owned by other modules even if they have read access, and the deployment documentation for each module should declare the minimum permission set required.

**Definition of done:** `global_standards.md` contains a Deployment Permissions section that establishes service identity isolation, module-level credential separation, and read versus write access requirements.

---

### Task E-3 — Specify authentication requirements for the MCP server
**Priority:** P1
**Owner:** MCP server author
**File:** `src/mcp/server.ts` and its documentation

The MCP server exposes 12 tools that together provide a complete reconnaissance interface into the contract catalog, including dependency graphs, function signatures, adapter configurations, and module relationships. There is no specification of what authentication it requires, who may connect, or what network binding it should use by default.

Add documentation to the MCP server specifying: the server must bind to localhost by default and must require explicit configuration to accept connections from non-localhost addresses, any deployment that exposes the MCP server beyond localhost must require token-based authentication for every connection, the authentication mechanism must be documented in the server's help output, and the server startup must log a warning if it is binding to a non-localhost address without authentication configured.

**Definition of done:** The MCP server documentation specifies localhost-only default binding, token authentication requirements for network-exposed deployments, and the server emits a startup warning when binding without authentication. The help output describes the authentication configuration options.

---

### Task E-4 — Add a CI step to detect unaliased Blueprint identifiers after upgrades
**Priority:** P1
**Owner:** CI / DevOps

Every time `engineering-blueprint` is updated in a project's dependencies, there is a risk that new function names, new config fields, or new event topics introduced in the new version will appear in the regenerated output without having been added to the alias map. These new names will be generated in plaintext, silently undermining the aliasing protection.

Add a CI step that runs after `blueprint generate` and compares the generated output to a known-good baseline. The step should flag any function name, class name, module name, or event topic that matches a known Blueprint identifier pattern and does not appear in the alias map. The step should fail the build, not merely warn, so that unaliased names cannot reach a deployed build.

**Definition of done:** The CI pipeline contains a post-generation step that detects unaliased Blueprint identifiers and fails the build when any are found. The step is documented so developers understand what a failure means and how to resolve it by updating the alias map.

---

### Task E-5 — Write the supply chain security governance document
**Priority:** P2
**Owner:** Project governance / release manager

The Blueprint project publishes a tool that code-generates production backends. There is no document describing the project's own supply chain security posture — how dependencies are pinned, how the publish pipeline is secured, what verification a consumer can perform to confirm they received an unmodified package, or how a compromise of the publish pipeline would be detected and communicated.

Write a governance document covering: the process for pinning and auditing build dependencies, the signing and provenance requirements for the npm publish step, the catalog integrity hash mechanism (from Task A-3) and how consumers can use it, the incident response procedure if the npm package or the GitHub repository is compromised, and the contact point for supply chain security concerns.

**Definition of done:** A governance document exists that covers dependency pinning, publish pipeline security, package integrity verification instructions for consumers, and incident response for supply chain compromise. The document is referenced from the project README.

---

### Task E-6 — Define the paid versus open feature boundary
**Priority:** P2
**Owner:** Product / project leadership

Before any premium feature work begins, the boundary between what stays open and what sits behind a paid or registered tier must be formally defined and documented so that implementation decisions are consistent.

Based on the analysis in the protection guide, the proposed boundary is: the contract markdown files, the dependency graph, the CLI read commands, and the module catalog remain open in all versions. The alias and obfuscation system, the hosted runtime verification service, the contract version mismatch CI service, and the compliance mapping layer that connects modules to regulatory frameworks are candidates for a paid tier.

This task is a decision document, not implementation work. It should capture the rationale for each feature's placement, the risks of placing a security feature behind a paywall, the alternative of open-sourcing all features while offering hosted infrastructure as the paid offering, and the timeline for introducing tiered access.

**Definition of done:** A decision document exists that formally defines what is open and what is gated, the rationale for each placement, and the timeline. The document has been reviewed by the project leadership and is available for reference during implementation planning.

---

## Priority Summary

| Priority | Task count | Focus |
|----------|-----------|-------|
| P0 — Critical | 5 | Remove contracts from package, strip catalog, MFA enforcement, TLS standard |
| P1 — High | 24 | Generator aliasing, CSRF, injection, webhooks, audit tamper evidence, verify enforcement |
| P2 — Medium | 20 | Obfuscation, new contracts, feedback loops, explicit deny, PII discovery, governance |
| P3 — Low | 0 | None in this release |

---

## Execution Order

Work in roughly this sequence to avoid blockers:

First, complete all Section A tasks (A-1 through A-5) before the next npm publish. They have no dependencies and prevent further exposure from the current package.

Second, complete Task B-1 (the alias specification) before any other Section B tasks, since all generator work depends on having the spec finalised.

Third, complete Tasks D-2 and C-1 (MFA enforcement and transport security) as the highest-severity contract gaps, since both are P0.

Fourth, work through Section C and D contract tasks in parallel, as they are independent of each other.

Finally, work through Section E operational tasks, which depend on some Section B and C work being complete.

---

*All tasks reference the original findings in the Blueprint Security & Feature Gap Report and the Blueprint Protection Guide. Version baseline: `engineering-blueprint@0.1.x`.*
