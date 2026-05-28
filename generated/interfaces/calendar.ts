// calendar.ts
// Auto-generated from contracts/calendar.md
// Do not edit manually

export type CalendarEventId = string;

export type RecurringSeriesId = string;

export type AttendeeId = string;

export type EventStatus = "DRAFT" | "CONFIRMED" | "RESCHEDULED" | "CANCELLED";

export type RSVPStatus = "INVITED" | "ACCEPTED" | "DECLINED" | "TENTATIVE";

export type AttendeeRole = "ORGANISER" | "REQUIRED" | "OPTIONAL";

export type VideoConferenceLink = {
provider: string;                // e.g. "zoom", "google_meet", "teams"
joinUrl: string;
meetingId?: string;
passcode?: string;
};

export type Recurrence = {
rrule: string;                   // RFC 5545 RRULE string, e.g. "FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10"
timezone: string;
exdates?: Timestamp[];           // Excluded dates (cancelled occurrences)
};

export type Attendee = {
attendeeId: AttendeeId;
userId?: UserId;
email: string;
displayName?: string;
role: AttendeeRole;
rsvpStatus: RSVPStatus;
respondedAt?: Timestamp;
rsvpComment?: string;
};

export type CreateEventInput = {
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

export type CalendarEvent = {
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

export type RecurringEventSeries = {
seriesId: RecurringSeriesId;
template: CreateEventInput;
recurrence: Recurrence;
createdAt: Timestamp;
};

export type CreateRecurringEventInput = CreateEventInput & {

export type UpdateEventInput = {
eventId: CalendarEventId;
title?: string;
description?: string;
location?: string;
videoConference?: VideoConferenceLink;
visibility?: "PUBLIC" | "PRIVATE" | "CONFIDENTIAL";
};

export type RescheduleEventInput = {
eventId: CalendarEventId;
newStartAt: Timestamp;
newEndAt: Timestamp;
timezone?: string;
reason?: string;
};

export type AddAttendeeInput = {
eventId: CalendarEventId;
email: string;
displayName?: string;
role: AttendeeRole;
};

export type RemoveAttendeeInput = {
eventId: CalendarEventId;
attendeeId: AttendeeId;
};

export type RSVPInput = {
eventId: CalendarEventId;
attendeeId: AttendeeId;
response: "ACCEPTED" | "DECLINED" | "TENTATIVE";
comment?: string;
};

export type AvailabilityQueryInput = {
userIds: UserId[];
fromDate: Timestamp;
toDate: Timestamp;
slotDurationMinutes: number;
timezone: string;
};

export type AvailabilityResult = {
startAt: Timestamp;
endAt: Timestamp;
availableUserIds: UserId[];
busyUserIds: UserId[];
};

export type OccurrenceQueryInput = {
fromDate: Timestamp;
toDate: Timestamp;
};

export type UpdateOccurrenceInput = UpdateEventInput & {

export interface CalendarContract {
  createEvent(input: CreateEventInput): Promise<CalendarEvent>;
  publishEvent(eventId: CalendarEventId): Promise<CalendarEvent>;
  getEvent(eventId: CalendarEventId): Promise<CalendarEvent>;
  listEvents(input: ListEventsInput): Promise<PaginatedList<CalendarEvent>>;
  updateEvent(input: UpdateEventInput): Promise<CalendarEvent>;
  rescheduleEvent(input: RescheduleEventInput): Promise<CalendarEvent>;
  cancelEvent(eventId: CalendarEventId, reason?: string): Promise<void>;
  addAttendee(input: AddAttendeeInput): Promise<CalendarEvent>;
  removeAttendee(input: RemoveAttendeeInput): Promise<CalendarEvent>;
  respondToInvitation(input: RSVPInput): Promise<CalendarEvent>;
  getAvailability(input: AvailabilityQueryInput): Promise<AvailabilityResult[]>;
  createRecurringEvent(input: CreateRecurringEventInput): Promise<RecurringEventSeries>;
  getOccurrences(seriesId: RecurringSeriesId, input: OccurrenceQueryInput): Promise<CalendarEvent[]>;
  updateOccurrence(input: UpdateOccurrenceInput): Promise<CalendarEvent>;
  cancelOccurrence(occurrenceId: CalendarEventId): Promise<void>;
}
