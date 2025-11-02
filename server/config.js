import { config as loadEnv } from "dotenv";
import fs from "node:fs";
import path from "node:path";

loadEnv();

const cwd = process.cwd();

const resolvePath = (value, fallback) => {
  if (!value) return path.resolve(cwd, fallback);
  if (path.isAbsolute(value)) return value;
  return path.resolve(cwd, value);
};

export const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? "";
export const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "GGmainer_bot";
export const TELEGRAM_MINIAPP_SHORT_NAME = process.env.TELEGRAM_MINIAPP_SHORT_NAME ?? "";
export const ALLOW_UNSAFE_TELEGRAM = (process.env.ALLOW_UNSAFE_TELEGRAM ?? "false").toLowerCase() === "true";
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";
export const REFERRAL_DB_PATH = resolvePath(process.env.REFERRAL_DB_PATH, "data/referrals.db");

fs.mkdirSync(path.dirname(REFERRAL_DB_PATH), { recursive: true });

export const isProduction = process.env.NODE_ENV === "production";
