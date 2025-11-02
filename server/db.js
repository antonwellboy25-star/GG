import Database from "better-sqlite3";
import { REFERRAL_DB_PATH } from "./config.js";

const db = new Database(REFERRAL_DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS referral_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS referral_relations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    referrer_id TEXT NOT NULL,
    referred_user_id TEXT NOT NULL UNIQUE,
    campaign TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_earned INTEGER NOT NULL DEFAULT 0,
    last_bonus_at TEXT,
    last_activity_at TEXT,
    referred_username TEXT,
    referred_first_name TEXT,
    referred_last_name TEXT,
    FOREIGN KEY (referrer_id) REFERENCES referral_codes(user_id)
  );
`);

const ensureColumn = (table, column, definition) => {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  if (info.some((col) => col.name === column)) {
    return;
  }
  db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
};

ensureColumn("referral_relations", "campaign", "TEXT");
ensureColumn("referral_relations", "total_earned", "INTEGER NOT NULL DEFAULT 0");
ensureColumn("referral_relations", "last_bonus_at", "TEXT");
ensureColumn("referral_relations", "last_activity_at", "TEXT");
ensureColumn("referral_relations", "referred_username", "TEXT");
ensureColumn("referral_relations", "referred_first_name", "TEXT");
ensureColumn("referral_relations", "referred_last_name", "TEXT");

export default db;
