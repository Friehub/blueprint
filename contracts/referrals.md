# Module: referrals

**Version:** 0.1.0
**Part:** VI -- Platform Operations

## Purpose

Defines the interface for operating a referral and affiliate tracking system. A referral program allows an existing user (the referrer) to invite new users (the referees) and earn rewards when those referees complete qualifying actions. This module owns referral code issuance, attribution, conversion tracking, and reward triggering. It does not own the reward fulfillment itself -- that is delegated to `billing`, `loyalty`, or `payments` based on reward type.

---

## State Machine

### Referral State
```
PENDING → CONVERTED
        → EXPIRED
```

### Conversion State
```
PENDING → VALIDATED → REWARDED
        → INVALIDATED
```

Transitions:
- `PENDING → CONVERTED`: referee completes the qualifying action
- `PENDING → EXPIRED`: TTL elapsed before qualifying action
- `CONVERTED → VALIDATED`: conversion passes fraud and eligibility checks
- `CONVERTED → INVALIDATED`: conversion rejected (self-referral, fraud, duplicate)
- `VALIDATED → REWARDED`: reward has been issued to the referrer (and optionally the referee)

---

## Functions

### `createProgram(input: ProgramDefinition) → ReferralProgram`
Defines a referral program with qualifying conditions, reward rules, and attribution window. Multiple programs can coexist; a user is attributed to at most one program per signup.

### `issueCode(input: IssueCodeInput) → ReferralCode`
Generates a unique, shareable code tied to a referrer and optionally a specific program. Idempotent per `(referrerId, programId)`.

### `getCode(code: string) → ReferralCode`
Resolves a referral code to its referrer and program details. Used during signup to attribute the new user.

### `trackReferral(input: TrackReferralInput) → Referral`
Records that a referee has been attributed to a referrer via a specific code. Called at signup time.

### `recordConversion(input: RecordConversionInput) → ReferralConversion`
Records that a referee has completed the qualifying action (e.g., first purchase, verified account). Triggers validation and, if valid, reward issuance.

### `getReferral(referralId: ReferralId) → Referral`
Returns the referral record including conversion state.

### `listReferrals(input: ListReferralsInput) → PaginatedList<Referral>`
Returns all referrals for a given referrer or program, with optional status filtering.

### `getReferralStats(referrerId: UserId, programId?: ReferralProgramId) → ReferralStats`
Returns aggregate metrics for a referrer: total invites, conversions, pending rewards, and rewards issued.

### `deactivateProgram(programId: ReferralProgramId) → void`
Stops new code issuance and referral tracking for the program. Existing in-flight referrals continue to be processed.

---

## Types

```typescript
type ReferralProgramId = string;
type ReferralCodeId = string;
type ReferralId = string;
type ReferralConversionId = string;

type ReferralStatus = "PENDING" | "CONVERTED" | "EXPIRED";
type ConversionStatus = "PENDING" | "VALIDATED" | "REWARDED" | "INVALIDATED";

type RewardRule = {
  recipient: "REFERRER" | "REFEREE" | "BOTH";
  rewardType: "CREDIT" | "DISCOUNT" | "LOYALTY_POINTS" | "CASH";
  amount: number;
  currency?: string;               // Required for CREDIT and CASH types
  loyaltyPoints?: number;          // Required for LOYALTY_POINTS type
  discountPercent?: number;        // Required for DISCOUNT type
};

type QualifyingCondition = {
  action: string;                  // e.g. "first_purchase", "kyc_verified", "subscription_started"
  minValue?: number;               // e.g. minimum purchase amount
  currency?: string;
  windowDays: number;              // Days from referral attribution to complete the action
};

type ProgramDefinition = {
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

type ReferralProgram = ProgramDefinition & {
  programId: ReferralProgramId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

type ReferralCode = {
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

type Referral = {
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

type ReferralConversion = {
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

type IssueCodeInput = {
  referrerId: UserId;
  programId: ReferralProgramId;
  maxUsage?: number;
  expiresAt?: Timestamp;
};

type TrackReferralInput = {
  code: string;
  refereeId: UserId;
  attributedAt?: Timestamp;
};

type RecordConversionInput = {
  refereeId: UserId;
  triggeringAction: string;
  actionValue?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
};

type ListReferralsInput = {
  referrerId?: UserId;
  programId?: ReferralProgramId;
  status?: ReferralStatus;
  pagination: PaginationInput;
};

type ReferralStats = {
  referrerId: UserId;
  programId?: ReferralProgramId;
  totalInvites: number;
  totalConversions: number;
  pendingConversions: number;
  rewardsIssued: number;
  totalRewardValue: number;
  currency?: string;
};
```

---

## Invariants

