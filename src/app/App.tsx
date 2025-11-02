/**
 * Main Application Component
 *
 * Handles the application boot sequence with loading screen and background music initialization.
 * Manages the transition from loading state to main application state with smooth fade effects.
 *
 * @module app/App
 */

import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import MainScreen from "@/features/main/components/MainScreen";
import { usePreventPullToRefresh, useTelegramWebApp } from "@/shared/hooks/useTelegramWebApp";
import {
  enableBackgroundMusicAutoplay,
  initBackgroundMusic,
  playBackgroundMusic,
} from "@/shared/utils/backgroundMusic";

const LazyLoadingScreen = lazy(() => import("@/features/loading/components/LoadingScreen"));

export default function App() {
  const [booting, setBooting] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  // Initialize Telegram WebApp and viewport handling
  useTelegramWebApp();
  usePreventPullToRefresh();

  const handleLoaderDone = useCallback(() => {
    enableBackgroundMusicAutoplay();
    setBooting(false);
    setFadeOut(true);
  }, []);

  useEffect(() => {
    initBackgroundMusic();
  }, []);

  useEffect(() => {
    if (!fadeOut) return;
    const timer = window.setTimeout(() => setShowOverlay(false), 420);
    return () => window.clearTimeout(timer);
  }, [fadeOut]);

  useEffect(() => {
    if (booting) return;
    void playBackgroundMusic();
  }, [booting]);

  return (
    <div className="app-root">
      {showOverlay && (
        <div className={`overlay ${fadeOut ? "overlay--fade-out" : ""}`}>
          <Suspense fallback={null}>
            <LazyLoadingScreen onDone={handleLoaderDone} />
          </Suspense>
        </div>
      )}

      <main className="app-main app-main--visible" aria-label="Application">
        <MainScreen loading={booting} showNav={fadeOut || !showOverlay} />
      </main>
    </div>
  );
}
