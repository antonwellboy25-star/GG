import { formatTime, goldFormatter, numberFormatter } from "@/shared/utils/formatters";

type MiningSessionDisplay = {
  active: boolean;
  progress: number;
  gramsBurned: number;
  gramsTarget: number;
  goldEarned: number;
  goldTarget: number;
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
  canMine: boolean;
  status?: string | null;
  onToggle: () => void;
  disabled?: boolean;
};

export default function TopMiningBar({
  session,
  totals,
  balance,
  canMine,
  status,
  onToggle,
  disabled = false,
}: TopMiningBarProps) {
  const progressPercent = Math.min(100, session.progress * 100);
  const primaryStatus = session.active
    ? `Осталось ${formatTime(session.remaining)}`
    : canMine
      ? "Готов к запуску"
      : `Нужно ${numberFormatter.format(session.gramsTarget)} GRAM`;
  const totalBurned = totals.burned + (session.active ? session.gramsBurned : 0);
  const totalGold = totals.gold + (session.active ? session.goldEarned : 0);
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

        {status && (
          <div className="mining-status-message" aria-live="polite" aria-atomic="true">
            {status}
          </div>
        )}

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
              <span className="mining-metric__label">GRAM</span>
              <span className="mining-metric__value">
                {numberFormatter.format(session.gramsBurned)} /{" "}
                {numberFormatter.format(session.gramsTarget)}
              </span>
            </div>
            <div className="mining-metric">
              <span className="mining-metric__label">GOLD</span>
              <span className="mining-metric__value">
                {goldFormatter.format(session.goldEarned)} /{" "}
                {goldFormatter.format(session.goldTarget)}
              </span>
            </div>
            <div className="mining-metric">
              <span className="mining-metric__label">Последняя награда</span>
              <span className="mining-metric__value">{lastRewardLabel}</span>
            </div>
            <div className="mining-metric">
              <span className="mining-metric__label">Всего</span>
              <span className="mining-metric__value">
                {numberFormatter.format(totalBurned)} GRAM · {goldFormatter.format(totalGold)} GOLD
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
