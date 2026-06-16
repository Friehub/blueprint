# Module Contract: `rate_limiter_distributed`

**Version:** 0.1.0

---

### `rate_limiter_distributed`
Distributed rate limiting using shared Redis counter or token bucket correct across multiple application instances.

**Functions**
```
checkRateLimit(namespace: any, identifier: any, limit: number, window_seconds: any) → RateLimitResult
consumeToken(namespace: any, identifier: any, tokens?: any) → RateLimitResult
getCurrentUsage(namespace: any, identifier: any) → UsageInfo
resetWindow(namespace: any, identifier: any) → void
getRateLimitConfig(namespace: any) → RateLimitConfig
updateRateLimitConfig(namespace: any, config: any) → RateLimitConfig
```

**Types**
```
RateLimitResult { allowed: bool, remaining: number, reset_at: timestamp, total_limit: number, retry_after_ms?: number }
UsageInfo { current: number, limit: number, window_start: timestamp, window_end: timestamp, tokens_remaining?: number }
RateLimitConfig { algorithm: sliding_window | token_bucket | fixed_window, limit, window_seconds, burst_limit?, tokens_per_second?, fallback_mode }
FallbackMode = reject | allow_with_warning | allow_unlimited
```

**Invariants**
- Rate limit state must be shared across all instances local counters are not acceptable
- Redis unavailability must not crash the application; `fallback_mode` defines behaviour
- Clock skew between instances must not exceed 1 second for sliding window accuracy
- Token bucket refill must be atomic (Lua script or Redis transaction)
- Sliding window algorithm must use a sorted set or logarithmic precision counter, not fixed window with edge bursts

**Providers:** Redis (sorted sets / counters), Valkey, KeyDB

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual` under Redis failure; `strong` when Redis is available
* **Details:** Rate limit checks may over-allow during Redis failover; under-allow is preferred over over-allow

### Failure Modes
* **Redis Unavailable:** Use `FallbackMode` `allow_with_warning` recommended for read paths, `reject` for write paths
* **Network Partition:** Local rate limit cache with short TTL (100ms) prevents thundering herd on Redis recovery

### Observability
* **Metrics:** rate_limit_checks_total, rate_limit_blocked_total, rate_limit_redis_latency_ms
* **Alerting:** Alert on Redis latency > 10ms, blocked rate > 10% of total, fallback mode active for > 60s

### Module Dependencies
* **Hard Dependencies:** `caching` (for Redis connection)
* **Soft Dependencies:** `circuit_breaker`, `health_check_advanced`
