/**
 * Payments Utilities
 *
 * Helper functions for communicating with the backend payments API and
 * creating Telegram Stars invoices used to top up GRAM balance.
 */

export type StarsInvoiceStatus = "paid" | "cancelled" | "failed";

export type StarsInvoiceHandle =
  | string
  | {
      slug: string;
      access_token?: string;
      bot_username?: string;
      subscription_id?: string;
      payload?: string;
    }
  | {
      url: string;
    };

export type StarsTopUpInvoice = {
  invoiceId: string;
  grams: number;
  stars: number;
  currency: string;
  invoice: StarsInvoiceHandle;
  description?: string | null;
  expiresAt?: string | null;
  raw?: unknown;
};

export type StarsPaymentConfirmation = {
  status: StarsInvoiceStatus;
  telegramPaymentChargeId?: string;
  providerPaymentChargeId?: string;
  invoiceSlug?: string;
};

type ApiError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const STARS_TOPUP_ENDPOINT =
  import.meta.env.VITE_STARS_TOPUP_ENDPOINT ?? "/api/payments/stars/topup";
const STARS_CONFIRM_ENDPOINT =
  import.meta.env.VITE_STARS_CONFIRM_ENDPOINT ?? "/api/payments/stars/confirm";
const TELEGRAM_INIT_DATA_HEADER = "X-Telegram-Init-Data";

const readJson = async (response: Response) => {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError) {
      return null;
    }
    throw error;
  }
};

const buildApiError = (response: Response, payload: unknown): ApiError => {
  const message =
    payload &&
    typeof payload === "object" &&
    "message" in payload &&
    typeof (payload as { message?: string }).message === "string"
      ? (payload as { message: string }).message
      : payload &&
          typeof payload === "object" &&
          "error" in payload &&
          payload.error &&
          typeof payload.error === "object" &&
          "message" in (payload.error as { message?: string }) &&
          typeof (payload.error as { message?: string }).message === "string"
        ? ((payload.error as { message?: string }).message as string)
        : `Ошибка ${response.status}`;

  const error = new Error(message) as ApiError;
  error.status = response.status;

  if (payload && typeof payload === "object") {
    const anyPayload = payload as Record<string, unknown>;
    if (typeof anyPayload.code === "string") {
      error.code = anyPayload.code;
    }

    if (anyPayload.error && typeof anyPayload.error === "object") {
      const nested = anyPayload.error as Record<string, unknown>;
      if (!error.code && typeof nested.code === "string") {
        error.code = nested.code;
      }
      error.details = nested;
    } else {
      error.details = payload;
    }
  }

  return error;
};

const resolveApiUrl = (path: string) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const base = API_BASE_URL;
  if (!base) {
    return path;
  }

  try {
    return new URL(path, base).toString();
  } catch {
    const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
    const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
    return `${normalizedBase}/${normalizedPath}`;
  }
};

const getTelegramInitData = () => {
  if (typeof window === "undefined") {
    return "";
  }
  const telegram = window.Telegram;
  return telegram?.WebApp?.initData ?? "";
};

const buildHeaders = () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const initData = getTelegramInitData();
  if (initData) {
    headers[TELEGRAM_INIT_DATA_HEADER] = initData;
  }
  return headers;
};

const ensureNumber = (value: unknown, fallbackMessage: string) => {
  const numeric = typeof value === "string" ? Number(value) : (value as number);
  if (!Number.isFinite(numeric)) {
    throw new Error(fallbackMessage);
  }
  return numeric;
};

type InvoicePayload = Record<string, unknown>;

