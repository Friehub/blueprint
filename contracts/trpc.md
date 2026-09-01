name: trpc
version: 1.0.0
tier: free
status: stable
domain: platform
subdomain: api
part: I
tags:
  - trpc
  - typescript
  - rpc
  - end-to-end-types
  - fullstack
  - procedure
  - router
patterns:
  - procedure-router
  - context-injection
  - middleware-chain
  - subscription-via-websocket
aliases:
  - tRPC
  - typed RPC
  - end-to-end TypeScript API
  - type-safe API
depends_on:
  - request_validation
optional_depends_on:
  - sessions
  - auth_middleware
  - rate_limiting
  - telemetry
emits_events:
  - trpc.query.executed
  - trpc.mutation.executed
  - trpc.subscription.started
  - trpc.subscription.ended
consumes_events: []
providers:
  - tRPC v11 (Next.js adapter)
  - tRPC v11 (Express adapter)
  - tRPC v11 (Fastify adapter)
  - tRPC v11 (standalone fetch adapter)
---

# `trpc`
[idempotency: idempotency_key_required] <!-- mutations require idempotency key; queries are inherently idempotent -->

**Version:** 1.0.0 · **Tier:** Free · **Domain:** Platform / API

> tRPC end-to-end type-safe RPC for TypeScript full-stack applications — shared type contracts between server and client with zero code generation.

## Search Surface

### In plain language
tRPC is a TypeScript-first RPC framework where the same TypeScript types that define the server API are automatically available on the client, with no code generation step. The server defines "procedures" (queries for reads, mutations for writes, subscriptions for real-time), and the client calls them with full type inference. Input validation uses Zod schemas. Context carries per-request state (auth identity, DB connection). Middleware chains protect procedures or attach cross-cutting logic. The transport is HTTP for queries and mutations, and WebSocket for subscriptions.

### Use this contract when
- Your frontend and backend are both TypeScript and live in the same monorepo
- You need end-to-end type safety between API caller and API handler without a code generation build step
- Your team is building a Next.js, Remix, or SvelteKit full-stack application
- You want input validation (Zod) co-located with the procedure definition
- You want subscription support without building a separate WebSocket layer

### Do not use this contract when
- Your API will be consumed by non-TypeScript clients (mobile apps, external partners) → use `http_routing` (REST) or `graphql`
- Your team works across frontend (TypeScript) and backend (Go/Rust/Python) in separate repos → REST or gRPC with generated clients
- You need public API documentation (tRPC has no built-in OpenAPI) → use `http_routing` + OpenAPI
- You need query-level data fetching flexibility for mobile vs web → use `graphql`

### Not to be confused with
- `grpc` — binary RPC over HTTP/2 for internal microservices; tRPC is TypeScript-only over HTTP/JSON
- `graphql` — query language; clients specify what fields they want; tRPC procedures return fixed shapes
- `http_routing` — REST API; typed manually; requires separate client SDKs or code generation
- `sse` — server push only; tRPC subscriptions are bidirectional via WebSocket

### Also known as
tRPC, typed RPC, end-to-end TypeScript API, type-safe API, procedure router

## Core Concepts

### Procedure types
- **Query**: Read-only; maps to HTTP GET. Safe to retry. No side effects.
- **Mutation**: Write; maps to HTTP POST. Must use idempotency key for side-effectful operations.
- **Subscription**: Real-time stream; runs over WebSocket. Client subscribes; server pushes updates.

### Context
Per-request object injected into every procedure. Carries the DB connection, the resolved `auth_middleware` identity, and any request-scoped state. Context is created once per request.

### Middleware
Functions that run before a procedure and can short-circuit with an error. Used for auth enforcement, logging, and rate limiting per-procedure or per-router.

## Contract

### Functions

#### `initTRPC.context<Context>().create(options?) → TRPCBuilder`
Initializes the tRPC instance for a given Context type. Must be called once per application. The `Context` type flows into every procedure.

---

