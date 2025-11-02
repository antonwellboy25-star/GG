/**
 * Mining Difficulty Configuration
 *
 * Configures the mining difficulty progression model for the application.
 * Controls how GOLD per GRAM ratio decreases over time.
 *
 * Available Models:
 * - exp: Exponential decay with configurable half-life
 * - daily-linear: Linear decrease by 1 GOLD/GRAM per day
 * - monthly-halving: Halves each month until reaching target
 *
 * Current configuration uses exponential decay:
 * - Start: 1000 GOLD per 1000 GRAM
 * - Target: 1 GOLD per 1000 GRAM
 * - Half-life: 30 days
 *
 * @module shared/config/mining
 */

export type DifficultyModel =
  | { model: "exp"; startRate: number; targetRate: number; halfLifeDays: number }
  | { model: "daily-linear"; startRate: number; targetRate: number }
  | { model: "monthly-halving"; startRate: number; targetRate: number };

export type MiningDifficultyConfig = {
  startDateUTC: string;
  schedule: DifficultyModel;
};

export const miningDifficultyConfig: MiningDifficultyConfig = {
  startDateUTC: "2024-11-01T00:00:00Z",
  schedule: {
    model: "exp",
    startRate: 1000,
    targetRate: 1,
    halfLifeDays: 30,
  },
};
