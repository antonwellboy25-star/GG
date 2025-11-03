/**
 * Application Configuration
 * 
 * Centralized configuration for TON blockchain and mining difficulty.
 */

// TON Blockchain Configuration
export const GRAM_BURN_ADDRESS = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
export const GRAM_TOPUP_ADDRESS = "EQBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBKCE";
export const GRAM_DECIMALS = 9;

// Mining Difficulty Configuration
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
