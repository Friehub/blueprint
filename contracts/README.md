# Domain Contract Catalogue

## A Provider-Agnostic Interface Specification for AI-Assisted Backend Development

Every backend system ever built is an assembly of the same recurring domain problems. The database changes. The provider changes. The language changes. The domain problems do not.

A notification system for a fintech startup and a notification system for a healthcare platform both need `sendEmail`, `sendSMS`, `getNotificationHistory`, and `updatePreferences`. The implementations differ. The interface does not.

This catalogue formally defines those interfaces — function signatures, type shapes, and error contracts — for recurring backend domain problems. Each definition is:

- **Provider-agnostic** — the contract does not name Stripe, Twilio, or S3
- **Language-portable** — the contract transpiles to TypeScript types, Rust traits, Python protocols, Go interfaces
- **AI-consumable** — an agent given the contract cannot invent a wrong interface
- **Versioned** — contracts change with semver discipline; adapters declare which version they implement

---

## How to Read Each Module

Each module lists:
- **Functions** — the operations the module exposes (signatures)
- **Types** — the data structures the module owns
- **Invariants** — behavioral constraints an implementation must satisfy
- **Providers** — examples of things an adapter might wrap
- **System-Level Integrations** — consistency model, idempotency, errors, events, temporal constraints, observability, and dependencies.

---

## Global System Standards & Orchestrations

- [Global Core Standards](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/core/global_standards.md) — Universal error types, pagination requirements, idempotency rules, event envelope formats, logging/tracing rules, deployment tiers, and contract evolution rules.
- [Runtime Standards](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/core/runtime_standards.md) — Queue semantics, retry budgets, dead-letter handling, webhook timeouts, payload limits, backpressure, storage models, and retention rules.
- [Cross-Module Sagas](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/core/sagas.md) — Multi-module transaction orchestration and rollback compensations (e.g. `place_order`, `process_refund`, `cancel_subscription`).

Module contracts inherit `Runtime Standards` unless a module explicitly overrides a rule in its own `System-Level Integrations` section.

---

## Module Index

### Part I — Identity and Access
- [auth](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/auth.md)
- [users](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/users.md)
- [permissions](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/permissions.md)
- [sessions](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/sessions.md)
- [api_keys](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/api_keys.md)
- [workspaces](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/workspaces.md)

### Part II — Communication
- [notifications](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/notifications.md)
- [messaging](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/messaging.md)
- [emails](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/emails.md)
- [sms](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/sms.md)
- [webhooks](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/webhooks.md)

### Part III — Data and State
- [storage](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/storage.md)
- [caching](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/caching.md)
- [search](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/search.md)
- [queues](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/queues.md)
- [jobs](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/jobs.md)
- [config](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/config.md)
- [feature_flags](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/feature_flags.md)
- [rate_limiting](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/rate_limiting.md)
- [audit_log](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/audit_log.md)
- [tags](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/tags.md)
- [geo](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/geo.md)

### Part IV — Commerce
- [catalog](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/catalog.md)
- [inventory](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/inventory.md)
- [cart](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/cart.md)
- [promotions](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/promotions.md)
- [orders](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/orders.md)
- [payments](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/payments.md)
- [shipping](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/shipping.md)
- [reviews](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/reviews.md)
- [procurement](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/procurement.md)
- [warehousing](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/warehousing.md)

### Part V — Real-Time and Social
- [presence](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/presence.md)
- [events](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/events.md)
- [posts](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/posts.md)
- [comments](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/comments.md)
- [reactions](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/reactions.md)
- [follows](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/follows.md)
- [document_editor](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/document_editor.md)

### Part VI — Platform Operations
- [billing](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/billing.md)
- [usage_metering](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/usage_metering.md)
- [tenants](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/tenants.md)
- [analytics](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/analytics.md)
- [reporting](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/reporting.md)
- [data_import](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/data_import.md)
- [media](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/media.md)
- [localization](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/localization.md)
- [consent](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/consent.md)
- [health](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/health.md)
- [crm_leads](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/crm_leads.md)
- [customer_support](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/customer_support.md)
- [referrals](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/referrals.md)

