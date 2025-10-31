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
  referralLinks: ReferralLinks;
  incomingReferral: ReferralContext;
};

const BOT_USERNAME = "GGmainer_bot";
const BOT_LINK = `https://t.me/${BOT_USERNAME}`;
const BOT_WEBAPP_PATH = "app";

const REFERRAL_PREFIX = "ref";
const REFERRAL_CAMPAIGN_PREFIX = "cmp";

export type BuildReferralLinkOptions = {
  campaign?: string | null;
};

export type ReferralLinks = {
  universal: string;
  webApp: string;
  bot: string;
  native: string;
  payload: string | null;
};

export type ReferralContext = {
  raw: string | null;
  code: string | null;
  campaign: string | null;
  isReferral: boolean;
};

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

const sanitizeReferralPart = (value: string) =>
  value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 32);

const composeReferralPayload = ({
  code,
  campaign,
}: {
  code?: string | null;
  campaign?: string | null;
}): string | null => {
  const normalizedCode = code ? sanitizeReferralPart(code) : "";
  const normalizedCampaign = campaign ? sanitizeReferralPart(campaign) : "";

  if (!normalizedCode && !normalizedCampaign) {
    return null;
  }

  const segments = [REFERRAL_PREFIX];
  if (normalizedCode) {
    segments.push(normalizedCode);
  }
  if (normalizedCampaign) {
    segments.push(`${REFERRAL_CAMPAIGN_PREFIX}-${normalizedCampaign}`);
  }

  const payload = segments.join("__");
  return payload.length > 64 ? payload.slice(0, 64) : payload;
};

const buildLinkWithQuery = (base: string, key: "start" | "startapp", payload: string | null) => {
  if (!payload) {
    return base;
  }
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${key}=${encodeURIComponent(payload)}`;
};

const resolveWebAppBaseLink = () => {
  if (!BOT_WEBAPP_PATH) {
    return BOT_LINK;
  }
  return `${BOT_LINK}/${BOT_WEBAPP_PATH}`;
};

export const buildReferralLinks = (
  code: string | null | undefined,
  options?: BuildReferralLinkOptions,
): ReferralLinks => {
  const payload = composeReferralPayload({ code, campaign: options?.campaign });
  const botLink = buildLinkWithQuery(BOT_LINK, "start", payload);
  const webAppBase = resolveWebAppBaseLink();
  const webAppLink = buildLinkWithQuery(webAppBase, "startapp", payload);

  const nativeLink = payload
    ? `tg://resolve?domain=${BOT_USERNAME}&start=${encodeURIComponent(payload)}`
    : `tg://resolve?domain=${BOT_USERNAME}`;

  // Share the web app deep-link when possible to deliver users directly into the Mini App.
  const universal = payload ? webAppLink : botLink;

  return {
    universal,
    webApp: webAppLink,
    bot: botLink,
    native: nativeLink,
    payload,
  };
};

export const buildReferralLink = (
  code: string | null | undefined,
  options?: BuildReferralLinkOptions,
): string => buildReferralLinks(code, options).universal;

export const parseReferralPayload = (raw: string | null | undefined): ReferralContext => {
  if (!raw) {
    return { raw: null, code: null, campaign: null, isReferral: false };
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return { raw: null, code: null, campaign: null, isReferral: false };
  }

  const segments = trimmed.split("__");
  if (segments[0] !== REFERRAL_PREFIX) {
    return { raw: trimmed, code: null, campaign: null, isReferral: false };
  }

  let code: string | null = null;
  let campaign: string | null = null;

  for (const segment of segments.slice(1)) {
    if (!segment) continue;
    if (segment.startsWith(`${REFERRAL_CAMPAIGN_PREFIX}-`)) {
      campaign = segment.slice(REFERRAL_CAMPAIGN_PREFIX.length + 1) || null;
      continue;
    }
    if (!code) {
      code = segment;
    }
  }

  return {
    raw: trimmed,
    code,
    campaign,
    isReferral: Boolean(code || campaign),
  };
};

export const getTelegramInfo = (): TelegramInfo => {
  const webApp = readWebApp();
  const profile = mapUser(webApp?.initDataUnsafe?.user);
  const referralCode = buildReferralCode(profile);
  const startParam = webApp?.initDataUnsafe?.start_param ?? null;
  const incomingReferral = parseReferralPayload(startParam);
  const referralLinks = buildReferralLinks(referralCode);

  return {
    profile,
    startParam,
    referralCode,
    referralLinks,
    incomingReferral,
  };
};

export const getTelegramProfile = (): TelegramProfile | null => getTelegramInfo().profile;
