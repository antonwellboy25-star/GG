/**
 * Application Data Models
 *
 * Shop items, tasks, and statistics data definitions.
 */

import type { BoostEffectConfig } from "@/shared/types/boosts";

// Shop Types and Data
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

// ============================================================================
// TASKS DATA
// ============================================================================

export type TaskType = "daily" | "onboarding" | "social";

export type Task = {
  id: string;
  title: string;
  description: string;
  reward: number;
  completed: boolean;
  type: TaskType;
};

export const tasks: Task[] = [
  {
    id: "1",
    title: "Первая сессия майнинга",
    description: "Запустите вашу первую сессию майнинга GG",
    reward: 0.25,
    completed: false,
    type: "onboarding",
  },
  {
    id: "2",
    title: "Подключите TON кошелёк",
    description: "Привяжите TON wallet для вывода средств",
    reward: 0.15,
    completed: false,
    type: "onboarding",
  },
  {
    id: "3",
    title: "Пригласите друга",
    description: "Пригласите хотя бы одного реферала",
    reward: 0.4,
    completed: false,
    type: "social",
  },
  {
    id: "4",
    title: "Ежедневный вход",
    description: "Заходите в приложение каждый день",
    reward: 0.05,
    completed: true,
    type: "daily",
  },
  {
    id: "5",
    title: "Подпишитесь на канал",
    description: "Подпишитесь на наш Telegram канал",
    reward: 0.1,
    completed: false,
    type: "social",
  },
  {
    id: "6",
    title: "Сожгите 10000 GRAM",
    description: "Достигните отметки в 10000 сожжённых GRAM",
    reward: 0.6,
    completed: false,
    type: "onboarding",
  },
];

// ============================================================================
// STATISTICS DATA
// ============================================================================

export type StatisticsSummary = {
  totalGG: number;
  totalSessions: number;
  avgPerSession: number;
  burnRate: number;
};

export type RecentSession = {
  id: number;
  date: string;
  burned: number;
  earned: number;
  status: "completed" | "failed" | "running";
};

export const statisticsSummary: StatisticsSummary = {
  totalGG: 0,
  totalSessions: 0,
  avgPerSession: 0,
  burnRate: 0,
};

export const recentSessions: RecentSession[] = [];
