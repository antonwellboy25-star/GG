import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import HomeScreen from "@/features/main/components/HomeScreen";
import TopMiningBar from "@/features/main/components/TopMiningBar";
import ProfileScreen from "@/features/main/screens/ProfileScreen";
import ReferralsScreen from "@/features/main/screens/ReferralsScreen";
import SettingsScreen from "@/features/main/screens/SettingsScreen";
import ShopScreen from "@/features/main/screens/ShopScreen";
import StatisticsScreen from "@/features/main/screens/StatisticsScreen";
import TasksScreen from "@/features/main/screens/TasksScreen";
import NavBar, { SCREEN_ORDER, type Screen } from "@/features/navigation/NavBar";
import { useUserRuntime } from "@/features/user/UserRuntimeContext";
import { goldFormatter } from "@/shared/utils/formatters";
import { useBoosts } from "@/shared/hooks";
import { haptics } from "@/shared/utils/haptics";
import {
  playMiningComplete,
  playMiningStart,
  playMiningStop,
  playSettingsCue,
  playWarningCue,
} from "@/shared/utils/sounds";

const ANIM_MS = 320;
const SESSION_DURATION_SEC = 20;
const SESSION_DURATION_MS = SESSION_DURATION_SEC * 1000;
const GRAM_PER_SESSION = 1000;

type MainScreenProps = {
  loading?: boolean;
  showNav?: boolean;
};

