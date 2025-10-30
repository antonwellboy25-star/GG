import { Suspense, lazy, useEffect, useState } from "react";
import MainScreen from "@/features/main/components/MainScreen";

const LazyLoadingScreen = lazy(() => import("@/features/loading/components/LoadingScreen"));

export default function App() {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const fadeTimer = setTimeout(() => setFadeOut(true), 4700);
    return () => clearTimeout(fadeTimer);
  }, [loading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;
    webApp.ready();
    if (typeof webApp.expand === "function") {
      webApp.expand();
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const webApp = window.Telegram?.WebApp;
    if (!webApp) return;

    const root = document.documentElement;
    const toPx = (value?: number) => `${Math.max(0, value ?? 0)}px`;

    type Insets = { top: number; bottom: number; left: number; right: number };
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

      const result = { top, bottom, left, right };
      return hasInset(result) ? result : null;
    };

    const pickInsets = (primary: Insets | null | undefined, fallback: Insets | null) => {
      if (hasInset(primary)) return primary ?? null;
      if (fallback && hasInset(fallback)) return fallback;
      return null;
    };

    const setInsetVar = (name: string, value: number | null | undefined) => {
      if (value == null) {
        root.style.removeProperty(name);
        return;
      }
      root.style.setProperty(name, toPx(Math.max(0, value)));
    };

    const applyInsets = () => {
      const safeRaw = webApp.safeAreaInsets ?? webApp.safeAreaInset;
      const contentRaw = webApp.contentSafeAreaInsets ?? webApp.contentSafeAreaInset;
      const viewportFallback = computeViewportInsets();
      const safe = pickInsets(safeRaw, viewportFallback);
      const content = pickInsets(contentRaw, safe ?? viewportFallback);

      if (!hasInset(safe) && !hasInset(content)) {
        const safeVars = [
          "--app-safe-area-top",
          "--app-safe-area-bottom",
          "--app-safe-area-left",
          "--app-safe-area-right",
        ];
        const contentVars = [
          "--app-content-safe-area-top",
          "--app-content-safe-area-bottom",
          "--app-content-safe-area-left",
          "--app-content-safe-area-right",
        ];
        [...safeVars, ...contentVars].forEach((name) => {
          root.style.removeProperty(name);
        });
      } else {
        const safeTop = Math.max(0, safe?.top ?? 0, content?.top ?? 0);
        const safeBottom = Math.max(0, safe?.bottom ?? 0, content?.bottom ?? 0);
        const safeLeft = Math.max(0, safe?.left ?? 0, content?.left ?? 0);
        const safeRight = Math.max(0, safe?.right ?? 0, content?.right ?? 0);

        setInsetVar("--app-safe-area-top", safeTop);
        setInsetVar("--app-safe-area-bottom", safeBottom);
        setInsetVar("--app-safe-area-left", safeLeft);
        setInsetVar("--app-safe-area-right", safeRight);

        setInsetVar("--app-content-safe-area-top", content?.top ?? safeTop);
        setInsetVar("--app-content-safe-area-bottom", content?.bottom ?? safeBottom);
        setInsetVar("--app-content-safe-area-left", content?.left ?? safeLeft);
        setInsetVar("--app-content-safe-area-right", content?.right ?? safeRight);
      }

      root.dataset.tgFullscreen = webApp.isFullscreen ? "true" : "false";

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

    applyInsets();

    const events = [
      "safeAreaChanged",
      "contentSafeAreaChanged",
      "fullscreenChanged",
      "themeChanged",
      "viewportChanged",
    ] as const;

    const handleUpdate = () => applyInsets();
    events.forEach((event) => {
      webApp.onEvent(event, handleUpdate);
    });

    const handleResize = () => applyInsets();
    window.addEventListener("resize", handleResize);

    const viewportEvents: Array<keyof VisualViewportEventMap> = ["resize", "scroll"];
    const handleViewport = () => applyInsets();
    if (window.visualViewport) {
      viewportEvents.forEach((event) => {
        window.visualViewport?.addEventListener(event, handleViewport);
      });
    }

    return () => {
      events.forEach((event) => {
        webApp.offEvent(event, handleUpdate);
      });
      window.removeEventListener("resize", handleResize);
      if (window.visualViewport) {
        viewportEvents.forEach((event) => {
          window.visualViewport?.removeEventListener(event, handleViewport);
        });
      }
    };
  }, []);

  return (
    <div className="app-root">
      {loading && (
        <div className={`overlay ${fadeOut ? "overlay--fade-out" : ""}`}>
          <Suspense fallback={null}>
            <LazyLoadingScreen durationMs={5000} onDone={() => setLoading(false)} />
          </Suspense>
        </div>
      )}

      {/* Главное меню */}
      <main className="app-main app-main--visible" aria-label="Application">
        <MainScreen loading={loading} showNav={fadeOut || !loading} />
      </main>
    </div>
  );
}
