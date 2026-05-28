// referrals.ts
// Auto-generated from contracts/referrals.md
// Do not edit manually

export type ReferralProgramId = string;

export type ReferralCodeId = string;

export type ReferralId = string;

export type ReferralConversionId = string;

export type ReferralStatus = "PENDING" | "CONVERTED" | "EXPIRED";

export type ConversionStatus = "PENDING" | "VALIDATED" | "REWARDED" | "INVALIDATED";

export type RewardRule = {
recipient: "REFERRER" | "REFEREE" | "BOTH";
rewardType: "CREDIT" | "DISCOUNT" | "LOYALTY_POINTS" | "CASH";
amount: number;
currency?: string;               // Required for CREDIT and CASH types
loyaltyPoints?: number;          // Required for LOYALTY_POINTS type
discountPercent?: number;        // Required for DISCOUNT type
};

export type QualifyingCondition = {
action: string;                  // e.g. "first_purchase", "kyc_verified", "subscription_started"
minValue?: number;               // e.g. minimum purchase amount
currency?: string;
windowDays: number;              // Days from referral attribution to complete the action
};

export type ProgramDefinition = {
name: string;
description?: string;
active: boolean;
qualifyingCondition: QualifyingCondition;
rewardRules: RewardRule[];
maxRewardsPerReferrer?: number;  // null = unlimited
selfReferralAllowed: boolean;    // Always false in well-behaved programs
codePrefix?: string;
expiryDays?: number;             // Days a referral remains PENDING before EXPIRED
};

export type ReferralProgram = ProgramDefinition & {

export type ReferralCode = {
codeId: ReferralCodeId;
code: string;
referrerId: UserId;
programId: ReferralProgramId;
usageCount: number;
maxUsage?: number;               // null = unlimited
active: boolean;
createdAt: Timestamp;
expiresAt?: Timestamp;
};

export type Referral = {
referralId: ReferralId;
code: string;
referrerId: UserId;
refereeId: UserId;
programId: ReferralProgramId;
status: ReferralStatus;
attributedAt: Timestamp;
convertedAt?: Timestamp;
expiresAt?: Timestamp;
conversion?: ReferralConversion;
};

export type ReferralConversion = {
conversionId: ReferralConversionId;
referralId: ReferralId;
status: ConversionStatus;
triggeringAction: string;
actionValue?: number;
currency?: string;
recordedAt: Timestamp;
validatedAt?: Timestamp;
rewardedAt?: Timestamp;
invalidationReason?: string;
};

export type IssueCodeInput = {
referrerId: UserId;
programId: ReferralProgramId;
maxUsage?: number;
expiresAt?: Timestamp;
};

export type TrackReferralInput = {
code: string;
refereeId: UserId;
attributedAt?: Timestamp;
};

export type RecordConversionInput = {
refereeId: UserId;
triggeringAction: string;
actionValue?: number;
currency?: string;
metadata?: Record<string, unknown>;
};

export type ListReferralsInput = {
referrerId?: UserId;
programId?: ReferralProgramId;
status?: ReferralStatus;
pagination: PaginationInput;
};

export type ReferralStats = {
referrerId: UserId;
programId?: ReferralProgramId;
totalInvites: number;
totalConversions: number;
pendingConversions: number;
rewardsIssued: number;
totalRewardValue: number;
currency?: string;
};

export interface ReferralsContract {
  createProgram(input: ProgramDefinition): Promise<ReferralProgram>;
  issueCode(input: IssueCodeInput): Promise<ReferralCode>;
  getCode(code: string): Promise<ReferralCode>;
  trackReferral(input: TrackReferralInput): Promise<Referral>;
  recordConversion(input: RecordConversionInput): Promise<ReferralConversion>;
  getReferral(referralId: ReferralId): Promise<Referral>;
  listReferrals(input: ListReferralsInput): Promise<PaginatedList<Referral>>;
  getReferralStats(referrerId: UserId, programId?: ReferralProgramId): Promise<ReferralStats>;
  deactivateProgram(programId: ReferralProgramId): Promise<void>;
}