export default function MainScreen({ loading = false, showNav = false }: MainScreenProps) {
  const { difficulty, runtime, recordBurn, spendGram, addGram, balances } = useUserRuntime();
  const { multiplier, consumeSession } = useBoosts();

  const baseGoldPerSessionExact = useMemo(
    () => difficulty.goldPerGram * GRAM_PER_SESSION,
    [difficulty.goldPerGram],
  );

  const baseGoldPerSession = useMemo(
    () => Number(baseGoldPerSessionExact.toFixed(6)),
    [baseGoldPerSessionExact],
  );

  const appliedMultiplier = useMemo(() => {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return 1;
    }
    return Math.max(1, Number(multiplier.toFixed(6)));
  }, [multiplier]);

  const goldPerSessionExact = useMemo(
    () => baseGoldPerSessionExact * appliedMultiplier,
    [baseGoldPerSessionExact, appliedMultiplier],
  );

  const goldPerSession = useMemo(
    () => Number(goldPerSessionExact.toFixed(6)),
    [goldPerSessionExact],
  );

  const [isMining, setIsMining] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [lastReward, setLastReward] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sessionStake, setSessionStake] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const elapsedRef = useRef(0);

  const [screen, setScreen] = useState<Screen>("main");
  const [prev, setPrev] = useState<Screen | null>(null);
  const [dir, setDir] = useState<"left" | "right" | null>(null);
  const lastPrimaryRef = useRef<Screen>("main");
  useEffect(() => {
    let t: number | undefined;
    if (prev) {
      t = window.setTimeout(() => setPrev(null), ANIM_MS + 30);
    }
    return () => {
      if (t) window.clearTimeout(t);
    };
  }, [prev]);

  const navigate = useCallback(
    (to: Screen) => {
      if (to === screen) return;
      const fromIdx = SCREEN_ORDER.indexOf(screen);
      const toIdx = SCREEN_ORDER.indexOf(to);
      setPrev(screen);
      setDir(toIdx > fromIdx ? "left" : "right");
      setScreen(to);
    },
    [screen],
  );

  useEffect(() => {
    if (screen !== "settings") {
      lastPrimaryRef.current = screen;
    }
  }, [screen]);

  const toggleSettings = useCallback(() => {
    haptics.selection();
    playSettingsCue();
    if (screen === "settings") {
      const fallback = lastPrimaryRef.current === "settings" ? "main" : lastPrimaryRef.current;
      navigate(fallback);
    } else {
      navigate("settings");
    }
  }, [navigate, screen]);

  const renderScreen = useCallback(
    (s: Screen) => {
      switch (s) {
        case "main":
          return <HomeScreen miningActive={isMining} />;
        case "settings":
          return <SettingsScreen />;
        case "statistics":
          return <StatisticsScreen />;
        case "referrals":
          return <ReferralsScreen />;
        case "shop":
          return <ShopScreen />;
        case "profile":
          return <ProfileScreen />;
        case "tasks":
          return <TasksScreen />;
        default:
          return null;
      }
    },
    [isMining],
  );

  const prevNode = useMemo(() => (prev ? renderScreen(prev) : null), [prev, renderScreen]);
  const currentNode = useMemo(() => renderScreen(screen), [renderScreen, screen]);
  const outgoingClass = prev && dir ? (dir === "left" ? "slide-out-left" : "slide-out-right") : "";
  const incomingClass = prev && dir ? (dir === "left" ? "slide-in-right" : "slide-in-left") : "";
  const isHome = screen === "main";
  const mainBodyClass = useMemo(() => `main-body${isHome ? " main-body--home" : ""}`, [isHome]);
  const viewportClass = useMemo(
    () => `screens-viewport${isHome ? " screens-viewport--home" : ""}`,
    [isHome],
  );

  const gramsTarget = sessionStake > 0 ? sessionStake : GRAM_PER_SESSION;
  const gramsBurnedExact = progress * gramsTarget;
  const gramsBurned = Math.min(Math.round(gramsBurnedExact), gramsTarget);
  const goldEarnedExact = Math.min(progress * goldPerSessionExact, goldPerSessionExact);
  const goldEarned = Number(goldEarnedExact.toFixed(6));
  const remaining = Math.max(0, SESSION_DURATION_SEC - elapsed);

  const startMining = useCallback(() => {
    const ok = spendGram(GRAM_PER_SESSION);
    if (!ok) {
      setNotice("Недостаточно GRAM. Пополните баланс для запуска майнинга.");
      haptics.warning();
      playWarningCue();
      return false;
    }

    startRef.current = null;
    setProgress(0);
    setElapsed(0);
    progressRef.current = 0;
    elapsedRef.current = 0;
    setIsMining(true);
    setSessionStake(GRAM_PER_SESSION);
    setNotice(null);
    haptics.impact("light");
    playMiningStart();
    return true;
  }, [spendGram]);

  const stopMining = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    if (sessionStake > 0 && progress < 1) {
      addGram(sessionStake);
    }
    setIsMining(false);
    setProgress(0);
    setElapsed(0);
    progressRef.current = 0;
    elapsedRef.current = 0;
    setSessionStake(0);
  }, [addGram, progress, sessionStake]);

  const handleToggleMining = useCallback(() => {
    if (isMining) {
      stopMining();
      haptics.impact("soft");
      playMiningStop();
      return;
    }

    const started = startMining();
    if (!started) {
      return;
    }
  }, [isMining, startMining, stopMining]);

  useEffect(() => {
    if (!isMining) return;

    const step = (now: number) => {
      if (startRef.current == null) {
        startRef.current = now;
      }
      const elapsedMs = now - startRef.current;
      const nextProgress = Math.min(elapsedMs / SESSION_DURATION_MS, 1);
      const nextElapsed = Math.min(elapsedMs / 1000, SESSION_DURATION_SEC);

      if (Math.abs(nextProgress - progressRef.current) >= 0.005 || nextProgress >= 1) {
        progressRef.current = nextProgress;
        setProgress(nextProgress);
      }
      if (Math.abs(nextElapsed - elapsedRef.current) >= 0.1 || nextProgress >= 1) {
        elapsedRef.current = nextElapsed;
        setElapsed(nextElapsed);
      }

      if (nextProgress >= 1) {
        setLastReward(goldPerSession);
        recordBurn(GRAM_PER_SESSION, { goldEarned: goldPerSessionExact, source: "mining" });
        // consume one session of session-based boosts
        consumeSession();
        haptics.success();
        playMiningComplete();
        startRef.current = null;
        setIsMining(false);
        rafRef.current = null;
        setSessionStake(0);
        setNotice(`Начислено +${goldFormatter.format(goldPerSessionExact)} GOLD.`);
        return;
      }

      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [consumeSession, goldPerSession, goldPerSessionExact, isMining, recordBurn]);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    if (
      notice &&
      balances.gram >= GRAM_PER_SESSION &&
      notice.toLowerCase().includes("недостаточно")
    ) {
      setNotice(null);
    }
  }, [balances.gram, notice]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  return (
    <main className="main-screen" aria-label="Главное меню">
      {!loading && (
        <button
          type="button"
          className="settings-fab"
          onClick={toggleSettings}
          aria-label="Открыть настройки"
        >
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.62l-1.92-3.32a.5.5 0 0 0-.59-.22l-2.39.96a6.1 6.1 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.48-.41h-3.84a.5.5 0 0 0-.47.41l-.36 2.54a6.1 6.1 0 0 0-1.62.94l-2.39-.96a.5.5 0 0 0-.59.22L2.74 8.87a.5.5 0 0 0 .12.62l2.03 1.58a6.6 6.6 0 0 0-.07.94c0 .33.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.62l1.92 3.32a.5.5 0 0 0 .59.22l2.39-.96c.48.38 1.02.7 1.62.94l.36 2.54a.5.5 0 0 0 .47.41h3.84a.5.5 0 0 0 .48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96a.5.5 0 0 0 .59-.22l1.92-3.32a.5.5 0 0 0-.12-.62l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"
            />
          </svg>
        </button>
      )}

      {isHome && (
        <TopMiningBar
          session={{
            active: isMining,
            progress,
            gramsBurned,
            gramsTarget,
            goldEarned,
            goldTarget: goldPerSession,
            baseGoldTarget: baseGoldPerSession,
            multiplier: appliedMultiplier,
            remaining,
            elapsed,
            lastReward,
          }}
          difficulty={difficulty}
          totals={{
            burned: runtime.burnedGram,
            gold: runtime.mintedGold,
          }}
          balance={balances}
          canMine={balances.gram >= GRAM_PER_SESSION || isMining}
          status={notice}
          onToggle={handleToggleMining}
          disabled={loading}
        />
      )}

      <section className={mainBodyClass} aria-label="Контент">
        <div className={viewportClass}>
          {prev && prevNode && (
            <div
              key={prev}
              className={`screen-wrapper ${outgoingClass}${prev === "main" ? " screen-wrapper--home" : ""}`}
            >
              {prevNode}
            </div>
          )}
          <div
            key={screen}
            className={`screen-wrapper screen-wrapper--active ${incomingClass}${isHome ? " screen-wrapper--home" : ""}`}
          >
            {currentNode}
          </div>
        </div>
      </section>
      {(showNav || !loading) && <NavBar current={screen} onNavigate={navigate} />}
    </main>
  );
}
