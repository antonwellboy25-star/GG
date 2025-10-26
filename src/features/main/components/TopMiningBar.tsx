type TopMiningBarProps = {
  active: boolean;
  onToggle: () => void;
};

export default function TopMiningBar({ active, onToggle }: TopMiningBarProps) {
  return (
    <header className="top-bar">
      <div className="mining-panel" aria-live="polite">
        <div className="mining-info">
          <span className={`indicator ${active ? "indicator--on" : ""}`} aria-hidden />
          <span className="mining-title">Майнинг</span>
          <span className="mining-status">{active ? "активирован" : "выключен"}</span>
        </div>
        <button
          type="button"
          className={`btn-mine ${active ? "btn-mine--active" : ""}`}
          onClick={onToggle}
          aria-pressed={active}
        >
          {active ? "Остановить майнинг" : "Активировать майнинг"}
        </button>
      </div>
    </header>
  );
}
