interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  allows_write_to_pm?: boolean;
  stars?: number;
  photo_url?: string;
}

interface TelegramWebAppInitDataUnsafe {
  query_id?: string;
  user?: TelegramWebAppUser;
  receiver?: TelegramWebAppUser;
  start_param?: string;
  auth_date?: number;
  hash?: string;
  chat?: unknown;
  chat_type?: "sender" | "private" | "group" | "supergroup" | "channel";
  chat_instance?: string;
}

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

type TelegramInvoiceStatus = "paid" | "cancelled" | "failed";

type TelegramInvoiceClosedPayload = {
  status: TelegramInvoiceStatus;
  slug?: string;
  telegram_payment_charge_id?: string;
  provider_payment_charge_id?: string;
  total_amount?: number;
  currency?: string;
  is_test?: boolean;
};

interface TelegramHapticFeedback {
  impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
  notificationOccurred(type: "error" | "success" | "warning"): void;
  selectionChanged(): void;
}

interface TelegramBackButton {
  show(): void;
  hide(): void;
  onClick(handler: () => void): void;
  offClick(handler: () => void): void;
}

interface TelegramWebApp {
  readonly initData: string;
  readonly initDataUnsafe: TelegramWebAppInitDataUnsafe;
  readonly colorScheme: "light" | "dark";
  readonly platform: string;
  readonly viewportStableHeight: number;
  readonly viewportHeight: number;
  readonly viewportWidth: number;
  readonly themeParams: TelegramThemeParams;
  readonly isExpanded: boolean;
  readonly version: string;
  readonly platformVersion?: string;
  readonly isFullscreen?: boolean;
  readonly isStarSubscriptionAvailable?: boolean;
  readonly safeAreaInsets?: TelegramSafeAreaInsets;
  readonly safeAreaInset?: TelegramSafeAreaInsets;
  readonly contentSafeAreaInsets?: TelegramContentSafeAreaInsets;
  readonly contentSafeAreaInset?: TelegramContentSafeAreaInsets;
  readonly viewportStable?: TelegramViewportStableFlag;
  readonly viewport?: TelegramViewport;
  readonly HapticFeedback?: TelegramHapticFeedback;

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

  showAlert(message: string, callback?: () => void): void;
  showConfirm(message: string, callback: (confirmed: boolean) => void): void;
  openLink(url: string, options?: { try_instant_view?: boolean }): void;
  openInvoice(
    invoice:
      | string
      | {
          slug: string;
          access_token?: string;
          bot_username?: string;
          subscription_id?: string;
          payload?: string;
        },
    callback?: (status: TelegramInvoiceStatus) => void,
  ): boolean;

  BackButton: TelegramBackButton;

  onEvent(event: "invoice_closed", handler: (payload: TelegramInvoiceClosedPayload) => void): void;
  onEvent(event: string, handler: TelegramEventHandler): void;
  offEvent(event: "invoice_closed", handler: (payload: TelegramInvoiceClosedPayload) => void): void;
  offEvent(event: string, handler: TelegramEventHandler): void;
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
