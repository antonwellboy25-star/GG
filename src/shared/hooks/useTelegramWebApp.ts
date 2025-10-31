import { useEffect } from "react";

type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

/**
 * Hook to initialize and configure Telegram WebApp
 */
export function useTelegramWebApp() {
  // Initialize Telegram WebApp and configure full screen mode
  useEffect(() => {
    if (typeof window === "undefined") return;
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;

    try {
      webApp.ready();
      
      if (typeof webApp.expand === "function") {
        webApp.expand();
      }

      if (typeof webApp.requestFullscreen === "function") {
        webApp.requestFullscreen();
      }

      if (typeof webApp.disableVerticalSwipes === "function") {
        webApp.disableVerticalSwipes();
      }

      if (typeof webApp.enableClosingConfirmation === "function") {
        webApp.enableClosingConfirmation();
      }

      if (typeof webApp.setHeaderColor === "function") {
        webApp.setHeaderColor("#000000");
      }
      if (typeof webApp.setBackgroundColor === "function") {
        webApp.setBackgroundColor("#000000");
      }
      if (typeof webApp.setBottomBarColor === "function") {
        webApp.setBottomBarColor("#000000");
      }

      if (typeof webApp.hideKeyboard === "function") {
        webApp.hideKeyboard();
      }
    } catch (_error) {
      // Ignore errors if APIs are unavailable
    }
  }, []);

  // Setup viewport and safe area handling
  useEffect(() => {
    if (typeof window === "undefined") return;
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;

    const root = document.documentElement;
    const platform = String(webApp.platform ?? "").toLowerCase();

    root.dataset.telegram = "true";
    if (platform) {
      root.dataset.tgPlatform = platform;
    }

    const viewportApi = (webApp as unknown as { viewport?: unknown }).viewport as
      | {
          height?: number;
          width?: number;
          stableHeight?: number;
          isExpanded?: boolean;
          isFullscreen?: boolean;
          safeAreaInsets?: Insets;
          safeAreaInset?: Insets;
          contentSafeAreaInsets?: Insets;
          contentSafeAreaInset?: Insets;
          onViewportChanged?: (listener: (event: unknown) => void) => void;
          offViewportChanged?: (listener: (event: unknown) => void) => void;
          onFullscreenChanged?: (listener: (event: unknown) => void) => void;
          offFullscreenChanged?: (listener: (event: unknown) => void) => void;
          onSafeAreaInsetsChanged?: (listener: (insets: Insets) => void) => void;
          offSafeAreaInsetsChanged?: (listener: (insets: Insets) => void) => void;
          onContentSafeAreaInsetsChanged?: (listener: (insets: Insets) => void) => void;
          offContentSafeAreaInsetsChanged?: (listener: (insets: Insets) => void) => void;
        }
      | undefined;

    const toPx = (value?: number) => `${Math.max(0, value ?? 0)}px`;

    const sanitizeInsets = (raw: Partial<Insets> | null | undefined): Insets | null => {
      if (!raw) return null;
      const top =
        typeof raw.top === "number" && Number.isFinite(raw.top) ? Math.max(0, raw.top) : 0;
      const right =
        typeof raw.right === "number" && Number.isFinite(raw.right) ? Math.max(0, raw.right) : 0;
      const bottom =
        typeof raw.bottom === "number" && Number.isFinite(raw.bottom)
          ? Math.max(0, raw.bottom)
          : 0;
      const left =
        typeof raw.left === "number" && Number.isFinite(raw.left) ? Math.max(0, raw.left) : 0;
      return { top, right, bottom, left };
    };

    const hasInset = (inset?: Insets | null) => {
      if (!inset) return false;
      return inset.top > 0 || inset.bottom > 0 || inset.left > 0 || inset.right > 0;
    };

    const computeViewportInsets = (): Insets | null => {
      if (typeof window.visualViewport === "undefined") return null;
      const vv = window.visualViewport;
      if (!vv) return null;

      const top = Math.max(0, vv.offsetTop);
      const left = Math.max(0, vv.offsetLeft);
      const right = Math.max(0, window.innerWidth - vv.width - vv.offsetLeft);
      const bottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);

      const result: Insets = { top, right, bottom, left };
      return hasInset(result) ? result : null;
    };

    const preferNumber = (...values: Array<number | null | undefined>) => {
      for (const value of values) {
        if (typeof value === "number" && Number.isFinite(value)) {
          return value;
        }
      }
      return null;
    };

    const setPxVar = (name: string, value: number | null) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        root.style.setProperty(name, toPx(value));
      } else {
        root.style.removeProperty(name);
      }
    };

    const setInsets = (prefix: string, primary?: Insets | null, fallback?: Insets | null) => {
      const sides: Array<keyof Insets> = ["top", "right", "bottom", "left"];
      sides.forEach((side) => {
        const value = primary?.[side] ?? fallback?.[side];
        const cssVar = `${prefix}-${side}`;
        if (typeof value === "number" && Number.isFinite(value)) {
          root.style.setProperty(cssVar, toPx(value));
        } else {
          root.style.removeProperty(cssVar);
        }
      });
    };

    const applyMetrics = () => {
      const viewportFallback = computeViewportInsets();

      const safeCandidates: Array<Partial<Insets> | null | undefined> = [
        viewportApi?.safeAreaInsets,
        (viewportApi as { safeAreaInset?: Insets } | undefined)?.safeAreaInset,
        webApp.safeAreaInsets,
        webApp.safeAreaInset,
      ];
      let safe: Insets | null = null;
      for (const candidate of safeCandidates) {
        if (candidate) {
          safe = sanitizeInsets(candidate);
          if (safe) break;
        }
      }
      if (!safe && viewportFallback && hasInset(viewportFallback)) {
        safe = viewportFallback;
      }

      const contentCandidates: Array<Partial<Insets> | null | undefined> = [
        viewportApi?.contentSafeAreaInsets,
        (viewportApi as { contentSafeAreaInset?: Insets } | undefined)?.contentSafeAreaInset,
        webApp.contentSafeAreaInsets,
        webApp.contentSafeAreaInset,
      ];
      let content: Insets | null = null;
      for (const candidate of contentCandidates) {
        if (candidate) {
          content = sanitizeInsets(candidate);
          if (content) break;
        }
      }
      if (!content) {
        content =
          safe ?? (viewportFallback && hasInset(viewportFallback) ? viewportFallback : null);
      }

      setInsets("--app-safe-area", safe);
      setInsets("--app-content-safe-area", content, safe);
      setInsets("--tg-viewport-safe-area-inset", safe);
      setInsets("--tg-viewport-content-safe-area-inset", content, safe);

      const viewportHeight = preferNumber(
        viewportApi?.height,
        webApp.viewportHeight,
        window.visualViewport?.height,
        window.innerHeight,
      );
      const viewportStableHeight = preferNumber(
        viewportApi?.stableHeight,
        webApp.viewportStable?.height,
        webApp.viewportStableHeight,
        viewportApi?.height,
        viewportHeight,
      );
      const viewportWidth = preferNumber(
        viewportApi?.width,
        webApp.viewportWidth,
        window.visualViewport?.width,
        window.innerWidth,
      );

      setPxVar("--tg-viewport-height", viewportHeight);
      setPxVar("--tg-viewport-stable-height", viewportStableHeight ?? viewportHeight);
      setPxVar("--tg-viewport-width", viewportWidth);

      const isFullscreen = Boolean(webApp.isFullscreen ?? viewportApi?.isFullscreen);
      const isExpanded = Boolean(webApp.isExpanded ?? viewportApi?.isExpanded);
      root.dataset.tgFullscreen = isFullscreen ? "true" : "false";
      root.dataset.tgExpanded = isExpanded ? "true" : "false";

      if (typeof webApp.setHeaderColor === "function") {
        webApp.setHeaderColor("#000000");
      }
      if (typeof webApp.setBackgroundColor === "function") {
        webApp.setBackgroundColor("#000000");
      }
      if (typeof webApp.setBottomBarColor === "function") {
        webApp.setBottomBarColor("#000000");
      }
    };

    applyMetrics();

    const cleanup: Array<VoidFunction> = [];

    const registerWebAppEvent = (event: string) => {
      if (typeof webApp.onEvent === "function" && typeof webApp.offEvent === "function") {
        webApp.onEvent(event, applyMetrics);
        cleanup.push(() => {
          webApp.offEvent?.(event, applyMetrics);
        });
      }
    };

    const webAppEvents = new Set([
      "safe_area_changed",
      "content_safe_area_changed",
      "viewport_changed",
      "fullscreen_changed",
      "theme_changed",
      "safeAreaChanged",
      "contentSafeAreaChanged",
      "viewportChanged",
      "fullscreenChanged",
      "themeChanged",
    ]);
    webAppEvents.forEach(registerWebAppEvent);

    const handleViewportUpdate = () => applyMetrics();

    if (
      typeof viewportApi?.onViewportChanged === "function" &&
      typeof viewportApi?.offViewportChanged === "function"
    ) {
      viewportApi.onViewportChanged(handleViewportUpdate);
      cleanup.push(() => {
        viewportApi.offViewportChanged?.(handleViewportUpdate);
      });
    }

    if (
      typeof viewportApi?.onFullscreenChanged === "function" &&
      typeof viewportApi?.offFullscreenChanged === "function"
    ) {
      viewportApi.onFullscreenChanged(handleViewportUpdate);
      cleanup.push(() => {
        viewportApi.offFullscreenChanged?.(handleViewportUpdate);
      });
    }

    if (
      typeof viewportApi?.onSafeAreaInsetsChanged === "function" &&
      typeof viewportApi?.offSafeAreaInsetsChanged === "function"
    ) {
      const safeAreaListener: (insets: Insets) => void = () => handleViewportUpdate();
      viewportApi.onSafeAreaInsetsChanged(safeAreaListener);
      cleanup.push(() => {
        viewportApi.offSafeAreaInsetsChanged?.(safeAreaListener);
      });
    }

    if (
      typeof viewportApi?.onContentSafeAreaInsetsChanged === "function" &&
      typeof viewportApi?.offContentSafeAreaInsetsChanged === "function"
    ) {
      const contentSafeAreaListener: (insets: Insets) => void = () => handleViewportUpdate();
      viewportApi.onContentSafeAreaInsetsChanged(contentSafeAreaListener);
      cleanup.push(() => {
        viewportApi.offContentSafeAreaInsetsChanged?.(contentSafeAreaListener);
      });
    }

    const handleResize = () => applyMetrics();
    window.addEventListener("resize", handleResize);
    cleanup.push(() => {
      window.removeEventListener("resize", handleResize);
    });

    if (window.visualViewport) {
      const handleViewport = () => applyMetrics();
      const events: Array<keyof VisualViewportEventMap> = ["resize", "scroll"];
      events.forEach((event) => {
        window.visualViewport?.addEventListener(event, handleViewport);
      });
      cleanup.push(() => {
        events.forEach((event) => {
          window.visualViewport?.removeEventListener(event, handleViewport);
        });
      });
    }

    try {
      webApp.requestSafeArea?.();
      webApp.requestContentSafeArea?.();
      webApp.requestViewport?.();
    } catch (_error) {
      // Swallow errors from optional Telegram APIs silently.
    }

    return () => {
      for (const fn of cleanup) {
        fn();
      }
      [
        "--app-safe-area-top",
        "--app-safe-area-right",
        "--app-safe-area-bottom",
        "--app-safe-area-left",
        "--app-content-safe-area-top",
        "--app-content-safe-area-right",
        "--app-content-safe-area-bottom",
        "--app-content-safe-area-left",
        "--tg-viewport-height",
        "--tg-viewport-stable-height",
        "--tg-viewport-width",
        "--tg-viewport-safe-area-inset-top",
        "--tg-viewport-safe-area-inset-right",
        "--tg-viewport-safe-area-inset-bottom",
        "--tg-viewport-safe-area-inset-left",
        "--tg-viewport-content-safe-area-inset-top",
        "--tg-viewport-content-safe-area-inset-right",
        "--tg-viewport-content-safe-area-inset-bottom",
        "--tg-viewport-content-safe-area-inset-left",
      ].forEach((varName) => {
        root.style.removeProperty(varName);
      });
      delete root.dataset.telegram;
      delete root.dataset.tgPlatform;
      delete root.dataset.tgFullscreen;
      delete root.dataset.tgExpanded;
    };
  }, []);
}

