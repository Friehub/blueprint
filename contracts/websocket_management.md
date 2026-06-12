# Module Contract: `websocket_management`

**Version:** 0.1.0

---

### `websocket_management`
WebSocket connection lifecycle, room management, and message broadcasting.

**Functions**
```
createRoom(room_id, options?) → Room
joinRoom(user_id, room_id) → Membership
leaveRoom(user_id, room_id) → void
getRoomMembers(room_id) → Membership[]
broadcastToRoom(room_id, event, data) → BroadcastResult
sendToUser(user_id, event, data) → void
sendToConnection(connection_id, event, data) → void
getUserConnections(user_id) → ConnectionInfo[]
disconnectUser(user_id, reason?) → void
getRoomStats(room_id) → RoomStats
```

**Types**
```
Room { id, name?, max_members?, type: open|invite|private, metadata?, created_at }
Membership { user_id, room_id, connection_id, role: owner|admin|member, joined_at }
ConnectionInfo { id, user_id, protocol, connected_at, last_heartbeat, remote_addr }
BroadcastResult { room_id, event, connection_count, excluded: string[] }
RoomStats { member_count, connection_count, messages_per_second, active_since }
AckLevel = none | delivered | read
WebSocketEvent { event, data, from?, room?, timestamp }
CloseCode = normal | going_away | protocol_error | unsupported | no_status | abnormal | auth_expired | room_full
```

**Invariants**
- `broadcastToRoom` must deliver the event to every connection in the room except the sender -- sending to the sender is a contract violation
- A user with multiple connections to the same room must receive each event once per connection
- `leaveRoom` must close the WebSocket connection for all user's connections in that room within 5 seconds
- Rooms that have had zero members for more than the configured idle timeout must be garbage collected
- `sendToUser` must deliver the event to ALL active connections for that user -- filtering to a subset is not permitted

**Providers:** WebSocket, Socket.IO, Phoenix Channels, uWebSockets, custom

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `eventual`
* **Details:** Room membership propagation is eventually consistent across nodes.

### Runtime Delivery Model
* **Delivery Guarantee:** `at_most_once` for broadcast messages.
* **Details:** WebSocket delivery is fire-and-forget. For guaranteed delivery, pair with a message queue.

### Worker Scaling
* **Policy:** Connection handling and room broadcasting must be independently scalable.

### Multi-Region Behavior
* **Mode:** Room state must be globally consistent or partitioned by region.
* **Details:** Cross-region broadcasting must use a pub-sub bridge between regions.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Backpressure
* When a connection's send buffer exceeds the high-water mark (64KB default), the connection must be rate-limited or closed with a `going_away` close code.

### Event Emission
```
joinRoom        -> websocket.room.joined  { user_id, room_id }
  leaveRoom       -> websocket.room.left   { user_id, room_id }
  broadcastToRoom -> websocket.room.message { room_id, event, connection_count }
  disconnectUser  -> websocket.user.disconnected { user_id, reason }
```

### Temporal Constraints
```
Heartbeat interval:
    default:        30 seconds
    on_expiry:      close connection with going_away code

  Room idle timeout:
    default:        24 hours with zero members
    on_expiry:      garbage collect room; emit room.deleted event

  Connection max lifetime:
    default:        24 hours
    on_expiry:      close connection gracefully; client must reconnect
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `websocket_management.<function>`.

### Module Dependencies
* **Depends On:** (none)
* **Emits To:** events
* **Recommends:** presence (for online/offline tracking), live_updates (for resource subscriptions over WS)
