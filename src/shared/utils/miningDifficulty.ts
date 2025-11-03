/**
 * Mining Difficulty Utilities
 *
 * Calculates and tracks the mining difficulty progression over time.
 * Supports multiple difficulty models:
 * - Daily Linear: Decreases by 1 GOLD per GRAM each day
 * - Monthly Halving: Halves each month until target rate
 * - Exponential Decay: Exponential decrease with configurable half-life
 *
 * Features:
 * - Time-based difficulty adjustment
 * - Countdown to next difficulty change
 * - Configurable start date and rates
 *
 * @module shared/utils/miningDifficulty
 */

import { miningDifficultyConfig, type DifficultyModel } from "@/shared/config";

const MS_IN_DAY = 86_400_000;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const toDayIndex = (now: Date, start: Date) => {
  const diff = now.getTime() - start.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / MS_IN_DAY);
};

const startOfNextDayUTC = (now: Date) => {
  const next = new Date(now.getTime());
  next.setUTCHours(0, 0, 0, 0);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
};

const monthsSinceStart = (now: Date, start: Date) => {
  const years = now.getUTCFullYear() - start.getUTCFullYear();
  const months = now.getUTCMonth() - start.getUTCMonth();
  const total = years * 12 + months;
  if (total <= 0) return 0;
  if (now.getUTCDate() < start.getUTCDate()) {
    return total - 1;
  }
  return total;
};

const computeRate = (schedule: DifficultyModel, dayIndex: number, monthIndex: number) => {
  const { startRate, targetRate } = schedule;
  if (schedule.model === "daily-linear") {
    const current = startRate - dayIndex;
    return Math.max(targetRate, current);
  }
  if (schedule.model === "monthly-halving") {
    const factor = 0.5 ** monthIndex;
    const value = targetRate + (startRate - targetRate) * factor;
    return clamp(value, targetRate, startRate);
  }
  const lambda = Math.log(2) / Math.max(1, schedule.halfLifeDays);
  const value = startRate * Math.exp(-lambda * dayIndex);
  const rounded = Math.max(targetRate, value);
  return rounded;
};

export type DifficultySnapshot = {
  currentRate: number;
  dayIndex: number;
  monthIndex: number;
  nextUpdate: Date;
};

export const getDifficultySnapshot = (now = new Date()): DifficultySnapshot => {
  const { startDateUTC, schedule } = miningDifficultyConfig;
  const start = new Date(startDateUTC);
  const dayIndex = toDayIndex(now, start);
  const monthIndex = monthsSinceStart(now, start);
  const currentRate = computeRate(schedule, dayIndex, monthIndex);

  let nextUpdate: Date;
  if (schedule.model === "monthly-halving") {
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    nextUpdate = nextMonth;
  } else {
    nextUpdate = startOfNextDayUTC(now);
  }

  return {
    currentRate,
    dayIndex,
    monthIndex,
    nextUpdate,
  };
};

export const formatDifficultyCountdown = (target: Date, now = new Date()): string => {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) {
    return "менее минуты";
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    const remHours = hours;
    return `${days}д ${remHours}ч`;
  }

  if (hours > 0) {
    return `${hours}ч ${minutes}м`;
  }

  if (minutes > 0) {
    return `${minutes}м ${seconds}с`;
  }

  return `${seconds}с`;
};
