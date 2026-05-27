# Module: calendar

**Version:** 0.1.0
**Part:** VIII -- Industry Verticals

## Purpose

Defines the interface for managing calendar events, recurring schedules, attendee invitations, and availability resolution. A calendar event is a time-bounded occurrence with a defined set of attendees, a recurrence rule, and an RSVP lifecycle. This module is distinct from `appointments`, which manages consumer-facing booking slots tied to a provider's availability. Calendar is a general-purpose event management system covering internal meetings, team schedules, recurring operations, and external calendar synchronisation.

---

## State Machine

### Event State
```
DRAFT → CONFIRMED → CANCELLED
CONFIRMED → CANCELLED
CONFIRMED → RESCHEDULED → CONFIRMED
```

### Attendee RSVP State
```
INVITED → ACCEPTED
        → DECLINED
        → TENTATIVE
ACCEPTED | TENTATIVE → DECLINED
DECLINED → ACCEPTED
```

Transitions:
- `DRAFT → CONFIRMED`: `publishEvent` called; invitations dispatched
- `CONFIRMED → RESCHEDULED`: `rescheduleEvent` called; new invitations dispatched
- `RESCHEDULED → CONFIRMED`: reschedule confirmed
- `CONFIRMED → CANCELLED`: `cancelEvent` called; cancellation notices dispatched
- RSVP: `respondToInvitation` transitions per response

---

## Functions

### `createEvent(input: CreateEventInput) → CalendarEvent`
Creates a new calendar event in `DRAFT` state. No invitations are sent.

### `publishEvent(eventId: CalendarEventId) → CalendarEvent`
Confirms the event and dispatches invitations to all attendees.

### `getEvent(eventId: CalendarEventId) → CalendarEvent`
Returns the event and its current attendee list with RSVP states.

### `listEvents(input: ListEventsInput) → PaginatedList<CalendarEvent>`
Returns events in a date range for a calendar owner, optionally filtered by status or attendee.

### `updateEvent(input: UpdateEventInput) → CalendarEvent`
Updates a `DRAFT` event's fields. For `CONFIRMED` events, use `rescheduleEvent`.

### `rescheduleEvent(input: RescheduleEventInput) → CalendarEvent`
Changes the start/end time of a confirmed event. Resets all attendee RSVPs to `INVITED` and dispatches update notifications.

### `cancelEvent(eventId: CalendarEventId, reason?: string) → void`
Cancels a confirmed or rescheduled event. Dispatches cancellation notices to all attendees.

### `addAttendee(input: AddAttendeeInput) → CalendarEvent`
Adds a new attendee to a confirmed event and dispatches an invitation.

### `removeAttendee(input: RemoveAttendeeInput) → CalendarEvent`
Removes an attendee from a confirmed event and dispatches a cancellation notice to that attendee.

### `respondToInvitation(input: RSVPInput) → CalendarEvent`
Records an attendee's RSVP response.

### `getAvailability(input: AvailabilityQueryInput) → AvailabilityResult[]`
Returns free/busy time slots for one or more users within a given window. Used to find mutually available times before creating an event.

### `createRecurringEvent(input: CreateRecurringEventInput) → RecurringEventSeries`
Creates a recurring event series with an RRULE (iCalendar recurrence rule). Individual occurrences are materialised lazily.

### `getOccurrences(seriesId: RecurringSeriesId, input: OccurrenceQueryInput) → CalendarEvent[]`
Returns materialised occurrences of a recurring series within a date range.

### `updateOccurrence(input: UpdateOccurrenceInput) → CalendarEvent`
Modifies a single occurrence of a recurring series without affecting siblings. Detaches the occurrence from the series.

### `cancelOccurrence(occurrenceId: CalendarEventId) → void`
Cancels a single occurrence of a recurring series. Siblings are unaffected.

---

## Types