const resolveInvoiceHandle = (payload: InvoicePayload): StarsInvoiceHandle => {
  if (typeof payload.invoice === "string") {
    return payload.invoice;
  }

  if (payload.invoice && typeof payload.invoice === "object") {
    const invoice = payload.invoice as Record<string, unknown>;
    if (typeof invoice.url === "string") {
      return { url: invoice.url };
    }
    if (typeof invoice.slug === "string") {
      const accessToken =
        typeof invoice.access_token === "string" ? invoice.access_token : undefined;
      const botUsername =
        typeof invoice.bot_username === "string" ? invoice.bot_username : undefined;
      const subscriptionId =
        typeof invoice.subscription_id === "string" ? invoice.subscription_id : undefined;
      const payloadField = typeof invoice.payload === "string" ? invoice.payload : undefined;

      if (!accessToken && !botUsername && !subscriptionId && !payloadField) {
        return invoice.slug;
      }

      return {
        slug: invoice.slug,
        access_token: accessToken,
        bot_username: botUsername,
        subscription_id: subscriptionId,
        payload: payloadField,
      };
    }
  }

  const url =
    typeof payload.invoiceUrl === "string"
      ? payload.invoiceUrl
      : typeof payload.invoice_url === "string"
        ? payload.invoice_url
        : typeof payload.url === "string"
          ? payload.url
          : undefined;
  if (url) {
    return { url };
  }

  const slug =
    typeof payload.invoiceSlug === "string"
      ? payload.invoiceSlug
      : typeof payload.invoice_slug === "string"
        ? payload.invoice_slug
        : typeof payload.slug === "string"
          ? payload.slug
          : undefined;
  if (slug) {
    const accessToken = typeof payload.accessToken === "string" ? payload.accessToken : undefined;
    const botUsername = typeof payload.botUsername === "string" ? payload.botUsername : undefined;
    const subscriptionId =
      typeof payload.subscriptionId === "string" ? payload.subscriptionId : undefined;
    const payloadField = typeof payload.payload === "string" ? payload.payload : undefined;

    if (!accessToken && !botUsername && !subscriptionId && !payloadField) {
      return slug;
    }

    return {
      slug,
      access_token: accessToken,
      bot_username: botUsername,
      subscription_id: subscriptionId,
      payload: payloadField,
    };
  }

  throw new Error("Сервер не вернул ссылку на счёт Telegram Stars.");
};

const extractInvoiceId = (payload: InvoicePayload, fallbackSlug?: string): string => {
  const candidate =
    payload.invoiceId ??
    payload.invoice_id ??
    payload.id ??
    payload.paymentId ??
    payload.payment_id ??
    fallbackSlug;

  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate;
  }

  throw new Error("Сервер не вернул идентификатор счёта Telegram Stars.");
};

export async function createStarsTopUpInvoice(
  grams: number,
  options?: { signal?: AbortSignal },
): Promise<StarsTopUpInvoice> {
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error("Количество GRAM должно быть положительным числом.");
  }

  const response = await fetch(resolveApiUrl(STARS_TOPUP_ENDPOINT), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ grams }),
    signal: options?.signal,
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw buildApiError(response, payload);
  }

  const data =
    payload && typeof payload === "object" && "result" in payload
      ? ((payload as { result: unknown }).result as InvoicePayload)
      : payload && typeof payload === "object" && "data" in payload
        ? ((payload as { data: unknown }).data as InvoicePayload)
        : (payload as InvoicePayload | null);

  if (!data || typeof data !== "object") {
    throw new Error("Сервер вернул некорректный ответ при создании счёта.");
  }

  const invoice = resolveInvoiceHandle(data);
  const normalizedSlug =
    typeof invoice === "string" ? invoice : "slug" in invoice ? invoice.slug : undefined;
  const invoiceId = extractInvoiceId(data, normalizedSlug);
  const gramsValue = ensureNumber(
    "grams" in data ? data.grams : "amount" in data ? data.amount : grams,
    "Сервер вернул некорректное количество GRAM.",
  );
  const starsValueRaw =
    "stars" in data
      ? data.stars
      : "price" in data
        ? data.price
        : "total" in data
          ? data.total
          : "totalAmount" in data
            ? data.totalAmount
            : 0;
  const starsValue = ensureNumber(starsValueRaw, "Сервер вернул некорректную стоимость в звёздах.");
  const currency =
    typeof data.currency === "string"
      ? data.currency
      : typeof data.currencyCode === "string"
        ? data.currencyCode
        : "XTR";

  const description =
    typeof data.description === "string"
      ? data.description
      : typeof data.title === "string"
        ? data.title
        : typeof data.productTitle === "string"
          ? data.productTitle
          : null;

  const expiresAt =
    typeof data.expiresAt === "string"
      ? data.expiresAt
      : typeof data.expires_at === "string"
        ? data.expires_at
        : null;

  return {
    invoiceId,
    grams: Math.floor(gramsValue),
    stars: Math.round(starsValue),
    currency,
    invoice,
    description,
    expiresAt,
    raw: data,
  };
}

export async function confirmStarsTopUpInvoice(
  invoiceId: string,
  confirmation: StarsPaymentConfirmation,
  options?: { signal?: AbortSignal },
) {
  if (!invoiceId || invoiceId.trim().length === 0) {
    throw new Error("Не указан идентификатор счёта для подтверждения платежа.");
  }

  const response = await fetch(resolveApiUrl(STARS_CONFIRM_ENDPOINT), {
    method: "POST",
    headers: buildHeaders(),
    body: JSON.stringify({ invoiceId, ...confirmation }),
    signal: options?.signal,
  });

  const payload = await readJson(response);

  if (!response.ok) {
    throw buildApiError(response, payload);
  }

  return payload;
}
