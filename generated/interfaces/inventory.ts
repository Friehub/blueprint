// inventory.ts
// Auto-generated from contracts/inventory.md
// Do not edit manually

export interface Stocklevel {
  variantId: string;
  onHand: unknown;
  reserved: unknown;
  available: unknown;
}

export interface Stockreservation {
  token: unknown;
  variantId: string;
  quantity: unknown;
  expiresAt: Timestamp;
}

export type Reservationtoken = ReservationToken = string (opaque);

export interface Stockadjustment {
  id: string;
  variantId: string;
  delta: unknown;
  reason: unknown;
  createdAt: Timestamp;
}

export interface InventoryContract {
  getStockLevel(variantId: unknown, locationId?: unknown): Promise<StockLevel>;
  getStockLevels(variantIds: unknown): Promise<StockLevel[]>;
  reserveStock(variantId: unknown, quantity: unknown, orderId: unknown): Promise<StockReservation>;
  releaseStock(reservationToken: unknown): Promise<void>;
  confirmStock(reservationToken: unknown): Promise<void>;
  updateStockOnHand(variantId: unknown, quantity: unknown, locationId?: unknown): Promise<void>;
  adjustStock(variantId: unknown, delta: unknown, reason: unknown): Promise<StockAdjustment>;
  getStockHistory(variantId: unknown): Promise<StockAdjustment[]>;
  getLowStockAlerts(threshold?: unknown): Promise<StockLevel[]>;
}