/**
 * Hook to prevent pull-to-refresh gesture
 */
export function usePreventPullToRefresh() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const preventPullToRefresh = (e: Event) => {
      const touchEvent = e as TouchEvent;
      const target = touchEvent.target as HTMLElement;
      const scrollable = target.closest(".screen-wrapper");

      if (scrollable && scrollable.scrollTop === 0 && touchEvent.touches) {
        const touch = touchEvent.touches[0];
        const startY = touch.clientY;

        const handleMove = (moveEvent: Event) => {
          const moveTouchEvent = moveEvent as TouchEvent;
          if (!moveTouchEvent.touches) return;

          const moveTouch = moveTouchEvent.touches[0];
          const currentY = moveTouch.clientY;
          const diff = currentY - startY;

          if (diff > 0 && scrollable.scrollTop === 0) {
            moveEvent.preventDefault();
          }
        };

        document.addEventListener("touchmove", handleMove, { passive: false });

        const cleanup = () => {
          document.removeEventListener("touchmove", handleMove);
        };

        document.addEventListener("touchend", cleanup, { once: true });
        document.addEventListener("touchcancel", cleanup, { once: true });
      }
    };

    document.addEventListener("touchstart", preventPullToRefresh, { passive: false });

    return () => {
      document.removeEventListener("touchstart", preventPullToRefresh);
    };
  }, []);
}
