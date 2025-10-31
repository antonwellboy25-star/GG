type ImpactStyle = "light" | "medium" | "heavy" | "rigid" | "soft";

type NotificationType = "error" | "success" | "warning";

type HapticModule = {
  impactOccurred: (style: ImpactStyle) => void;
  notificationOccurred: (type: NotificationType) => void;
  selectionChanged: () => void;
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
    const module = window.Telegram?.WebApp?.HapticFeedback;
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
      vibrate([0, 26, 14, 18]);
      return;
    case "medium":
      vibrate([0, 18]);
      return;
    case "soft":
    case "light":
      vibrate([0, 12]);
      return;
  }
  vibrate([0, 12]);
};

const notificationFallback = (type: NotificationType) => {
  switch (type) {
    case "success":
      vibrate([0, 18, 30, 12]);
      return;
    case "warning":
      vibrate([0, 24, 40, 16]);
      return;
  }
  vibrate([0, 28, 22, 28]);
};

const selectionFallback = () => vibrate(10);

export const haptics = {
  impact(style: ImpactStyle = "light") {
    const module = getTelegramHaptics();
    if (module) {
      invoke(module.impactOccurred, style);
    } else {
      impactFallback(style);
    }
  },
  success() {
    const module = getTelegramHaptics();
    if (module) {
      invoke(module.notificationOccurred, "success");
    } else {
      notificationFallback("success");
    }
  },
  warning() {
    const module = getTelegramHaptics();
    if (module) {
      invoke(module.notificationOccurred, "warning");
    } else {
      notificationFallback("warning");
    }
  },
  error() {
    const module = getTelegramHaptics();
    if (module) {
      invoke(module.notificationOccurred, "error");
    } else {
      notificationFallback("error");
    }
  },
  selection() {
    const module = getTelegramHaptics();
    if (module) {
      invoke(module.selectionChanged);
    } else {
      selectionFallback();
    }
  },
};

export type { ImpactStyle, NotificationType };
