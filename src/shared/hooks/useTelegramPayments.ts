/**
 * Telegram payments integration hooks.
 */

import { useCallback, useMemo } from "react";
import type { StarsInvoiceHandle, StarsInvoiceStatus } from "@/shared/utils/payments";

const MIN_STARS_VERSION = "8.0";

type StarsInvoiceEventPayload =
  | {
      status?: string;
      slug?: string;
      telegram_payment_charge_id?: string;
      provider_payment_charge_id?: string;
      total_amount?: number;
      currency?: string;
      is_test?: boolean;
    }
  | string
  | null
  | undefined;

export type StarsInvoiceResult = {
  status: StarsInvoiceStatus;
  slug?: string;
  telegramPaymentChargeId?: string;
  providerPaymentChargeId?: string;
  totalAmount?: number | null;
  currency?: string | null;
  isTest?: boolean;
  raw?: unknown;
};

type StarsCapabilities = {
  supportsStars: boolean;
  reason?: string;
  version: string | null;
  starsBalance: number | null;
  isSubscriptionAvailable: boolean | null;
};

const tokenizeVersion = (value: string) =>
  value
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((segment) => Number.parseInt(segment, 10) || 0);

const compareVersions = (current: string | null | undefined, target: string) => {
  if (!current) return -1;
  const a = tokenizeVersion(current);
  const b = tokenizeVersion(target);
  const maxLength = Math.max(a.length, b.length);
  for (let index = 0; index < maxLength; index += 1) {
    const diff = (a[index] ?? 0) - (b[index] ?? 0);
    if (diff > 0) return 1;
    if (diff < 0) return -1;
  }
  return 0;
};

const parseStatus = (value?: string): StarsInvoiceStatus => {
  const normalized = value?.toLowerCase();
  if (normalized === "paid") return "paid";
  if (normalized === "failed") return "failed";
  return "cancelled";
};

const normalizeInvoiceResult = (
  payload: StarsInvoiceEventPayload,
  fallbackStatus?: string,
): StarsInvoiceResult => {
  if (payload && typeof payload === "object" && "status" in payload) {
    const data = payload as Record<string, unknown>;
    return {
      status: parseStatus(typeof data.status === "string" ? data.status : fallbackStatus),
      slug: typeof data.slug === "string" ? data.slug : undefined,
      telegramPaymentChargeId:
        typeof data.telegram_payment_charge_id === "string"
          ? data.telegram_payment_charge_id
          : undefined,
      providerPaymentChargeId:
        typeof data.provider_payment_charge_id === "string"
          ? data.provider_payment_charge_id
          : undefined,
      totalAmount:
        typeof data.total_amount === "number" && Number.isFinite(data.total_amount)
          ? (data.total_amount as number)
          : null,
      currency: typeof data.currency === "string" ? data.currency : null,
      isTest: typeof data.is_test === "boolean" ? data.is_test : undefined,
      raw: payload,
    };
  }

  if (typeof payload === "string") {
    return {
      status: parseStatus(payload),
      raw: payload,
    };
  }

  return {
    status: parseStatus(fallbackStatus),
    raw: payload,
  };
};

const inferSlugFromHandle = (handle: StarsInvoiceHandle) => {
  if (typeof handle === "string") {
    return handle.startsWith("http") ? undefined : handle;
  }
  if ("url" in handle) {
    return undefined;
  }
  return handle.slug;
};

const toTelegramInvoiceArg = (handle: StarsInvoiceHandle) => {
  if (typeof handle === "string") {
    return handle;
  }
  if ("url" in handle) {
    return handle.url;
  }
  return {
    slug: handle.slug,
    access_token: handle.access_token,
    bot_username: handle.bot_username,
    subscription_id: handle.subscription_id,
    payload: handle.payload,
  };
};

