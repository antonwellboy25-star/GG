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
  readonly viewport?: TelegramViewport;

  ready(): void;
  expand(): void;
  close(): void;
  requestFullscreen?(): void;
  exitFullscreen?(): void;
  requestSafeArea?(): void;
  requestContentSafeArea?(): void;
  requestViewport?(): void;
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

interface TelegramViewport {
  height?: number;
  width?: number;
  stableHeight?: number;
  isExpanded?: boolean;
  isFullscreen?: boolean;
  safeAreaInsets?: TelegramSafeAreaInsets;
  safeAreaInset?: TelegramSafeAreaInsets;
  contentSafeAreaInsets?: TelegramContentSafeAreaInsets;
  contentSafeAreaInset?: TelegramContentSafeAreaInsets;
  onViewportChanged?(handler: (event: unknown) => void): void;
  offViewportChanged?(handler: (event: unknown) => void): void;
  onFullscreenChanged?(handler: (event: unknown) => void): void;
  offFullscreenChanged?(handler: (event: unknown) => void): void;
  onSafeAreaInsetsChanged?(handler: (insets: TelegramSafeAreaInsets) => void): void;
  offSafeAreaInsetsChanged?(handler: (insets: TelegramSafeAreaInsets) => void): void;
  onContentSafeAreaInsetsChanged?(handler: (insets: TelegramContentSafeAreaInsets) => void): void;
  offContentSafeAreaInsetsChanged?(handler: (insets: TelegramContentSafeAreaInsets) => void): void;
}

declare namespace Telegram {
  const WebApp: TelegramWebApp;
}

declare interface Window {
  Telegram?: typeof Telegram;
}
