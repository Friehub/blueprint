# Module Contract: `voice_video`

**Version:** 0.1.0

---

### `voice_video`
WebRTC room management with participant coordination, recording, and transcription.

**Functions**
```
createRoom(name, config) → Room
getRoom(room_id) → Room
listRooms(status?) → Room[]
joinRoom(room_id, user_id) → ParticipantToken
leaveRoom(room_id, user_id) → void
getParticipants(room_id) → Participant[]
startRecording(room_id) → RecordingSession
stopRecording(recording_id) → RecordingResult
startTranscription(room_id, language) → TranscriptionSession
stopTranscription(session_id) → TranscriptionResult
getRoomMetrics(room_id) → RoomMetrics
```

**Types**
```
Room { id, name, status: waiting|active|ended, max_participants, recording: bool, transcription: bool, created_at }
ParticipantToken { token, room_id, user_id, expires_at, ice_servers }
Participant { user_id, room_id, joined_at, audio: bool, video: bool, screen_share: bool, muted: bool }
RecordingSession { id, room_id, started_at, status: recording|stopped|failed }
RecordingResult { session_id, room_id, duration_ms, file_url, size_bytes }
TranscriptionSession { id, room_id, language, started_at, status: transcribing|completed|failed }
TranscriptionResult { session_id, room_id, segments: TranscriptionSegment[], duration_ms, language }
TranscriptionSegment { user_id, text, start_time, end_time, confidence }
RoomMetrics { room_id, participant_count, duration_ms, audio_packets_sent, video_packets_sent, avg_jitter_ms }
RoomConfig { max_participants, max_duration, recording_enabled, transcription_enabled, quality: low|medium|high }
```

**Invariants**
- `joinRoom` must return a ParticipantToken with a valid JWT that expires -- tokens cannot have infinite validity
- A participant must not be able to join a room that has already ended
- Recording and transcription must not start without explicit consent (if consent enforcement is enabled for the room)

**Providers:** Daily, LiveKit, Twilio Video, Agora, Zoom SDK, custom (WebRTC)

---

---

## System-Level Integrations & Constraints

### Consistency Model
* **Model:** `strong (default)`
* **Details:** Room state and participant lists must be immediately consistent

### Runtime Delivery Model
* **Delivery Guarantee:** `at_least_once` for room lifecycle events.
* **Details:** Duplicate join events must be idempotent (user already in room → return existing token).

### Worker Scaling
* **Policy:** Room management, media routing, and recording must be independently scalable.

### Multi-Region Behavior
* **Mode:** Rooms must be created in the region closest to the majority of participants; SFUs (Selective Forwarding Units) are region-local.
* **Details:** Cross-region participants connect to the room's region; latency is incurred.

### Idempotency Requirements
* **Standard:** All state-mutating functions with external side effects accept an optional `idempotency_key: string` parameter as the last argument (retained for 24 hours).

### Error Taxonomy
### Module-Specific Errors
```
createRoom:
    room_limit_reached:        Maximum concurrent rooms reached | end inactive rooms or increase limit

  joinRoom:
    room_full:                 Room has reached max_participants | wait for a slot to open
    room_ended:                Room has already ended | cannot join

  startRecording:
    recording_in_progress:     A recording is already active for this room | stop existing recording first
```

### Event Emission
All events are emitted using at-least-once delivery with UUID v4 envelope.
```
createRoom         → voice.room.created          { room_id, max_participants }
  joinRoom           → voice.participant.joined    { room_id, user_id }
  leaveRoom          → voice.participant.left      { room_id, user_id }
  startRecording     → voice.recording.started      { room_id, session_id }
  stopRecording      → voice.recording.completed    { room_id, session_id, duration_ms }
```

### Temporal Constraints
```
Room max duration:
    default:        60 minutes
    on_expiry:      end room gracefully; notify participants

  Token expiry:
    default:        2 hours
    on_expiry:      participant must rejoin with a new token

  Recording retention:
    default:        30 days
    on_expiry:      eligible for deletion
```

### Observability
* **Tracing Spans:** Every function call creates a span. Span names follow the pattern `voice_video.<function>`.
* **Telemetry Metrics:**
```
gensense_voice_video_rooms_created_total            { status }
  gensense_voice_video_participants_total             { room_id }
  gensense_voice_video_recording_duration_ms           histogram
  gensense_voice_video_transcription_segments_total    { language }
```
* **SLO Targets:** Latency P99 is bounded per standards (see global standards for details).

### Module Dependencies
* **Depends On:** users
* **Emits To:** events
* **Recommends:** notifications, presence, storage (for recording), consent
