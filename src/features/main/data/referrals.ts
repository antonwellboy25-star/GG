export type ReferralStats = {
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: number;
};

export const REFERRAL_REWARD_RATE = 0.1;
export const REFERRAL_BOT_USERNAME = "GGmainer_bot";
export const REFERRAL_BOT_LINK = `https://t.me/${REFERRAL_BOT_USERNAME}`;

export const EMPTY_REFERRAL_STATS: ReferralStats = {
  totalReferrals: 0,
  activeReferrals: 0,
  totalEarned: 0,
};
