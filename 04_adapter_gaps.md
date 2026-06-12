# Report 04 — Adapter Coverage Gaps

## 136 Contracts With Zero Adapters — Priority Coverage Plan

---

## The Core Problem

Blueprint has 162 contracts but only 44 have provider adapters. This means 73% of the catalog is code-generation-capable but provider-agnostic — engineers can get the contract but can't get working Stripe, Redis, or Pinecone code for most modules.

Adapters are the most tangible value Blueprint delivers. When `blueprint generate --lang typescript` produces an actual Stripe implementation with correct idempotency key handling, that saves real hours. When it produces only an interface stub, it saves minutes.

---

## Priority Tier System

| Tier | Criteria | Target by Version |
|---|---|---|
| P0 — Critical | Used in almost every backend. Missing adapter blocks adoption. | v0.3.0 |
| P1 — High | Used in >50% of products. Missing adapter is a common complaint. | v0.3.5 |
| P2 — Standard | Vertical-specific but high-value. Differentiates from competition. | v0.4.0 |
| P3 — Long-tail | Niche but complete coverage signals quality. | v0.5.0+ |

---

## P0 — Critical Adapters (Must Ship in v0.3.0)

### `llm_gateway` adapters (currently: 0)
| Provider | Why | Config Fields |
|---|---|---|
| `openai` | Most used LLM API | api_key, organization_id, base_url? |
| `anthropic` | Second most used | api_key, max_tokens_default |
| `groq` | Fast inference, free tier attracts developers | api_key |
| `together_ai` | Open source models, cost-efficient | api_key |
| `ollama` | Local inference, no API key needed | host, port |
| `google_vertex` | Enterprise GCP users | project_id, region, credentials_path |
| `aws_bedrock` | Enterprise AWS users | region, model_id, aws_credentials |

### `vector_store` adapters (currently: 0)
| Provider | Why |
|---|---|
| `pinecone` | Most used hosted vector DB |
| `qdrant` | Best open source option |
| `pgvector` | Postgres users don't want a new service |
| `weaviate` | Enterprise adoption growing |
| `chroma` | Popular for local RAG development |

### `messaging` adapters (currently: 0)
| Provider | Why |
|---|---|
| `socket_io` | Used in virtually every real-time Node.js app |
| `ably` | Hosted alternative, strong enterprise offering |
| `pusher` | Laravel/PHP users, large existing base |

### `secrets` adapters (currently: 0)
| Provider | Why |
|---|---|
| `hashicorp_vault` | Gold standard for secrets management |
| `aws_secrets_manager` | AWS native, widely used |
| `doppler` | Growing rapidly, developer-friendly |
| `infisical` | Open source, Blueprint's target audience |

### `event_sourcing` adapters (currently: 0)
| Provider | Why |
|---|---|
| `eventstoredb` | Purpose-built event store |
| `kafka` (as event store) | Teams already using Kafka for streaming |
| `postgresql` (via events table) | Simplest option for small teams |

### `users` adapters (currently: 0)
| Provider | Why |
|---|---|
| `custom_postgres` | Default for everyone building their own user table |
| `firebase_auth` | Firebase users need the profile sync layer |
| `supabase_auth` | Popular BaaS with managed user records |

### `sessions` adapters (currently: 0)
| Provider | Why |
|---|---|
| `redis` | Standard session storage |
| `postgresql` | For teams not using Redis |

### `orders` adapters (currently: 0)
| Provider | Why |
|---|---|
| `custom_postgres` | Every e-commerce backend needs this |

### `inventory` adapters (currently: 0)
| Provider | Why |
|---|---|
| `custom_postgres` | Every commerce or logistics app |

### `ledger` adapters (currently: 0)
| Provider | Why |
|---|---|
| `custom_postgres` | Double-entry ledger on Postgres |
| `tigerbeetle` | High-performance financial accounting |

---

## P1 — High Priority Adapters (v0.3.5)

### `notifications` adapter expansions
Currently missing:
- `firebase_fcm` — mobile push (iOS/Android)
- `apns` — Apple Push Notification Service
- `slack` — team notifications
- `discord` — community platforms
- `telegram` — bot API notifications

### `embeddings` adapters (currently: 0)
| Provider | Notes |
|---|---|
| `openai` | text-embedding-3-small, text-embedding-3-large |
| `cohere` | embed-english-v3 |
| `google` | text-embedding-004 |
| `huggingface` | Self-hosted BERT/sentence-transformers |

### `event_bus` adapters (currently: 0)
| Provider | Notes |
|---|---|
| `kafka` | Confluent and self-hosted |
| `rabbitmq` | Already have queue adapter, need pub/sub |
| `aws_eventbridge` | AWS-native event routing |
| `google_pubsub` | GCP native |
| `nats` | Lightweight, growing in microservices |

### `feature_auditing` adapters (currently: 0)
| Provider | Notes |
|---|---|
| `posthog` | Open source product analytics with feature flags |
| `custom_postgres` | Most teams log feature usage to their own DB |

### `permissions` adapters (currently: 0)
| Provider | Notes |
|---|---|
| `casbin` | Most popular open source authz library |
| `ory_keto` | Cloud-native authz service |
| `openfga` | CNCF project, growing adoption |

