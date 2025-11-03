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

const DEBUG_MINING = import.meta.env.VITE_DEBUG_MINING === "true";
const miningLog = DEBUG_MINING ? (...args: unknown[]) => console.log(...args) : () => undefined;
const miningWarn = DEBUG_MINING ? (...args: unknown[]) => console.warn(...args) : () => undefined;

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
  const [canStopMining, setCanStopMining] = useState(true); // State для UI блокировки кнопки
  // Используем ref вместо state для sessionStake чтобы избежать stale closure
  const sessionStakeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const elapsedRef = useRef(0);
  // Флаг для атомарной защиты от race condition
  const miningLockRef = useRef(false);
  // Таймер для блокировки кнопки Stop на первые 1.5 секунды
  const canStopRef = useRef(true);
  const stopDebounceTimerRef = useRef<number | null>(null);
  // Счетчик операций для отладки
  const operationCounterRef = useRef(0);

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

  const gramsTarget = sessionStakeRef.current > 0 ? sessionStakeRef.current : GRAM_PER_SESSION;
  const gramsBurnedExact = progress * gramsTarget;
  const gramsBurned = Math.min(Math.round(gramsBurnedExact), gramsTarget);
  const goldEarnedExact = Math.min(progress * goldPerSessionExact, goldPerSessionExact);
  const goldEarned = Number(goldEarnedExact.toFixed(6));
  const remaining = Math.max(0, SESSION_DURATION_SEC - elapsed);

  const startMining = useCallback(() => {
    const opId = ++operationCounterRef.current;
    miningLog(`[Op#${opId}] startMining called, lock=${miningLockRef.current}`);

    // Атомарная проверка - если уже майним, отклоняем
    if (miningLockRef.current) {
      miningWarn(`[Op#${opId}] Mining lock active - rejecting duplicate start`);
      return false;
    }

    // Дополнительный предохранитель: если локальный стейк ещё не очищен, запрещаем запуск
    if (sessionStakeRef.current > 0) {
      miningWarn(
        `[Op#${opId}] Local stake still active (local=${sessionStakeRef.current}) - aborting start`,
      );
      setNotice("Дождитесь завершения текущей сессии");
      return false;
    }

    if (runtime.activeStake > 0) {
      miningWarn(
        `[Op#${opId}] Global activeStake=${runtime.activeStake}. Продолжаем, ожидаем синхронизацию`,
      );
    }

    // КРИТИЧЕСКИ ВАЖНО: Устанавливаем блокировку ДО spendGram!
    // Это предотвращает повторный вызов между spendGram и последующим кодом
    miningLockRef.current = true;
    miningLog(`[Op#${opId}] Lock acquired BEFORE spendGram`);

    const ok = spendGram(GRAM_PER_SESSION);
    if (!ok) {
      // Снимаем блокировку если списание не удалось
      miningLockRef.current = false;
      miningWarn(`[Op#${opId}] spendGram failed - lock released`);
      setNotice("Недостаточно GRAM. Пополните баланс для запуска майнинга.");
      haptics.warning();
      playWarningCue();
      miningWarn(`Failed to start mining: insufficient GRAM (needed: ${GRAM_PER_SESSION})`);
      return false;
    }

    miningLog(`[Op#${opId}] Mining started: ${GRAM_PER_SESSION} GRAM deducted, balance locked`);

    // Блокируем кнопку Stop на 1.5 секунды для предотвращения случайных кликов
    canStopRef.current = false;
    setCanStopMining(false); // UI блокировка
    if (stopDebounceTimerRef.current !== null) {
      window.clearTimeout(stopDebounceTimerRef.current);
    }
    stopDebounceTimerRef.current = window.setTimeout(() => {
      canStopRef.current = true;
      setCanStopMining(true); // Разблокировка UI
      stopDebounceTimerRef.current = null;
      miningLog("Stop button unlocked - can stop mining now");
    }, 1500); // 1.5 секунды

    startRef.current = null;
    setProgress(0);
    setElapsed(0);
    progressRef.current = 0;
    elapsedRef.current = 0;
    setIsMining(true);
    sessionStakeRef.current = GRAM_PER_SESSION;
    setNotice(null);
    haptics.impact("light");
    playMiningStart();
    return true;
  }, [runtime.activeStake, spendGram]);

  const stopMining = useCallback(() => {
    const opId = ++operationCounterRef.current;
    miningLog(
      `[Op#${opId}] stopMining called, stake=${sessionStakeRef.current}, progress=${progressRef.current}`,
    );

    // Принудительная остановка RAF ПЕРВЫМ делом
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      miningLog(`[Op#${opId}] RAF cancelled`);
    }

    // Очищаем таймер debounce если активен
    if (stopDebounceTimerRef.current !== null) {
      window.clearTimeout(stopDebounceTimerRef.current);
      stopDebounceTimerRef.current = null;
    }
    canStopRef.current = true;
    setCanStopMining(true); // Разблокировка UI

    startRef.current = null;

    // Возвращаем GRAM только если майнинг не завершен
    const shouldRefund = sessionStakeRef.current > 0 && progressRef.current < 1;

    if (shouldRefund) {
      miningLog(
        `[Op#${opId}] Mining stopped early: returning ${sessionStakeRef.current} GRAM (progress: ${(progressRef.current * 100).toFixed(1)}%)`,
      );
      addGram(sessionStakeRef.current);
    } else if (progressRef.current >= 1) {
      miningLog(`[Op#${opId}] Mining completed: GRAM already consumed`);
    } else if (sessionStakeRef.current === 0) {
      miningWarn(`[Op#${opId}] Stop called but no stake to refund - possible race condition!`);
    }

    // Снимаем блокировку
    miningLockRef.current = false;
    miningLog(`[Op#${opId}] Lock released`);

    setIsMining(false);
    setProgress(0);
    setElapsed(0);
    progressRef.current = 0;
    elapsedRef.current = 0;
    sessionStakeRef.current = 0;
  }, [addGram]);

  const handleToggleMining = useCallback(() => {
    // Защита от двойного клика при остановке
    if (isMining) {
      // Проверяем можно ли остановить (прошло >= 1.5 сек)
      if (!canStopRef.current) {
        miningWarn("Stop button is locked - wait 1.5 seconds after start");
        setNotice("Подождите немного перед остановкой майнинга");
        haptics.warning();
        return;
      }

      stopMining();
      haptics.impact("soft");
      playMiningStop();
      setNotice("Майнинг остановлен. GRAM возвращены.");
      return;
    }

    // Дополнительная проверка блокировки
    if (miningLockRef.current) {
      miningWarn("Mining lock is active - cannot start new session");
      setNotice("Дождитесь завершения текущей операции");
      return;
    }

    // Дополнительная проверка что майнинг действительно не запущен
    if (rafRef.current !== null) {
      miningWarn("Mining RAF already running - forcing cleanup");
      stopMining(); // Принудительная очистка
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
        sessionStakeRef.current = 0;
        miningLockRef.current = false; // Снимаем блокировку при завершении
        canStopRef.current = true; // Разблокируем кнопку Stop
        setCanStopMining(true); // UI разблокировка
        if (stopDebounceTimerRef.current !== null) {
          window.clearTimeout(stopDebounceTimerRef.current);
          stopDebounceTimerRef.current = null;
        }
        setNotice(`Начислено +${goldFormatter.format(goldPerSessionExact)} GOLD.`);
        miningLog("Mining completed successfully - lock released");
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
      // Cleanup: снимаем блокировку если компонент размонтируется во время майнинга
      miningLog("Mining effect cleanup - releasing lock if active");
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
          disabled={loading || (isMining && !canStopMining)}
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
