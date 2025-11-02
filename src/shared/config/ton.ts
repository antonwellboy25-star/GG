/**
 * TON Blockchain Configuration
 *
 * Smart contract addresses and configuration for TON blockchain integration.
 *
 * IMPORTANT: Replace placeholder addresses with actual deployed contract addresses.
 *
 * Addresses:
 * - GRAM_BURN_ADDRESS: Contract for burning GRAM tokens
 * - GRAM_TOPUP_ADDRESS: Contract for purchasing/topping up GRAM
 *
 * @module shared/config/ton
 */

/**
 * TODO: Replace with actual GRAM burn contract address
 */
export const GRAM_BURN_ADDRESS = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
/**
 * TODO: Replace with actual GRAM top-up contract address
 */
export const GRAM_TOPUP_ADDRESS = "EQBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBKCE";

/**
 * Number of decimal places for GRAM token (9 decimals = nanoGRAM)
 */
export const GRAM_DECIMALS = 9;
