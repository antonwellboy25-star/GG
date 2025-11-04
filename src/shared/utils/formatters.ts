// Number formatters for the application
export const numberFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

export const goldFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

export const ggFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatTime(seconds: number): string {
  const clamped = Math.max(0, Math.ceil(seconds));
  const mm = String(Math.floor(clamped / 60)).padStart(2, "0");
  const ss = String(clamped % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

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
