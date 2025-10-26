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
