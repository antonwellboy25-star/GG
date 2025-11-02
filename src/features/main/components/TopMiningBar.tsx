import { useEffect, useMemo, useState } from "react";
import { formatTime, goldFormatter, numberFormatter } from "@/shared/utils/formatters";
import { formatDifficultyCountdown } from "@/shared/utils/miningDifficulty";

type MiningSessionDisplay = {
  active: boolean;
  progress: number;
  gramsBurned: number;
  gramsTarget: number;
  goldEarned: number;
  goldTarget: number;
  baseGoldTarget: number;
  multiplier: number;
  remaining: number;
  elapsed: number;
  lastReward: number | null;
};

type MiningTotals = {
  burned: number;
  gold: number;
};

type TopMiningBarProps = {
  session: MiningSessionDisplay;
  totals: MiningTotals;
  balance: {
    gram: number;
    gold: number;
  };
  difficulty: {
    goldPerGram: number;
    nextUpdate: Date;
  };
  canMine: boolean;
  status?: string | null;
  onToggle: () => void;
  disabled?: boolean;
};

export default function TopMiningBar({
  session,
  balance,
  difficulty,
  canMine,
  status,
  onToggle,
  disabled = false,
}: TopMiningBarProps) {
  const [countdown, setCountdown] = useState(() =>
    formatDifficultyCountdown(difficulty.nextUpdate),
  );

  useEffect(() => {
    setCountdown(formatDifficultyCountdown(difficulty.nextUpdate));

    if (typeof window === "undefined") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setCountdown(formatDifficultyCountdown(difficulty.nextUpdate));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [difficulty.nextUpdate]);

  const rateLabel = useMemo(
    () => goldFormatter.format(difficulty.goldPerGram),
    [difficulty.goldPerGram],
  );

  const progressPercent = Math.min(100, session.progress * 100);
  const primaryStatus = session.active
    ? `Осталось ${formatTime(session.remaining)}`
    : canMine
      ? "Готов к запуску"
      : `Нужно ${numberFormatter.format(session.gramsTarget)} GRAM`;
  const multiplierValue =
    Number.isFinite(session.multiplier) && session.multiplier > 0 ? session.multiplier : 1;
  const multiplierRounded =
    multiplierValue >= 10 ? multiplierValue.toFixed(0) : multiplierValue.toFixed(2);
  const goldBonus = Math.max(0, session.goldTarget - session.baseGoldTarget);
  const hasBonus = goldBonus > 1e-6;
  const multiplierLabel = `x${multiplierRounded}`;
  const multiplierValueLabel = hasBonus
    ? `${multiplierLabel} · +${goldFormatter.format(goldBonus)} GOLD`
    : multiplierLabel;
  const multiplierSupplement = hasBonus
    ? ` (база ${goldFormatter.format(session.baseGoldTarget)} GOLD)`
    : "";
  const lastRewardLabel = session.lastReward
    ? `+${goldFormatter.format(session.lastReward)} GOLD`
    : "—";
  const buttonDisabled = disabled || (!session.active && !canMine);
  const buttonLabel = disabled
    ? "Загрузка..."
    : session.active
      ? "Остановить"
      : canMine
        ? `Запустить майнинг · ${numberFormatter.format(session.gramsTarget)} GRAM`
        : "Недостаточно GRAM";

  return (
    <header className="top-bar" aria-live="polite">
      <div className="top-bar__inner">
        <div className="top-bar__header">
          <div className="mining-info">
            <span className={`indicator ${session.active ? "indicator--on" : ""}`} aria-hidden />
            <div className="mining-info__text">
              <span className="mining-title">Майнинг</span>
              <span className="mining-status">{primaryStatus}</span>
            </div>
          </div>

          <div className="mining-balance">
            <span className="mining-balance__label">Баланс</span>
            <span className="mining-balance__value">
              {numberFormatter.format(balance.gram)} GRAM · {goldFormatter.format(balance.gold)}{" "}
              GOLD
            </span>
          </div>

          <div className="mining-difficulty" aria-live="polite">
            <div>
              <span className="mining-difficulty__label">Текущий курс</span>
              <span className="mining-difficulty__rate">1 GRAM → {rateLabel} GOLD</span>
            </div>
            <div>
              <span className="mining-difficulty__label">Халвинг через</span>
              <span className="mining-difficulty__countdown">~{countdown}</span>
            </div>
          </div>

          <div className="top-bar__actions">
            <button
              type="button"
              className={`btn-mine ${session.active ? "btn-mine--active" : ""}`}
              onClick={onToggle}
              aria-pressed={session.active}
              disabled={buttonDisabled}
            >
              {buttonLabel}
            </button>
          </div>
        </div>

        <div className="mining-progress">
          <div
            className="mining-progress__bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={session.gramsTarget}
            aria-valuenow={session.gramsBurned}
          >
            <span style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="mining-progress__metrics">
            <div className="mining-metric">
              <span className="mining-metric__label">Прогресс</span>
              <span className="mining-metric__value">
                {numberFormatter.format(session.gramsBurned)} /{" "}
                {numberFormatter.format(session.gramsTarget)}
              </span>
            </div>
            {multiplierValue > 1 && (
              <div className="mining-metric">
                <span className="mining-metric__label">Множитель</span>
                <span className="mining-metric__value">
                  {multiplierValueLabel}
                  {multiplierSupplement}
                </span>
              </div>
            )}
            {session.lastReward && session.lastReward > 0 && (
              <div className="mining-metric">
                <span className="mining-metric__label">Последняя награда</span>
                <span className="mining-metric__value">{lastRewardLabel}</span>
              </div>
            )}
          </div>

          {(session.gramsBurned > 0 || session.goldEarned > 0) && (
            <div className="mining-progress__details">
              Сожжено {numberFormatter.format(session.gramsBurned)} GRAM · Заработано{" "}
              {goldFormatter.format(session.goldEarned)} GOLD
            </div>
          )}
        </div>

        <div className="mining-status-area" aria-live="polite" aria-atomic="true">
          <div
            className={`mining-status-message${status ? " mining-status-message--visible" : ""}`}
            aria-hidden={status ? undefined : true}
          >
            {status ?? "\u00a0"}
          </div>
        </div>
      </div>
    </header>
  );
}