#### `router(procedures) → Router`
Creates a router from a set of named procedures. Routers can be nested.

---

#### `publicProcedure.query(handler) → QueryProcedure`
Defines a read-only procedure accessible without authentication.

**Parameters**
| Parameter | Type | Required | Notes |
|---|---|---|---|
| `handler.input` | ZodSchema | No | Validates and types the input |
| `handler.resolve` | `({ input, ctx }) => Output` | Yes | The procedure implementation |

---

#### `publicProcedure.mutation(handler) → MutationProcedure`
Defines a write procedure accessible without authentication. For state-mutating operations, the resolver should accept an `idempotency_key` in the input schema.

---

#### `protectedProcedure.query(handler) → QueryProcedure`
Defines a read-only procedure that requires authentication. `protectedProcedure` is a `publicProcedure` with an auth middleware applied. The resolver receives `ctx.user` as the resolved identity.

---

#### `protectedProcedure.mutation(handler) → MutationProcedure`
Defines a write procedure that requires authentication.

---

#### `procedure.subscription(handler) → SubscriptionProcedure`
Defines a real-time subscription. Returns an async iterable or observable that the server pushes to connected clients.

---

#### `mergeRouters(...routers) → Router`
Merges multiple routers into one. Used to compose a root router from domain-level sub-routers.

### Types

```typescript
type Context = {
  db: Database
  user: Identity | null       // null if unauthenticated
  request_id: string
}

type Procedure<Input, Output> = {
  input: ZodSchema<Input>
  resolve: (opts: { input: Input; ctx: Context }) => Promise<Output>
}

type RouterDef = {
  [key: string]: Procedure<any, any> | RouterDef
}

type TRPCError = {
  code: TRPCErrorCode
  message: string
  cause?: Error
}

type TRPCErrorCode =
  | 'BAD_REQUEST'           // Input validation failed → 400
  | 'UNAUTHORIZED'          // Not authenticated → 401
  | 'FORBIDDEN'             // Authenticated but not authorized → 403
  | 'NOT_FOUND'             // Resource not found → 404
  | 'CONFLICT'              // State conflict → 409
  | 'TOO_MANY_REQUESTS'     // Rate limited → 429
  | 'INTERNAL_SERVER_ERROR' // Unexpected error → 500
  | 'TIMEOUT'               // Deadline exceeded → 504
```

## Router Structure Pattern

```typescript
// Separate routers per domain
const userRouter = router({
  list: protectedProcedure.query(/* ... */),
  get: protectedProcedure.input(z.object({ id: z.string().uuid() })).query(/* ... */),
  create: protectedProcedure.input(createUserSchema).mutation(/* ... */),
  delete: protectedProcedure.input(z.object({ id: z.string().uuid() })).mutation(/* ... */),
})

const orderRouter = router({
  list: protectedProcedure.query(/* ... */),
  create: protectedProcedure.input(createOrderSchema).mutation(/* ... */),
})

// Merged root router (exported type used by client)
const appRouter = mergeRouters(
  router({ users: userRouter }),
  router({ orders: orderRouter }),
)

export type AppRouter = typeof appRouter
```

## Invariants

1. **The `AppRouter` type must be the only thing exported from the server to the client package.** Never export concrete implementation. The client only receives the type, not the code.
2. **Every mutation that has side effects must accept an `idempotency_key` in its input schema.** See `idempotency_key_standard`.
3. **`protectedProcedure` must throw `UNAUTHORIZED` if `ctx.user` is null.** It must never pass an unauthenticated request to a protected resolver.
4. **Subscriptions must handle client disconnection gracefully.** The async iterable must clean up resources (DB listeners, timers) when the client disconnects.
5. **Input schemas must use Zod `.strict()` for mutation inputs.** Unknown fields must be rejected, not silently passed through.
6. **Context creation must never throw.** If DB initialization fails, the context should carry a null connection and procedures must handle it gracefully.

## Error Catalogue

