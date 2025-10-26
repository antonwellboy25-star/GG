type TopMiningBarProps = {
  active: boolean;
  onToggle: () => void;
  visible?: boolean;
};

export default function TopMiningBar({ active, onToggle, visible = true }: TopMiningBarProps) {
  return (
    <header className={`top-bar${visible ? "" : " top-bar--hidden"}`} aria-hidden={!visible}>
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
