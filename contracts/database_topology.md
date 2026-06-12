# Module Contract: `database_topology`

**Version:** 0.1.0

---

### `database_topology`
Database sharding, replication, and cross-region topology configuration.

**Functions**
```
configureSharding(table, strategy, key) → ShardingConfig
getShard(key) → Shard
listShards() → Shard[]
addShard(shard_config) → Shard
removeShard(shard_id) → void
configureReplication(table, model, options?) → ReplicationConfig
getReplicationLag() → ReplicationReport
configureFailover(mode, options?) → FailoverConfig
triggerFailover() → FailoverResult
```

**Types**
```
ShardingConfig { table, strategy: key_range|hash|directory, key, shards: Shard[] }
Shard { id, range?, nodes: ReplicaNode[], status: active|draining|inactive }
ReplicaNode { id, role: primary|replica|arbiter, endpoint, region, lag_ms? }
ReplicationConfig { table, model: leader_follower|multi_leader|leaderless, sync_mode, nodes: ReplicaNode[] }
ReplicationReport { tables: ReplicationLag[], max_lag_ms, status: healthy|degraded|lagging }
ReplicationLag { table, node, lag_ms, status }
FailoverConfig { mode: automated|manual, conditions: FailoverCondition[], cooldown_ms }
FailoverResult { success, new_primary, duration_ms, data_loss_risk }
FailoverCondition { metric, threshold, duration_ms }
TopologyStrategy = read_replicas | sharding | multi_region
```

**Invariants**
- `configureSharding` with strategy `hash` must distribute data uniformly across shards -- a new shard must trigger rebalancing of existing data
- `getShard` must be deterministic for the same key -- the same key must always return the same shard, regardless of cluster state
- A replication model of `leader_follower` must have exactly one primary; `multi_leader` must have at least two; `leaderless` must have at least three
- `triggerFailover` must be rejected if the configured `cooldown_ms` has not elapsed since the last failover

**Dependencies:** service_mesh, distributed_lock

**Providers:** PostgreSQL (streaming replication), MongoDB (replica sets), Cassandra (leaderless), Vitess, CockroachDB

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `causal`
* **Details:** Topology configuration must converge; consistency depends on the selected replication model

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for topology lifecycle events.
* **Details:** Duplicate shard or replication configuration must be idempotent (update existing).

### Worker Scaling
* **Policy:** Topology management is a control-plane operation, not data-plane.

### Multi-Region Behavior
* **Mode:** This module IS the multi-region topology engine. It must support cross-region replication, failover, and read affinity.
* **Details:** A cross-region topology must declare which region is the source of truth.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
configureSharding:
    rebalance_in_progress:   Cluster is currently rebalancing | wait for completion

  triggerFailover:
    cooldown_active:         Failover cooldown period has not elapsed | wait and retry
    no_candidate:            No healthy candidate node available for failover | check cluster health
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
configureSharding → topology.sharding.configured { table, strategy, shard_count }
  addShard          → topology.shard.added          { shard_id, range }
  removeShard       → topology.shard.removed        { shard_id }
  triggerFailover   → topology.failover.started     { from, to, reason }
                   → topology.failover.completed    { duration_ms }
```

### Temporal Constraints
```
Failover cooldown:
    default:        60 seconds
    on_expiry:      failover may be triggered again

  Rebalancing timeout:
    default:        4 hours
    on_expiry:      mark rebalancing as stalled; require operator intervention
```

### Storage Model
* **Model:** Durable topology configuration store with shard, replication, and failover metadata.
* **Details:** Topology changes are control-plane operations and must be recorded durably before being applied.

### Database Schema

#### PostgreSQL
```sql
CREATE TABLE topology_shards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name        TEXT NOT NULL,
  strategy          TEXT NOT NULL CHECK (strategy IN ('key_range', 'hash', 'directory')),
  shard_key         TEXT NOT NULL,
  range_start       TEXT,
  range_end         TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draining', 'inactive')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE topology_replica_nodes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shard_id          UUID NOT NULL REFERENCES topology_shards(id) ON DELETE CASCADE,
  role              TEXT NOT NULL CHECK (role IN ('primary', 'replica', 'arbiter')),
  endpoint          TEXT NOT NULL,
  region            TEXT NOT NULL,
  lag_ms            INT DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE topology_replication_config (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name        TEXT NOT NULL,
  model             TEXT NOT NULL CHECK (model IN ('leader_follower', 'multi_leader', 'leaderless')),
  sync_mode         TEXT NOT NULL,
  config            JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE topology_failover_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id         UUID,
  from_primary      TEXT,
  to_primary        TEXT,
  reason            TEXT NOT NULL,
  success           BOOLEAN NOT NULL,
  duration_ms       INT,
  triggered_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Failure Modes & Breaking Change Policy

| Failure Mode | Detection | Mitigation |
|---|---|---|
| Rebalance stalls past timeout | Stalled flag set at 4h | Operator intervention required; emit `topology.rebalance.stalled` |
| Failover with no healthy candidate | `no_candidate` error | Alert operator; maintain quorum of replica nodes |
| Split-brain in multi-region topology | Inconsistent primary assignments | Use consensus-based leader election; reject concurrent primaries |
| Replication lag exceeds threshold | `ReplicationReport.status` degraded | Scale read replicas; throttle write-heavy workloads |

**Breaking Changes:** Changing the sharding strategy on an existing table requires a full data redistribution. A deprecation window of 2 release cycles must be observed. Shard key changes are always breaking.

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `database_topology.<function>`.
* **Telemetry Metrics:**
```
gensense_database_topology_shards_total              { status }
  gensense_database_topology_replication_lag_ms       gauge { table, node }
  gensense_database_topology_failovers_total           { reason }
  gensense_database_topology_rebalance_duration_ms     histogram
  gensense_database_topology_split_brain_total
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** service_mesh, distributed_lock
* **Emits To:** events
* **Recommends:** health (for node health in failover decisions), notifications, telemetry
