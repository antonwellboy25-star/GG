export function openTelegramShare({ url, text }: { url: string; text?: string }) {
  const shareUrl = new URL("https://t.me/share/url");
  shareUrl.searchParams.set("url", url);
  if (text) {
    shareUrl.searchParams.set("text", text);
  }
  window.open(shareUrl.toString(), "_blank");
}
