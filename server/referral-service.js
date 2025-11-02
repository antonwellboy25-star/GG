import crypto from "node:crypto";
import db from "./db.js";
import {
  TELEGRAM_BOT_USERNAME,
  TELEGRAM_MINIAPP_SHORT_NAME,
} from "./config.js";

const REFERRAL_PREFIX = "ref";
const REFERRAL_CAMPAIGN_PREFIX = "cmp";

const randomCode = () => crypto.randomBytes(12).toString("base64url").slice(0, 16);

const sanitizePart = (value) =>
  value
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 32);

const composeReferralPayload = ({ code, campaign } = {}) => {
  const normalizedCode = code ? sanitizePart(code) : "";
  const normalizedCampaign = campaign ? sanitizePart(campaign) : "";

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

const buildLinkWithQuery = (base, key, payload) => {
  if (!payload) return base;
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}${key}=${encodeURIComponent(payload)}`;
};

const BOT_LINK = `https://t.me/${TELEGRAM_BOT_USERNAME}`;
const resolveWebAppBase = () =>
  TELEGRAM_MINIAPP_SHORT_NAME ? `${BOT_LINK}/${TELEGRAM_MINIAPP_SHORT_NAME}` : BOT_LINK;

export const buildReferralLinks = (code, options = {}) => {
  const payload = composeReferralPayload({ code, campaign: options.campaign });
  const botLink = buildLinkWithQuery(BOT_LINK, "start", payload);
  const webAppBase = resolveWebAppBase();
  const webApp = buildLinkWithQuery(webAppBase, "startapp", payload);
  const nativeBase = `tg://resolve?domain=${TELEGRAM_BOT_USERNAME}`;
  const native = buildLinkWithQuery(nativeBase, "startapp", payload);
  const universal = payload ? buildLinkWithQuery(BOT_LINK, "startapp", payload) : botLink;

  return {
    payload,
    bot: botLink,
    webApp,
    native,
    universal,
  };
};

export const parseReferralPayload = (raw) => {
  if (!raw || typeof raw !== "string") {
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

  let code = null;
  let campaign = null;

  for (const segment of segments.slice(1)) {
    if (!segment) continue;
    if (segment.startsWith(`${REFERRAL_CAMPAIGN_PREFIX}-`)) {
      campaign = segment.slice(REFERRAL_CAMPAIGN_PREFIX.length + 1) || null;
    } else if (!code) {
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

const getCodeStmt = db.prepare(
  "SELECT code, created_at AS createdAt FROM referral_codes WHERE user_id = ?",
);
const insertCodeStmt = db.prepare(
  "INSERT INTO referral_codes (user_id, code) VALUES (?, ?)",
);

export const getOrCreateReferralCode = (userId) => {
  const normalizedId = String(userId);
  const existing = getCodeStmt.get(normalizedId);
  if (existing) return existing;

  let code;
  let attempts = 0;
  do {
    code = randomCode();
    attempts += 1;
  } while (
    attempts < 5 &&
    db.prepare("SELECT 1 FROM referral_codes WHERE code = ?").get(code) != null
  );

  insertCodeStmt.run(normalizedId, code);
  return { code, createdAt: new Date().toISOString() };
};

const findCodeStmt = db.prepare(
  "SELECT user_id AS userId, code, created_at AS createdAt FROM referral_codes WHERE code = ?",
);

export const findReferralOwnerByCode = (code) => findCodeStmt.get(code);

const getRelationByReferredStmt = db.prepare(
  "SELECT * FROM referral_relations WHERE referred_user_id = ?",
);
const insertRelationStmt = db.prepare(`
  INSERT INTO referral_relations (
    referrer_id,
    referred_user_id,
    campaign,
    last_activity_at,
    referred_username,
    referred_first_name,
    referred_last_name
  ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
`);

export const createReferralRelation = (referrerId, referredUser, options = {}) => {
  const referredId = String(referredUser.id);
  const existing = getRelationByReferredStmt.get(referredId);
  if (existing) {
    return { created: false, relation: existing };
  }

  insertRelationStmt.run(
    String(referrerId),
    referredId,
    options.campaign ?? null,
    referredUser.username ?? null,
    referredUser.first_name ?? null,
    referredUser.last_name ?? null,
  );

  return {
    created: true,
    relation: getRelationByReferredStmt.get(referredId),
  };
};

const statsSummaryStmt = db.prepare(
  `SELECT
      COUNT(*) AS totalReferrals,
      SUM(CASE WHEN total_earned > 0 THEN 1 ELSE 0 END) AS activeReferrals,
      COALESCE(SUM(total_earned), 0) AS totalEarned
    FROM referral_relations
    WHERE referrer_id = ?`,
);

const statsDetailsStmt = db.prepare(
  `SELECT
      referred_user_id AS userId,
      referred_username AS username,
      referred_first_name AS firstName,
      referred_last_name AS lastName,
      campaign,
      created_at AS joinedAt,
      total_earned AS totalEarned,
      last_bonus_at AS lastBonusAt,
      last_activity_at AS lastActivityAt
    FROM referral_relations
    WHERE referrer_id = ?
    ORDER BY datetime(created_at) DESC
  `,
);

export const getReferralStatsForUser = (referrerId) => {
  const summary = statsSummaryStmt.get(referrerId) ?? {
    totalReferrals: 0,
    activeReferrals: 0,
    totalEarned: 0,
  };

  return {
    totalReferrals: Number(summary.totalReferrals ?? 0),
    activeReferrals: Number(summary.activeReferrals ?? 0),
    totalEarned: Number(summary.totalEarned ?? 0),
    referrals: statsDetailsStmt.all(referrerId).map((row) => ({
      ...row,
      totalEarned: Number(row.totalEarned ?? 0),
    })),
  };
};

const updateActivityStmt = db.prepare(
  `UPDATE referral_relations
    SET total_earned = total_earned + ?,
        last_bonus_at = CURRENT_TIMESTAMP,
        last_activity_at = CURRENT_TIMESTAMP
    WHERE referred_user_id = ?
  `,
);

export const awardReferralBonus = ({ referredUserId, goldEarned }) => {
  const normalizedId = String(referredUserId);
  const relation = getRelationByReferredStmt.get(normalizedId);
  if (!relation) {
    return { awarded: false };
  }

  const bonus = Math.floor(goldEarned * 0.1);
  if (bonus <= 0) {
    return { awarded: false, referrerId: relation.referrer_id, bonus: 0 };
  }

  updateActivityStmt.run(bonus, normalizedId);

  return {
    awarded: true,
    bonus,
    referrerId: relation.referrer_id,
  };
};

export const getRelationByReferred = (referredUserId) =>
  getRelationByReferredStmt.get(String(referredUserId));