1. A referee may be attributed to at most one referrer per program. Subsequent `trackReferral` calls for an already-attributed referee return the existing referral.
2. Self-referrals must be detected and `INVALIDATED` at the `recordConversion` stage, even if `selfReferralAllowed` is true in the program definition (it should never be true in production).
3. `recordConversion` must only trigger reward issuance after the conversion reaches `VALIDATED` state; reward issuance must not happen during `PENDING`.
4. A referral expires if the qualifying action is not completed within `qualifyingCondition.windowDays` of `attributedAt`.
5. `maxRewardsPerReferrer` is enforced at the `VALIDATED → REWARDED` transition; the conversion is `INVALIDATED` if the cap is already reached.
6. Referral codes are case-insensitive for lookup; storage preserves the original casing.

---

## Events Emitted

- `referral.code.issued`
- `referral.attributed` -- referee linked to referrer
- `referral.converted` -- qualifying action completed
- `referral.conversion.validated`
- `referral.conversion.invalidated` -- includes `invalidationReason`
- `referral.reward.issued` -- includes recipient, `rewardType`, and value
- `referral.expired`
- `referral.program.deactivated`

---

## Database Schema

#### PostgreSQL
```sql
CREATE TABLE referral_programs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  description           TEXT,
  active                BOOLEAN NOT NULL DEFAULT true,
  qualifying_condition  JSONB NOT NULL,
  reward_rules          JSONB NOT NULL,
  max_rewards_per_referrer INT,
  self_referral_allowed BOOLEAN NOT NULL DEFAULT false,
  code_prefix           TEXT,
  expiry_days           INT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE referral_codes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL,
  referrer_id   UUID NOT NULL,
  program_id    UUID NOT NULL REFERENCES referral_programs(id),
  usage_count   INT NOT NULL DEFAULT 0,
  max_usage     INT,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX idx_referral_codes_code ON referral_codes(LOWER(code));
CREATE INDEX idx_referral_codes_referrer ON referral_codes(referrer_id, program_id);

CREATE TABLE referrals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL,
  referrer_id     UUID NOT NULL,
  referee_id      UUID NOT NULL,
  program_id      UUID NOT NULL REFERENCES referral_programs(id),
  status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'CONVERTED', 'EXPIRED')),
  attributed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id, status);
CREATE INDEX idx_referrals_referee ON referrals(referee_id);
CREATE UNIQUE INDEX idx_referrals_referee_program ON referrals(referee_id, program_id);

CREATE TABLE referral_conversions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id         UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING', 'VALIDATED', 'REWARDED', 'INVALIDATED')),
  triggering_action   TEXT NOT NULL,
  action_value        BIGINT,
  currency            TEXT,
  invalidation_reason TEXT,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  validated_at        TIMESTAMPTZ,
  rewarded_at         TIMESTAMPTZ
);

CREATE INDEX idx_referral_conversions_referral ON referral_conversions(referral_id);
```

## System-Level Integrations

- **Idempotency:** `issueCode` is idempotent on `(referrerId, programId)`; returns existing code. `recordConversion` is idempotent on `(refereeId, triggeringAction)`.
- **Consistency:** Attribution and conversion must be written in the same transaction or via a saga; partial writes that leave a conversion without a referral record are invalid.
- **Observability:** The full referral funnel (attributed → converted → validated → rewarded) must be traceable as linked spans on a single root trace.
```
gensense_referrals_operation_total          counter { function, result: success|failure }
gensense_referrals_operation_duration_ms    histogram { function, p50, p95, p99 }
gensense_referrals_errors_total             counter { function, error_code }
gensense_referrals_attributed_total         counter { program_id }
gensense_referrals_converted_total          counter { program_id }
gensense_referrals_validated_total          counter { program_id }
gensense_referrals_rewarded_total           counter { reward_type }
gensense_referrals_invalidated_total        counter { reason }
gensense_referrals_fraud_detected_total     counter
```
- **Dependencies:** `users` (referrer/referee identity), `billing` or `loyalty` or `payments` (reward fulfillment), `fraud_detection` (self-referral and gaming detection), `notifications` (reward delivery).
- **Errors:** `PROGRAM_NOT_FOUND`, `CODE_NOT_FOUND`, `CODE_EXPIRED`, `CODE_EXHAUSTED`, `REFERRAL_NOT_FOUND`, `REFEREE_ALREADY_ATTRIBUTED`, `SELF_REFERRAL_DETECTED`, `REWARD_CAP_REACHED`.
### Failure Modes
| Scenario | Behavior |
|---|---|
| Database unreachable | Return provider_error, do not retry indefinitely |
| Provider rate limited | Respect Retry-After header, apply exponential backoff |
| Partial success in batch | Return partial_success with succeeded[] and failed[] |

### Breaking Change Policy
- Adding a new optional parameter: non-breaking
- Removing a parameter: breaking — requires major version bump and migration guide
- Changing a type from nullable to required: breaking
- Adding a new enum value: non-breaking if consumers use exhaustive enum handling; breaking otherwise

- **Providers (adapter examples):** Custom implementation, ReferralHero, Friendbuy, Rewardful (affiliate), Impact.com.
