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

// Bot username and Mini App short name are configurable via env.
// VITE_TG_BOT: bot username without @ (e.g., "MyCoolBot")
// VITE_TG_MINIAPP: Mini App short name set in @BotFather (optional)
const BOT_USERNAME = import.meta.env.VITE_TG_BOT ?? "GGmainer_bot";
const BOT_LINK = `https://t.me/${BOT_USERNAME}`;
const MINIAPP_SHORT_NAME: string = import.meta.env.VITE_TG_MINIAPP ?? "";

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
  // Prefer explicit Mini App short name (https://t.me/<bot>/<miniapp>) when provided.
  // Fallback to base bot link; startapp will still work: https://t.me/<bot>?startapp=...
  return MINIAPP_SHORT_NAME ? `${BOT_LINK}/${MINIAPP_SHORT_NAME}` : BOT_LINK;
};

export const buildReferralLinks = (
  code: string | null | undefined,
  options?: BuildReferralLinkOptions,
): ReferralLinks => {
  const payload = composeReferralPayload({ code, campaign: options?.campaign });
  const botLink = buildLinkWithQuery(BOT_LINK, "start", payload);
  const webAppBase = resolveWebAppBaseLink();
  // Always use startapp for Mini App deep links (latest Telegram Web Apps docs)
  const webAppLink = buildLinkWithQuery(webAppBase, "startapp", payload);

  // Native tg:// link: prefer startapp (opens Mini App directly). If MINIAPP_SHORT_NAME is known,
  // you can also pass &appname=<short_name>, but it's optional for the primary app.
  const nativeBase = `tg://resolve?domain=${BOT_USERNAME}`;
  const nativeLink = buildLinkWithQuery(nativeBase, "startapp", payload);

  // Universal: prefer Mini App deep link when payload is present, otherwise simple bot link
  const universal = payload ? buildLinkWithQuery(BOT_LINK, "startapp", payload) : botLink;

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
  // start_param from initData is primary; fallback to URL param in cases when opened outside Telegram
  // or via testing. See https://core.telegram.org/bots/webapps#launch-parameters
  const urlStartParam = (() => {
    try {
      if (typeof window === "undefined") return null;
      const sp = new URLSearchParams(window.location.search);
      return sp.get("tgWebAppStartParam");
    } catch {
      return null;
    }
  })();
  const startParam = webApp?.initDataUnsafe?.start_param ?? urlStartParam ?? null;
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
