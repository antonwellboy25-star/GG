/**
 * General utility functions for clipboard and sharing
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

export function openTelegramShare({ url, text }: { url: string; text?: string }) {
  const shareUrl = new URL("https://t.me/share/url");
  shareUrl.searchParams.set("url", url);
  if (text) {
    shareUrl.searchParams.set("text", text);
  }
  window.open(shareUrl.toString(), "_blank");
}
