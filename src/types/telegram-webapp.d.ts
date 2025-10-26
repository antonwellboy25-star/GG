interface TelegramThemeParams {
  [key: string]: string | undefined;
}

type TelegramViewportStableFlag = {
  isExpanded: boolean;
  height: number;
};

declare namespace Telegram {
  namespace WebApp {
    function ready(): void;
    function expand(): void;
    function close(): void;
    const initData: string;
    const colorScheme: "light" | "dark";
    const platform: string;
    const viewportStableHeight: number;
    const viewportHeight: number;
    const viewportWidth: number;
    const themeParams: TelegramThemeParams;
    const isExpanded: boolean;
    const version: string;
    function onEvent(event: string, handler: (...args: unknown[]) => void): void;
    function offEvent(event: string, handler: (...args: unknown[]) => void): void;
    function showAlert(message: string, callback?: () => void): void;
    function showConfirm(message: string, callback: (confirmed: boolean) => void): void;
    function openLink(url: string, options?: { try_instant_view?: boolean }): void;
    const BackButton: {
      show(): void;
      hide(): void;
      onClick(handler: () => void): void;
      offClick(handler: () => void): void;
    };
  }
}

declare interface Window {
  Telegram?: typeof Telegram;
}
