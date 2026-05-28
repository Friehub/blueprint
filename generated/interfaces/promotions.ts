// promotions.ts
// Auto-generated from contracts/promotions.md
// Do not edit manually

export interface Promotion {
  id: string;
  type: unknown;
  value: unknown;
  conditions: unknown;
  startAt: Timestamp;
  endAt: Timestamp;
}

export interface Coupon {
  code: unknown;
  promotionId: string;
  usedCount: number;
}

export interface Flashsale {
  variantId: string;
  salePrice: number;
  startAt: Timestamp;
  endAt: Timestamp;
}

export interface Couponvalidation {
  valid: unknown;
}

export type Promotiontype = PromotionType = percentage | fixed_amount | free_shipping | buy_x_get_y;

export interface Giftcard {
  code: unknown;
  balance: unknown;
  currency: unknown;
  status: unknown;
  issuedAt: Timestamp;
}

export interface Giftcardredemption {
  id: string;
  code: unknown;
  orderId: string;
  amount: unknown;
  currency: unknown;
  createdAt: Timestamp;
}

export type Giftcardstatus = GiftCardStatus = active | partially_redeemed | redeemed | void | expired;

export interface PromotionsContract {
  validateCoupon(code: unknown, cartId: unknown, userId?: unknown): Promise<CouponValidation>;
  markCouponUsed(code: unknown, orderId: unknown, userId: unknown): Promise<void>;
  getActiveFlashSales(): Promise<FlashSale[]>;
  getFlashSaleForVariant(variantId: unknown): Promise<FlashSale | undefined>;
  applyPromotionToCart(cartId: unknown, promotionId: unknown): Promise<Cart>;
  getEligiblePromotions(cartId: unknown, userId?: unknown): Promise<Promotion[]>;
  createPromotion(data: unknown): Promise<Promotion>;
  archivePromotion(promotionId: unknown): Promise<void>;
  issueGiftCard(data: unknown): Promise<GiftCard>;
  getGiftCard(code: unknown): Promise<GiftCard>;
  listGiftCards(input: unknown, options?: unknown): Promise<PaginatedResult<GiftCard>>;
  redeemGiftCard(code: unknown, orderId: unknown, amount: unknown): Promise<GiftCardRedemption>;
  voidGiftCard(code: unknown, reason: unknown): Promise<GiftCard>;
}
