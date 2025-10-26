export type ReferralStats = {
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: number;
};

export type ReferralEntry = {
  id: number;
  name: string;
  earned: number;
  sessions: number;
};

export const referralCode = "GG12345";
export const referralLink = "https://t.me/YourBot?start=ref_12345";

export const stats: ReferralStats = {
  totalReferrals: 24,
  activeReferrals: 18,
  totalEarned: 3_420,
};

export const topReferrals: ReferralEntry[] = [
  { id: 1, name: "User #8234", earned: 450, sessions: 12 },
  { id: 2, name: "User #3421", earned: 380, sessions: 9 },
  { id: 3, name: "User #7891", earned: 290, sessions: 7 },
];
