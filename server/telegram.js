import crypto from "node:crypto";
import {
  ALLOW_UNSAFE_TELEGRAM,
  TELEGRAM_BOT_TOKEN,
  isProduction,
} from "./config.js";

const REQUIRED_HEADER = "X-Telegram-Init-Data";

const parseTelegramInitData = (initData) => {
  const params = new URLSearchParams(initData);
  const userJson = params.get("user");
  if (!userJson) {
    throw new Error("Missing user data in init payload");
  }

  const hash = params.get("hash");
  if (TELEGRAM_BOT_TOKEN) {
    const dataCheckString = Array.from(params.entries())
      .filter(([key]) => key !== "hash")
      .map(([key, value]) => `${key}=${value}`)
      .sort()
      .join("\n");

    const secretKey = crypto
      .createHash("sha256")
      .update(TELEGRAM_BOT_TOKEN)
      .digest();
    const calculatedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (calculatedHash !== hash) {
      throw new Error("Invalid Telegram init data hash");
    }
  } else if (isProduction) {
    throw new Error("TELEGRAM_BOT_TOKEN is required in production");
  }

  const user = JSON.parse(userJson);
  return {
    user,
    authDate: Number.parseInt(params.get("auth_date") ?? "0", 10) || null,
    queryId: params.get("query_id") ?? null,
    startParam: params.get("start_param") ?? null,
    raw: initData,
  };
};

const parseDebugUser = (headerValue) => {
  try {
    const parsed = JSON.parse(headerValue);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.id) return null;
    return { user: parsed, raw: "debug" };
  } catch {
    return null;
  }
};

export const telegramAuthMiddleware = (req, res, next) => {
  const initData = req.get(REQUIRED_HEADER);

  if (!initData) {
    if (ALLOW_UNSAFE_TELEGRAM && !isProduction) {
      const debugHeader = req.get("X-Debug-Telegram-User");
      const fallback = debugHeader ? parseDebugUser(debugHeader) : null;
      if (fallback) {
        req.telegram = fallback;
        return next();
      }
    }
    return res.status(401).json({ error: "Missing Telegram init data" });
  }

  try {
    req.telegram = parseTelegramInitData(initData);
    return next();
  } catch (error) {
    if (ALLOW_UNSAFE_TELEGRAM && !isProduction) {
      const debugHeader = req.get("X-Debug-Telegram-User");
      const fallback = debugHeader ? parseDebugUser(debugHeader) : null;
      if (fallback) {
        req.telegram = fallback;
        return next();
      }
    }

    return res.status(401).json({ error: "Invalid Telegram init data", detail: error.message });
  }
};

export const requireTelegramUser = (req) => {
  const user = req.telegram?.user;
  if (!user || typeof user.id === "undefined") {
    throw new Error("Telegram user context missing");
  }
  return user;
};
