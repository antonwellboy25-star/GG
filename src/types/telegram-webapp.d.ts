interface TelegramThemeParams {
  [key: string]: string | undefined;
}

type TelegramViewportStableFlag = {
  isExpanded: boolean;
  height: number;
};

type TelegramSafeAreaInsets = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

type TelegramContentSafeAreaInsets = TelegramSafeAreaInsets;

type TelegramEventHandler = (...args: unknown[]) => void;

interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(handler: () => void): void;
  offClick(handler: () => void): void;
}

interface TelegramWebApp {
  readonly initData: string;
  readonly colorScheme: "light" | "dark";
  readonly platform: string;
  readonly viewportStableHeight: number;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
  readonly themeParams: TelegramThemeParams;
  readonly isExpanded: boolean;
  readonly version: string;
  readonly isFullscreen?: boolean;
  readonly safeAreaInsets?: TelegramSafeAreaInsets;
  readonly safeAreaInset?: TelegramSafeAreaInsets;
  readonly contentSafeAreaInsets?: TelegramContentSafeAreaInsets;
  readonly contentSafeAreaInset?: TelegramContentSafeAreaInsets;
  readonly viewportStable?: TelegramViewportStableFlag;

  ready(): void;
  expand(): void;
  close(): void;
  requestFullscreen?(): void;
  exitFullscreen?(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  isVersionAtLeast?(version: string): boolean;
  enableClosingConfirmation?(): void;
  disableClosingConfirmation?(): void;
  enableVerticalSwipes?(): void;
  disableVerticalSwipes?(): void;
  hideKeyboard?(): void;

  onEvent(event: string, handler: TelegramEventHandler): void;
  offEvent(event: string, handler: TelegramEventHandler): void;

  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback: (confirmed: boolean) => void): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;

  BackButton: TelegramBackButton;
}

declare namespace Telegram {
  const WebApp: TelegramWebApp;
}

declare interface Window {
  Telegram?: typeof Telegram;
}
