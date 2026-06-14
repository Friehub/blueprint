// loyalty.ts
// Auto-generated from contracts/loyalty.md
// Do not edit manually

export interface Loyaltybalance {
  userId: string;
  points: unknown;
  lifetimePoints: unknown;
  tier: unknown;
}

export interface Loyaltytier {
  name: unknown;
  minimumPoints: unknown;
  multiplier: unknown;
  benefits: unknown;
}

export interface Loyaltytransaction {
  id: string;
  type: earn|redeem|expire|adjust;
  amount: unknown;
  balanceAfter: unknown;
  reference: unknown;
}

export interface Tierprogress {
  currentTier: unknown;
}

export interface LoyaltyContract {
  getBalance(userId: unknown): Promise<LoyaltyBalance>;
  earnPoints(userId: unknown, amount: unknown, reason: unknown, reference: unknown): Promise<LoyaltyTransaction>;
  redeemPoints(userId: unknown, amount: unknown, reference: unknown): Promise<LoyaltyTransaction>;
  getTransactions(userId: unknown, options?: unknown): Promise<PaginatedResult<LoyaltyTransaction>>;
  getTier(userId: unknown): Promise<LoyaltyTier>;
  calculateTierProgress(userId: unknown): Promise<TierProgress>;
  getRewards(tier?: unknown): Promise<Reward[]>;
  redeemReward(userId: unknown, rewardId: unknown): Promise<RewardRedemption>;
}