tRPC errors map to HTTP status codes via the `TRPCErrorCode` enum:

| tRPC Code | HTTP Status | When |
|---|---|---|
| `BAD_REQUEST` | 400 | Zod input validation failed |
| `UNAUTHORIZED` | 401 | `ctx.user` is null in protected procedure |
| `FORBIDDEN` | 403 | User lacks permission for this operation |
| `NOT_FOUND` | 404 | Queried resource does not exist |
| `CONFLICT` | 409 | Duplicate idempotency key with different params |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled exception in resolver |
| `TIMEOUT` | 504 | Resolver exceeded deadline |

## Integration Map

### Depends on

| Contract | Relationship | Notes |
|---|---|---|
| `request_validation` | **Used internally** | Zod validation is tRPC's validation; schemas are co-located with procedures |
| `sessions` / `auth_middleware` | **Optional** | Context creation reads the session/Bearer token to populate `ctx.user` |
| `rate_limiting` | **Optional** | Apply rate limiting in tRPC middleware before the resolver |

### Used by

| Contract | How |
|---|---|
| `websocket_management` | tRPC subscriptions transport over WebSocket |
| `sessions` | Context reads session to resolve user identity |

### Related ADRs and Standards

- `ADR-018` — API style selection (REST vs GraphQL vs gRPC vs tRPC)
- `ADR-037` — tRPC selection guide: when full-stack TypeScript justifies tRPC over REST
- `idempotency_key_standard` — applied to mutations

## Provider Guide

| Provider | Type | Notes |
|---|---|---|
| tRPC + Next.js | Managed | Use `@trpc/server/adapters/next`; API routes or App Router route handlers |
| tRPC + Express | Managed | Use `@trpc/server/adapters/express`; `createExpressMiddleware` |
| tRPC + Fastify | Managed | Use `@trpc/server/adapters/fastify` |
| tRPC + fetch (edge) | Managed | Use `@trpc/server/adapters/fetch`; works on Cloudflare Workers |

## Operational Behaviour

### Consistency model
**Model:** Inherits the consistency of the underlying data modules each procedure touches.

### Delivery guarantee
**Model:** At-most-once for queries and mutations (HTTP). At-least-once for subscriptions on reconnection — consumers must handle duplicates.

### Backpressure
Subscriptions apply backpressure via async iterable back-pressure: the server does not push new events until the client consumes the previous one.

### Throughput limits
**Query/mutation:** 10,000 requests/second per instance (limited by underlying HTTP server)
**Subscriptions:** 1,000 concurrent WebSocket connections per instance

## Observability

### Metrics

```
blueprint_trpc_procedure_total       counter   { procedure_type, procedure_path, result }
blueprint_trpc_procedure_duration_ms histogram { procedure_type, procedure_path }
blueprint_trpc_errors_total          counter   { procedure_path, error_code }
blueprint_trpc_subscriptions_active  gauge     { procedure_path }
```

### Trace spans

```
trpc.<procedure_path>        → full procedure execution
  trpc.middleware.<name>     → each middleware in chain
  trpc.input_validation      → Zod schema parse
  trpc.resolver              → the handler itself
```

### SLO targets

| Procedure type | P50 | P99 | Error rate |
|---|---|---|---|
| Query | < 50ms | < 200ms | < 0.5% |
| Mutation | < 100ms | < 500ms | < 0.5% |
| Subscription connect | < 200ms | < 1s | < 1% |

## Failure Modes

| Scenario | Behaviour | Recovery |
|---|---|---|
| Zod input validation fails | Return `BAD_REQUEST` with field-level errors | Client fixes input |
| DB unavailable in resolver | Throw `INTERNAL_SERVER_ERROR`; log internally | Alert; restore DB |
| Client disconnects during subscription | Async iterable `return()` is called; clean up listeners | No action needed |
| Missing `AppRouter` type export | TypeScript compilation error on client | Export type from server package |
| Mutation replayed (same idempotency key) | Return cached result from idempotency store | No action needed |
