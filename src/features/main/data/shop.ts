/**
 * Shop Items Data Model
 *
 * Defines the in-app shop items and their boost configurations.
 * Items can provide various boost effects:
 * - Session multipliers: Increase rewards for a fixed number of sessions
 * - Timed multipliers: Increase rewards for a time duration
 * - Auto-collect: Passive reward collection
 * - Instant gold: Immediate random GOLD bonus
 *
 * @module features/main/data/shop
 */

import type { BoostEffectConfig } from "@/shared/types/boosts";

export type ShopItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  effectLabel: string;
  available: boolean;
  badge?: string;
  boost?: BoostEffectConfig;
};

export const shopItems: ShopItem[] = [
  {
    id: "1",
    name: "Pulse Booster",
    description: "Ускоряет добычу на несколько ближайших сессий",
    price: 6_000,
    icon: "⚡",
    effectLabel: "+25% награда (3 сессии)",
    available: true,
    badge: "Популярное",
    boost: {
      kind: "session-multiplier",
      factor: 1.25,
      sessions: 3,
      stackPolicy: "stack",
    },
  },
  {
    id: "2",
    name: "Stability Core",
    description: "Повышает эффективность сжигания в течение суток",
    price: 12_000,
    icon: "💎",
    effectLabel: "+40% эффективность (24 часа)",
    available: true,
    badge: "Лучшее",
    boost: {
      kind: "timed-multiplier",
      factor: 1.4,
      durationMs: 24 * 60 * 60 * 1000,
      stackPolicy: "extend",
    },
  },
  {
    id: "3",
    name: "Auto-Collect Mini",
    description: "Автосбор наград без входа в игру",
    price: 8_500,
    icon: "🤖",
    effectLabel: "Авто-сбор (7 дней)",
    available: true,
    boost: {
      kind: "auto-collect",
      durationMs: 7 * 24 * 60 * 60 * 1000,
      stackPolicy: "extend",
    },
  },
  {
    id: "4",
    name: "Premium Pass",
    description: "Расширенные возможности и косметика на месяц",
    price: 25_000,
    icon: "👑",
    effectLabel: "VIP статус",
    available: false,
    badge: "Скоро",
  },
  {
    id: "5",
    name: "Referral Pulse",
    description: "Увеличивает доход от сети рефералов",
    price: 5_500,
    icon: "🎯",
    effectLabel: "+5% реф. бонус (14 дней)",
    available: true,
    boost: {
      kind: "timed-multiplier",
      factor: 1.05,
      durationMs: 14 * 24 * 60 * 60 * 1000,
      stackPolicy: "extend",
    },
  },
  {
    id: "6",
    name: "Lucky Spark",
    description: "Шанс получить существенный прирост GOLD",
    price: 2_800,
    icon: "🎁",
    effectLabel: "0.1-1.0 GOLD",
    available: true,
    boost: {
      kind: "instant-gold",
      goldRange: { min: 0.1, max: 1.0 },
      precision: 3,
    },
  },
];
