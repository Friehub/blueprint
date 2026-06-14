// Shared types used across all contracts
export type Timestamp = string;
export type UserId = string;
export type EntityId = string;

export interface PaginatedResult<T> {
  data: T[];
  cursor: string | null;
  hasMore: boolean;
  total?: number;
}