### `knowledge_base` adapters (currently: 0)
| Provider | Notes |
|---|---|
| `notion` | API-accessible knowledge base |
| `confluence` | Enterprise knowledge management |
| `gitbook` | Developer documentation |

### `calendar` adapters (currently: 0)
| Provider | Notes |
|---|---|
| `google_calendar` | Most used calendar API |
| `microsoft_graph` | Microsoft 365 users |
| `caldav` | Open standard, self-hosted |

### `crm_leads` adapter expansions (currently: 2)
Missing:
- `pipedrive` — popular with SMBs
- `zoho_crm` — large emerging market user base
- `attio` — modern CRM, growing fast

### `media` adapter expansions (currently: 2)
Missing:
- `aws_s3` + transcoding via MediaConvert
- `mux` — video infrastructure
- `bunny_cdn` — cost-effective CDN

### `ai_agent_orchestration` adapters (currently: 0 — new module)
| Provider | Notes |
|---|---|
| `langchain` | Most popular agent framework |
| `llama_index` | Strong RAG + agent support |
| `crewai` | Multi-agent coordination |
| `autogen` | Microsoft's agent framework |

---

## P2 — Standard Adapters (v0.4.0)

### `data_warehouse` adapters (currently: 0)
- `bigquery`, `snowflake`, `redshift`, `databricks`, `clickhouse`

### `data_pipeline` adapters (currently: 0)
- `airbyte`, `fivetran`, `dbt`, `apache_beam`

### `stream_processing` adapters (currently: 0)
- `apache_flink`, `kafka_streams`, `aws_kinesis`, `google_dataflow`

### `search` adapter expansions (currently: 3)
Missing:
- `opensearch` — AWS-hosted Elasticsearch alternative
- `meilisearch` — developer-friendly, fast
- `typesense` — open source Algolia alternative

### `kyc` adapter expansions (currently: 2)
Missing:
- `stripe_identity` — increasingly used by Stripe-first teams
- `persona` — popular in US fintech
- `smile_identity` — critical for African market (very relevant for Friehub/Lagos)
- `youverify` — Nigerian KYC provider

### `analytics` adapter expansions (currently: 3)
Missing:
- `posthog` — open source alternative
- `june` — B2B product analytics
- `plausible` — privacy-first analytics

### `collaboration` (voice_video) adapters (currently: 0)
- `agora`, `twilio_video`, `livekit`, `daily_co`

---

## P3 — Long-Tail Adapters (v0.5.0+)

### African Payment Providers (Strategically Important for Friehub)
These are missing from `payments` adapters:
- `paystack` — dominant in Nigeria, Ghana, South Africa, Côte d'Ivoire
- `flutterwave` — Pan-African, 34+ African countries
- `monnify` — Nigerian bank transfer specialist
- `kuda` — Nigerian digital bank API
- `pawapay` — Mobile money across Africa (Airtel, MTN, Vodacom)
- `mpesa_daraja` — M-PESA API for East Africa
- `ozow` — South African instant EFT

**Note for Friehub:** These African payment adapters are a major differentiator. No other backend framework catalog covers them. This alone could drive significant adoption from African dev teams who are underserved by Stripe-centric tools.

### Additional Financial Adapters
- `payouts` → `wise_business`, `payoneer`, `paystack_transfers`
- `billing` → `chargebee`, `recurly`, `maxio`
- `invoicing` → `wave`, `zoho_invoice`
- `taxation` → `taxjar`, `avalara`, `sovos`

### Communication Adapters
- `sms` → `africas_talking` (critical for African market), `termii`, `InfoBip`
- `emails` → `postmark`, `SparkPost`, `Amazon SES`
- `push_notifications` → `OneSignal`, `Braze`

---

## Adapter YAML Format Standard (Reference)

All new adapters must follow this format exactly:

```yaml
module: module_name
provider: provider_name
version: "1.0.0"
description: "What this provider does for this module"
docs: "https://docs.provider.com/relevant-page"

implements:
  - functionName1
  - functionName2

does_not_implement:
  - functionName3  # reason: provider limitation

languages:
  - typescript
  - python
  - go
  - rust
  - java

config:
  required:
    - api_key: "Provider API key"
    - base_url: "API base URL (default: https://api.provider.com/v1)"
  optional:
    - timeout_ms: "Request timeout in milliseconds (default: 30000)"
    - retry_max: "Maximum retry attempts (default: 3)"

notes: |
  Any special integration notes, rate limits, or gotchas.
  Example: "Provider rate limits to 100 requests/second per key."
```

---

## Adapter Coverage Impact on Pro Revenue

Adapters are the most direct driver of Pro conversions:
- A free user seeing "0 adapters" for their chosen module has no reason to upgrade
- A free user seeing "2 adapters but not the one I use" upgrades to Pro to get their provider
- P0 adapters should stay free (they drive initial adoption)
- Vertical-specific adapters (African payments, healthcare, finance) are Pro-gated

Recommended gating:
- Free: OpenAI, Stripe, Redis, Postgres, Socket.io, Firebase
- Pro: Anthropic, Groq, Pinecone, Paystack, Flutterwave, HashiCorp Vault, Casbin, EventStoreDB
