// seat_pricing.ts
// Auto-generated from contracts/seat_pricing.md
// Do not edit manually

export interface Seatpricerule {
  id: string;
  accountId: string;
  pricingModel: unknown;
  unitPrice: number;
  currency: unknown;
  effectiveAt: Timestamp;
}

export interface Seatpricequote {
  accountId: string;
  seatCount: number;
  subtotal: unknown;
  discountTotal: number;
  total: unknown;
  currency: unknown;
  effectiveAt: Timestamp;
}

export interface Seatpriceadjustment {
  id: string;
  accountId: string;
  amount: unknown;
  currency: unknown;
  reason: unknown;
  createdAt: Timestamp;
}

export type Pricingmodel = PricingModel = flat | volume | tiered | overage | negotiated;

export interface SeatPricingContract {
  createSeatPriceRule(accountId: unknown, rule: unknown): Promise<SeatPriceRule>;
  getSeatPriceRule(accountId: unknown, seatType?: unknown): Promise<SeatPriceRule | undefined>;
  listSeatPriceRules(accountId: unknown, options?: unknown): Promise<PaginatedResult<SeatPriceRule>>;
  updateSeatPriceRule(ruleId: unknown, data: unknown): Promise<SeatPriceRule>;
  archiveSeatPriceRule(ruleId: unknown): Promise<SeatPriceRule>;
  quoteSeatCost(accountId: unknown, seatCount: unknown, seatType?: unknown, effectiveAt?: unknown): Promise<SeatPriceQuote>;
  applySeatAdjustment(accountId: unknown, adjustment: unknown): Promise<SeatPriceAdjustment>;
}
