import { useEffect, useState } from "react";
import LoadingScreen from "@/features/loading/components/LoadingScreen";
import MainScreen from "@/features/main/components/MainScreen";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const fadeTimer = setTimeout(() => setFadeOut(true), 4700);
    return () => clearTimeout(fadeTimer);
  }, [loading]);

  return (
    <div className="app-root">
      {loading && (
        <div className={`overlay ${fadeOut ? "overlay--fade-out" : ""}`}>
          <LoadingScreen durationMs={5000} onDone={() => setLoading(false)} />
        </div>
      )}

      {/* Главное меню */}
      <main className="app-main app-main--visible" aria-label="Application">
        <MainScreen loading={loading} showNav={fadeOut || !loading} />
      </main>
    </div>
  );
}
