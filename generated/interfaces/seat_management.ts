// seat_management.ts
// Auto-generated from contracts/seat_management.md
// Do not edit manually

export interface Seatassignment {
  id: string;
  accountId: string;
  userId: string;
  seatType: string;
  status: unknown;
  assignedAt: Timestamp;
}

export interface Seatusage {
  accountId: string;
  assigned: unknown;
  available: unknown;
  limit: unknown;
  overage: unknown;
}

export interface Seatpolicy {
  accountId: string;
  seatType: string;
  limit: unknown;
  overageAllowed: unknown;
  effectiveAt: Timestamp;
}

export type Seattype = SeatType = licensed | admin | viewer | custom;

export type Seatstatus = SeatStatus = active | released | transferred;

export interface SeatManagementContract {
  assignSeat(accountId: unknown, userId: unknown, seatType?: unknown): Promise<SeatAssignment>;
  releaseSeat(accountId: unknown, userId: unknown): Promise<void>;
  transferSeat(accountId: unknown, fromUserId: unknown, toUserId: unknown): Promise<SeatAssignment>;
  listSeats(accountId: unknown, options?: unknown): Promise<PaginatedResult<SeatAssignment>>;
  getSeatUsage(accountId: unknown): Promise<SeatUsage>;
  setSeatLimit(accountId: unknown, seatType: unknown, limit: unknown): Promise<SeatPolicy>;
  getSeatPolicy(accountId: unknown): Promise<SeatPolicy>;
}
