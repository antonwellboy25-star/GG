export type TelegramProfile = {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  isPremium?: boolean;
  photoUrl?: string;
};

export type TelegramInfo = {
  profile: TelegramProfile | null;
  startParam: string | null;
  referralCode: string | null;
  referralLink: string;
};

const BOT_USERNAME = "GGmainer_bot";
const BOT_LINK = `https://t.me/${BOT_USERNAME}`;

const readWebApp = () => (typeof window === "undefined" ? undefined : window.Telegram?.WebApp);

const mapUser = (user?: TelegramWebAppUser | null): TelegramProfile | null => {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name ?? undefined,
    username: user.username ?? undefined,
    languageCode: user.language_code ?? undefined,
    isPremium: user.is_premium ?? undefined,
    photoUrl: user.photo_url ?? undefined,
  };
};

export const buildReferralCode = (profile: TelegramProfile | null): string | null => {
  if (!profile) return null;
  if (profile.username && profile.username.trim().length > 0) {
    return profile.username.trim();
  }
  return `id${profile.id}`;
};

export const buildReferralLink = (code: string | null | undefined): string => {
  if (!code) {
    return BOT_LINK;
  }
  return `${BOT_LINK}?start=ref_${encodeURIComponent(code)}`;
};

export const getTelegramInfo = (): TelegramInfo => {
  const webApp = readWebApp();
  const profile = mapUser(webApp?.initDataUnsafe?.user);
  const referralCode = buildReferralCode(profile);
  const startParam = webApp?.initDataUnsafe?.start_param ?? null;
  const referralLink = buildReferralLink(referralCode);

  return {
    profile,
    startParam,
    referralCode,
    referralLink,
  };
};

export const getTelegramProfile = (): TelegramProfile | null => getTelegramInfo().profile;
