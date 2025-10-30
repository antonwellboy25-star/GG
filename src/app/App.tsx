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

    const applyInsets = () => {
      const safe = webApp.safeAreaInset;
      const content = webApp.contentSafeAreaInset;

      const safeTop = Math.max(0, safe?.top ?? 0, content?.top ?? 0);
      const safeBottom = Math.max(0, safe?.bottom ?? 0, content?.bottom ?? 0);
      const safeLeft = Math.max(0, safe?.left ?? 0, content?.left ?? 0);
      const safeRight = Math.max(0, safe?.right ?? 0, content?.right ?? 0);

      root.style.setProperty("--app-safe-area-top", toPx(safeTop));
      root.style.setProperty("--app-safe-area-bottom", toPx(safeBottom));
      root.style.setProperty("--app-safe-area-left", toPx(safeLeft));
      root.style.setProperty("--app-safe-area-right", toPx(safeRight));

      root.style.setProperty(
        "--app-content-safe-area-top",
        toPx(Math.max(0, content?.top ?? safeTop)),
      );
      root.style.setProperty(
        "--app-content-safe-area-bottom",
        toPx(Math.max(0, content?.bottom ?? safeBottom)),
      );
      root.style.setProperty(
        "--app-content-safe-area-left",
        toPx(Math.max(0, content?.left ?? safeLeft)),
      );
      root.style.setProperty(
        "--app-content-safe-area-right",
        toPx(Math.max(0, content?.right ?? safeRight)),
      );

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

    return () => {
      events.forEach((event) => {
        webApp.offEvent(event, handleUpdate);
      });
      window.removeEventListener("resize", handleResize);
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