### Part VII — Security and Compliance
- [encryption](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/encryption.md)
- [fraud_detection](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/fraud_detection.md)
- [ip_intelligence](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/ip_intelligence.md)
- [disputes](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/disputes.md)

### Part VIII — Industry Verticals
- [appointments](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/appointments.md)
- [kyc](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/kyc.md)
- [loyalty](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/loyalty.md)
- [subscriptions](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/subscriptions.md)
- [donations](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/donations.md)
- [ledger](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/ledger.md)
- [transfers](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/transfers.md)

### Part IX — Workflows
- [onboarding](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/onboarding.md)
- [approvals](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/approvals.md)

### Part X — Work Management
- [projects](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/projects.md)

### Part XI — Finance Operations
- [reconciliation](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/reconciliation.md)
- [invoicing](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/invoicing.md)

### Part XII — Education
- [courses](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/courses.md)
- [enrollments](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/enrollments.md)

### Part XIII — SaaS Platform
- [plan_catalog](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/plan_catalog.md)
- [seat_management](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/seat_management.md)
- [provisioning](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/provisioning.md)
- [usage_billing](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/usage_billing.md)

### Part XIV — Commerce and Banking
- [taxation](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/taxation.md)
- [returns](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/returns.md)
- [fulfillment](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/fulfillment.md)
- [settlement](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/settlement.md)
- [payouts](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/payouts.md)
- [chargebacks](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/chargebacks.md)
- [bank_accounts](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/bank_accounts.md)

### Part XV — Platform Extensions
- [seat_pricing](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/seat_pricing.md)
- [audit_exports](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/audit_exports.md)
- [web_analytics](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/web_analytics.md)

### Part XVI — Education Operations
- [assignments](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/assignments.md)
- [grading](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/grading.md)
- [attendance](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/attendance.md)

### Part XVII — Work Operations
- [tasks](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/tasks.md)

### Part XVIII — Treasury and Reconciliation
- [bank_reconciliation](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/bank_reconciliation.md)
- [treasury_accounts](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/treasury_accounts.md)

### Part XIX — Trust and Security
- [attachments](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/attachments.md)
- [moderation](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/moderation.md)
- [security_settings](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/security_settings.md)

### Part XX — Observability and Security Ops
- [error_tracking](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/error_tracking.md)
- [security_monitoring](file:///home/oxisrael/Friehub/Taas/engineering-blueprinter/contracts/security_monitoring.md)


---

## The Boundary

The catalogue stops at the domain operation layer. A module belongs here if it satisfies four conditions simultaneously:

1. **It is a named domain problem** — `payments`, not `database transactions`. The name describes what it does for the business, not how it does it technically.
2. **It recurs across at least three different application types** — `notifications` appears in e-commerce, healthcare, social, SaaS, and fintech. `donations` appears in non-profit, crowdfunding, and community platforms. `kyc` appears in fintech, hiring platforms, and regulated marketplaces.
3. **Its interface is stable across providers** — `sendEmail` takes the same inputs whether the provider is Resend, SendGrid, or Mailgun. `initiatePayment` takes the same inputs whether the adapter wraps Stripe or Paystack.
4. **It cannot be trivially derived from a CRUD operation on a single table** — `getUser` is not in this catalogue because it is just a database read. `transitionOrderStatus` is in this catalogue because it enforces a state machine with business rules.

What is excluded: infrastructure configuration, deployment, database schema design, ORM setup, HTTP routing, middleware, and anything that is framework-specific. The catalogue defines what your system does. How it runs is out of scope.

---

## Connection to AI Reliability

Each module in this catalogue represents a fixed interface. When an AI agent is given the contract for a module before generating an adapter, three things change:

- **The function names are fixed.** The AI cannot invent arbitrary names — the contract specifies exact signatures.
- **The type shapes are fixed.** The AI cannot return random dictionaries — the contract defines exact type structures.
- **The invariants are enforceable.** The AI's implementation can be verified programmatically against the contract invariants.

The reliability gain is not that AI becomes smarter. It is that the creative surface collapses from designing and implementing an interface to only implementing one. That is a fundamentally smaller and more reliable task.

---

*Version 0.4 — Domain Contract Catalogue*
