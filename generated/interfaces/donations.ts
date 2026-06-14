// donations.ts
// Auto-generated from contracts/donations.md
// Do not edit manually

export interface Campaign {
  id: string;
  title: unknown;
  goal: unknown;
  currency: unknown;
  raised: unknown;
  status: unknown;
  endAt: Timestamp;
}

export interface Donation {
  id: string;
  campaignId: string;
  amount: unknown;
  currency: unknown;
  anonymous: unknown;
  createdAt: Timestamp;
}

export interface Campaignstats {
  raised: unknown;
  donorCount: number;
  goal: unknown;
  percentageFunded: unknown;
}

export interface DonationsContract {
  createCampaign(data: unknown): Promise<Campaign>;
  getCampaign(campaignId: unknown): Promise<Campaign>;
  listCampaigns(filters?: unknown): Promise<PaginatedResult<Campaign>>;
  donate(campaignId: unknown, donorId: unknown, amount: unknown, currency: unknown, method: unknown): Promise<Donation>;
  getDonation(donationId: unknown): Promise<Donation>;
  getDonationsByCampaign(campaignId: unknown, options?: unknown): Promise<PaginatedResult<Donation>>;
  getCampaignStats(campaignId: unknown): Promise<CampaignStats>;
  issueCertificate(donationId: unknown): Promise<Certificate>;
}
