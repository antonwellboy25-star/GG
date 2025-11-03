import { isTelegramVersionAtLeast } from "@/shared/utils/telegram";
/**
 * Haptic Feedback Utilities
 *
 * Provides cross-platform haptic feedback with automatic fallback:
 * - Primary: Uses Telegram WebApp HapticFeedback API when available
 * - Fallback: Uses Navigator Vibration API for non-Telegram environments
 *
 * Features:
 * - Automatic cooldown to prevent excessive haptic triggers
 * - Multiple impact styles (light, medium, heavy, rigid, soft)
 * - Notification types (success, warning, error)
 * - Selection feedback
 *
 * @module shared/utils/haptics
 */

type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";

type NotificationType = "error" | "success" | "warning";

type HapticModule = {
  impactOccurred: (style: ImpactStyle) => void;
  notificationOccurred: (type: NotificationType) => void;
  selectionChanged: () => void;
};

const now = () => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
};

const HAPTIC_COOLDOWN_MS = 70;
const lastTrigger: Record<string, number> = {};

const shouldTrigger = (key: string) => {
  const current = now();
  const previous = lastTrigger[key] ?? 0;
  if (current - previous < HAPTIC_COOLDOWN_MS) {
    return false;
  }
  lastTrigger[key] = current;
  return true;
};

const supportsNavigatorVibrate = () =>
  typeof window !== "undefined" &&
  "vibrate" in window.navigator &&
  typeof window.navigator.vibrate === "function";

const vibrate = (pattern: number | number[]) => {
  if (!supportsNavigatorVibrate()) return;
  try {
    window.navigator.vibrate(pattern);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Navigator vibrate failed", error);
    }
  }
};

const getTelegramHaptics = (): HapticModule | null => {
  if (typeof window === "undefined") return null;
  try {
    const webApp = window.Telegram?.WebApp;
    if (!isTelegramVersionAtLeast(webApp, "7.0")) {
      return null;
    }
    const module = webApp?.HapticFeedback;
    return module ?? null;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Telegram haptic access failed", error);
    }
    return null;
  }
};

const invoke = <TArgs extends unknown[]>(
  handler: ((...args: TArgs) => void) | undefined,
  ...args: TArgs
) => {
  if (!handler) return;
  try {
    handler(...args);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("Haptic invocation failed", error);
    }
  }
};

const impactFallback = (style: ImpactStyle) => {
  switch (style) {
    case "heavy":
    case "rigid":
      vibrate([0, 12, 18]);
      return;
    case "medium":
      vibrate([0, 10]);
      return;
    case "soft":
    case "light":
      vibrate([0, 6]);
      return;
  }
  vibrate([0, 6]);
};

const notificationFallback = (type: NotificationType) => {
  switch (type) {
    case "success":
      vibrate([0, 12, 32, 10]);
      return;
    case "warning":
      vibrate([0, 16, 36, 12]);
      return;
  }
  vibrate([0, 18, 24, 18]);
};

const selectionFallback = () => vibrate(6);

export const haptics = {
  impact(style: ImpactStyle = "light") {
    if (!shouldTrigger(`impact:${style}`)) {
      return;
    }
    const module = getTelegramHaptics();
    if (module) {
      invoke(module.impactOccurred, style);
    } else {
      impactFallback(style);
    }
  },
  success() {
    if (!shouldTrigger("notify:success")) {
      return;
    }
    const module = getTelegramHaptics();
    if (module) {
      invoke(module.notificationOccurred, "success");
    } else {
      notificationFallback("success");
    }
  },
  warning() {
    if (!shouldTrigger("notify:warning")) {
      return;
    }
    const module = getTelegramHaptics();
    if (module) {
      invoke(module.notificationOccurred, "warning");
    } else {
      notificationFallback("warning");
    }
  },
  error() {
    if (!shouldTrigger("notify:error")) {
      return;
    }
    const module = getTelegramHaptics();
    if (module) {
      invoke(module.notificationOccurred, "error");
    } else {
      notificationFallback("error");
    }
  },
  selection() {
    if (!shouldTrigger("selection")) {
      return;
    }
    const module = getTelegramHaptics();
    if (module) {
      invoke(module.selectionChanged);
    } else {
      selectionFallback();
    }
  },
};

export type { ImpactStyle, NotificationType };
