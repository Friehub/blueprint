// appointments.ts
// Auto-generated from contracts/appointments.md
// Do not edit manually

export interface Slot {
  id: string;
  providerId: string;
  startAt: Timestamp;
  endAt: Timestamp;
  available: unknown;
  serviceId: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  providerId: string;
  slot: unknown;
  status: unknown;
  createdAt: Timestamp;
}

export type Appointmentstatus = AppointmentStatus = requested | confirmed | completed | cancelled | no_show;

export interface Waitlistentry {
  id: string;
  userId: string;
  position: unknown;
}

export interface AppointmentsContract {
  getAvailability(providerId: unknown, dateRange: unknown): Promise<Slot[]>;
  bookAppointment(patientId: unknown, providerId: unknown, slotId: unknown, data: unknown): Promise<Appointment>;
  getAppointment(appointmentId: unknown): Promise<Appointment>;
  getAppointmentsByUser(userId: unknown, options?: unknown): Promise<PaginatedResult<Appointment>>;
  cancelAppointment(appointmentId: unknown, reason: unknown): Promise<Appointment>;
  rescheduleAppointment(appointmentId: unknown, slotId: unknown): Promise<Appointment>;
  confirmAppointment(appointmentId: unknown): Promise<Appointment>;
  getWaitlist(providerId: unknown, serviceId: unknown): Promise<WaitlistEntry[]>;
  joinWaitlist(userId: unknown, providerId: unknown, serviceId: unknown): Promise<WaitlistEntry>;
}
