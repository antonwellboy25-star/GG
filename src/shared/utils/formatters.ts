/**
 * General utility functions and formatters for the GG Mining application.
 * This module provides number formatting, time formatting, clipboard operations,
 * and Telegram sharing functionality.
 */

// ============================================================================
// NUMBER FORMATTERS
// ============================================================================

/**
 * Formatter for integer numbers (GRAM, session counts, etc.)
 * @example
 * numberFormatter.format(1000) // "1 000" (Russian locale)
 */
export const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

/**
 * Formatter for high-precision decimal numbers (GOLD)
 * @example
 * goldFormatter.format(123.456789) // "123,4568" (Russian locale)
 */
export const goldFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

/**
 * Formatter for medium-precision decimal numbers (GG tokens)
 * @example
 * ggFormatter.format(123.456) // "123,46" (Russian locale)
 */
export const ggFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Formats time duration in MM:SS format
 * @param seconds - Duration in seconds
 * @returns Formatted time string
 * @example
 * formatTime(125) // "02:05"
 * formatTime(0) // "00:00"
 * formatTime(-5) // "00:00"
 */
export function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mm = String(Math.floor(clamped / 60)).padStart(2, "0");
  const ss = String(clamped % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

// ============================================================================
// CLIPBOARD AND SHARING UTILITIES
// ============================================================================

/**
 * Copies text to the system clipboard using the Clipboard API
 * @param text - Text to copy
 * @returns Promise resolving to true if successful, false otherwise
 * @example
 * const success = await copyToClipboard("Hello World");
 * if (success) console.log("Copied!");
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error("Failed to copy to clipboard", error);
    return false;
  }
}

/**
 * Opens Telegram's share dialog to share a URL
 * @param options - Share options
 * @param options.url - URL to share
 * @param options.text - Optional text to include with the share
 * @example
 * openTelegramShare({
 *   url: "https://t.me/mybot",
 *   text: "Check out this cool bot!"
 * });
 */
export function openTelegramShare({ url, text }: { url: string; text?: string }): void {
  const shareUrl = new URL("https://t.me/share/url");
  shareUrl.searchParams.set("url", url);
  if (text) {
    shareUrl.searchParams.set("text", text);
  }
  window.open(shareUrl.toString(), "_blank");
}