```typescript
type CalendarEventId = string;
type RecurringSeriesId = string;
type AttendeeId = string;

type EventStatus = "DRAFT" | "CONFIRMED" | "RESCHEDULED" | "CANCELLED";
type RSVPStatus = "INVITED" | "ACCEPTED" | "DECLINED" | "TENTATIVE";
type AttendeeRole = "ORGANISER" | "REQUIRED" | "OPTIONAL";

type VideoConferenceLink = {
  provider: string;                // e.g. "zoom", "google_meet", "teams"
  joinUrl: string;
  meetingId?: string;
  passcode?: string;
};

type Recurrence = {
  rrule: string;                   // RFC 5545 RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10"
  timezone: string;
  exdates?: Timestamp[];           // Excluded dates (cancelled occurrences)
};

type Attendee = {
  attendeeId: AttendeeId;
  userId?: UserId;
  email: string;
  displayName?: string;
  role: AttendeeRole;
  rsvpStatus: RSVPStatus;
  respondedAt?: Timestamp;
  rsvpComment?: string;
};

type CreateEventInput = {
  title: string;
  description?: string;
  startAt: Timestamp;
  endAt: Timestamp;
  timezone: string;
  isAllDay?: boolean;
  location?: string;
  videoConference?: VideoConferenceLink;
  attendees: Omit<Attendee, "attendeeId" | "rsvpStatus" | "respondedAt">[];
  calendarOwnerId: UserId;
  visibility: "PUBLIC" | "PRIVATE" | "CONFIDENTIAL";
  metadata?: Record<string, unknown>;
};

type CalendarEvent = {
  eventId: CalendarEventId;
  seriesId?: RecurringSeriesId;
  title: string;
  description?: string;
  startAt: Timestamp;
  endAt: Timestamp;
  timezone: string;
  isAllDay: boolean;
  location?: string;
  videoConference?: VideoConferenceLink;
  attendees: Attendee[];
  calendarOwnerId: UserId;
  visibility: "PUBLIC" | "PRIVATE" | "CONFIDENTIAL";
  status: EventStatus;
  metadata?: Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type RecurringEventSeries = {
  seriesId: RecurringSeriesId;
  template: CreateEventInput;
  recurrence: Recurrence;
  createdAt: Timestamp;
};

type CreateRecurringEventInput = CreateEventInput & {
  recurrence: Recurrence;
};

type UpdateEventInput = {
  eventId: CalendarEventId;
  title?: string;
  description?: string;
  location?: string;
  videoConference?: VideoConferenceLink;
  visibility?: "PUBLIC" | "PRIVATE" | "CONFIDENTIAL";
};

type RescheduleEventInput = {
  eventId: CalendarEventId;
  newStartAt: Timestamp;
  newEndAt: Timestamp;
  timezone?: string;
  reason?: string;
};

type AddAttendeeInput = {
  eventId: CalendarEventId;
  email: string;
  displayName?: string;
  role: AttendeeRole;
};

type RemoveAttendeeInput = {
  eventId: CalendarEventId;
  attendeeId: AttendeeId;
};

type RSVPInput = {
  eventId: CalendarEventId;
  attendeeId: AttendeeId;
  response: "ACCEPTED" | "DECLINED" | "TENTATIVE";
  comment?: string;
};

type AvailabilityQueryInput = {
  userIds: UserId[];
  fromDate: Timestamp;
  toDate: Timestamp;
  slotDurationMinutes: number;
  timezone: string;
};

type AvailabilityResult = {
  startAt: Timestamp;
  endAt: Timestamp;
  availableUserIds: UserId[];
  busyUserIds: UserId[];
};

type OccurrenceQueryInput = {
  fromDate: Timestamp;
  toDate: Timestamp;
};

type UpdateOccurrenceInput = UpdateEventInput & {
  eventId: CalendarEventId;
};
```

---

## Invariants

1. `endAt` must be after `startAt`; events with zero or negative duration return `INVALID_EVENT_DURATION`.
2. An event must have exactly one attendee with `role = "ORGANISER"`.
3. `publishEvent` dispatches invitations exactly once; subsequent calls to `publishEvent` on an already-`CONFIRMED` event are no-ops.
4. `rescheduleEvent` resets all non-organiser attendee RSVP statuses to `INVITED` and re-dispatches invitations.
5. A recurring series `RRULE` must be parseable per RFC 5545; invalid RRULE strings return `INVALID_RRULE`.
6. `getAvailability` considers a slot busy if any event in `CONFIRMED` or `RESCHEDULED` state overlaps with it for a given user.
7. `updateOccurrence` detaches the occurrence from the series permanently; the detached occurrence is a standalone `CalendarEvent` with no `seriesId`.
8. Cancelled events and occurrences must remain queryable via `getEvent` and `listEvents`; they must not be physically deleted.

---

## Events Emitted

- `calendar.event.created`
- `calendar.event.published` -- triggers invitation dispatch
- `calendar.event.updated`
- `calendar.event.rescheduled` -- triggers RSVP reset and re-invitation
- `calendar.event.cancelled` -- triggers cancellation notices
- `calendar.attendee.added`
- `calendar.attendee.removed`
- `calendar.rsvp.responded` -- includes `attendeeId`, `response`
- `calendar.occurrence.cancelled`

---

## System-Level Integrations

- **Idempotency:** `respondToInvitation` with the same response as the current RSVP state is a no-op.
- **Consistency:** Invitation dispatch on `publishEvent` uses an outbox pattern; invitations are sent after the event record is durably written.
- **Runtime delivery:** Invitations and RSVP notifications are delivered `at_least_once`.
- **Worker scaling:** Invitation dispatch and RSVP query workloads must be independently scalable.
- **Multi-region:** The deployment must declare whether calendar sync is single-region or active/passive; duplicate invitation dispatch across regions must be deduplicated.
- **Observability:** RSVP response rate per event is a key metric; spans on `publishEvent` should carry `attendeeCount` as an attribute.
- **Backpressure:** If dispatch is saturated, invitation sends must defer or reject predictably rather than dropping notices silently.
- **Storage model:** Event state and attendee RSVP history must remain durable; recurrence materialisation may be generated on demand.
- **Dependencies:** `notifications` or `emails` (invitation and cancellation dispatch), `users` (attendee identity resolution), `appointments` (availability data feed for `getAvailability`), `localization` (timezone-aware formatting of event times in notifications).
- **Errors:** `EVENT_NOT_FOUND`, `SERIES_NOT_FOUND`, `ATTENDEE_NOT_FOUND`, `INVALID_EVENT_DURATION`, `INVALID_RRULE`, `EVENT_NOT_CANCELLABLE`, `ORGANISER_REQUIRED`, `EVENT_NOT_EDITABLE`.
- **Providers (adapter examples):** Google Calendar API, Microsoft Graph Calendar, CalDAV (RFC 4791), Apple EventKit, custom PostgreSQL implementation.