const computeCapabilities = (webApp?: TelegramWebApp): StarsCapabilities => {
  if (!webApp) {
    return {
      supportsStars: false,
      reason: "Откройте приложение через Telegram, чтобы платить звёздами.",
      version: null,
      starsBalance: null,
      isSubscriptionAvailable: null,
    };
  }

  const version = webApp.platformVersion ?? webApp.version ?? null;
  const versionSupported = (() => {
    try {
      if (typeof webApp.isVersionAtLeast === "function") {
        return webApp.isVersionAtLeast(MIN_STARS_VERSION);
      }
    } catch {
      // ignore runtime errors from Telegram wrappers
    }
    return compareVersions(version, MIN_STARS_VERSION) >= 0;
  })();

  const hasInvoiceApi = typeof webApp.openInvoice === "function";
  const hasEvents = typeof webApp.onEvent === "function" && typeof webApp.offEvent === "function";

  if (!hasInvoiceApi || !hasEvents) {
    return {
      supportsStars: false,
      reason: "Этот клиент Telegram не поддерживает платежи Stars.",
      version,
      starsBalance: webApp.initDataUnsafe?.user?.stars ?? null,
      isSubscriptionAvailable: webApp.isStarSubscriptionAvailable ?? null,
    };
  }

  if (!versionSupported) {
    return {
      supportsStars: false,
      reason: `Требуется Telegram v${MIN_STARS_VERSION}+`,
      version,
      starsBalance: webApp.initDataUnsafe?.user?.stars ?? null,
      isSubscriptionAvailable: webApp.isStarSubscriptionAvailable ?? null,
    };
  }

  return {
    supportsStars: true,
    version,
    starsBalance: webApp.initDataUnsafe?.user?.stars ?? null,
    isSubscriptionAvailable: webApp.isStarSubscriptionAvailable ?? null,
  };
};

export function useTelegramStarsPurchase() {
  const webApp = typeof window === "undefined" ? undefined : window.Telegram?.WebApp;

  const capabilities = useMemo(() => computeCapabilities(webApp), [webApp]);
  const { supportsStars, reason, version, starsBalance, isSubscriptionAvailable } = capabilities;

  const openInvoice = useCallback(
    async (handle: StarsInvoiceHandle): Promise<StarsInvoiceResult> => {
      if (!webApp) {
        throw new Error("Telegram WebApp недоступен.");
      }
      if (!supportsStars) {
        throw new Error(reason ?? "Telegram Stars недоступны в этом окружении.");
      }

      return new Promise<StarsInvoiceResult>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
          try {
            webApp.offEvent?.("invoice_closed", listener as TelegramEventHandler);
          } catch {
            // ignore cleanup errors
          }
        };

        const complete = (payload: StarsInvoiceEventPayload, fallback?: string) => {
          if (settled) return;
          settled = true;
          cleanup();
          const result = normalizeInvoiceResult(payload, fallback);
          if (!result.slug) {
            result.slug = inferSlugFromHandle(handle);
          }
          resolve(result);
        };

        const listener = (payload: unknown) => {
          complete(payload as StarsInvoiceEventPayload);
        };

        try {
          webApp.onEvent?.("invoice_closed", listener as TelegramEventHandler);
        } catch (error) {
          cleanup();
          reject(
            error instanceof Error
              ? error
              : new Error("Не удалось подписаться на событие платежа."),
          );
          return;
        }

        try {
          const opened = webApp.openInvoice(toTelegramInvoiceArg(handle), (status) => {
            complete(null, status);
          });

          if (opened === false) {
            throw new Error("Telegram отклонил открытие счёта.");
          }
        } catch (error) {
          cleanup();
          if (settled) {
            return;
          }
          settled = true;
          reject(error instanceof Error ? error : new Error("Не удалось открыть счёт в Telegram."));
        }
      });
    },
    [supportsStars, reason, webApp],
  );

  return useMemo(
    () => ({
      supportsStars,
      reason,
      version,
      starsBalance,
      isSubscriptionAvailable,
      openInvoice,
    }),
    [supportsStars, reason, version, starsBalance, isSubscriptionAvailable, openInvoice],
  );
}
