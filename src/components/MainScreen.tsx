import { useCallback, useEffect, useMemo, useState } from "react";
import NavBar, { SCREEN_ORDER, type Screen } from "./NavBar";
import SettingsScreen from "./screens/SettingsScreen";
import StatisticsScreen from "./screens/StatisticsScreen";
import ReferralsScreen from "./screens/ReferralsScreen";
import ShopScreen from "./screens/ShopScreen";
import TasksScreen from "./screens/TasksScreen";
import Maining from "./maining";

const ANIM_MS = 320;

type MainScreenProps = {
  loading?: boolean;
  showNav?: boolean;
};

export default function MainScreen({ loading = false, showNav = false }: MainScreenProps) {
  const [active, setActive] = useState(false);
  const [screen, setScreen] = useState<Screen>("main");
  const [prev, setPrev] = useState<Screen | null>(null);
  const [dir, setDir] = useState<"left" | "right" | null>(null);
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

  const renderScreen = useCallback(
    (s: Screen) => {
      switch (s) {
        case "main":
          return <HomeScreen miningActive={active} />;
        case "settings":
          return <SettingsScreen />;
        case "statistics":
          return <StatisticsScreen />;
        case "referrals":
          return <ReferralsScreen />;
        case "shop":
          return <ShopScreen />;
        case "tasks":
          return <TasksScreen />;
        default:
          return null;
      }
    },
    [active],
  );

  const prevNode = useMemo(() => (prev ? renderScreen(prev) : null), [prev, renderScreen]);
  const currentNode = useMemo(() => renderScreen(screen), [renderScreen, screen]);
  const outgoingClass = prev && dir ? (dir === "left" ? "slide-out-left" : "slide-out-right") : "";
  const incomingClass = prev && dir ? (dir === "left" ? "slide-in-right" : "slide-in-left") : "";
  const hasHome = screen === "main" || prev === "main";
  const mainBodyClass = useMemo(
    () => `main-body${hasHome ? " main-body--home" : ""}`,
    [hasHome],
  );
  const viewportClass = useMemo(
    () => `screens-viewport${hasHome ? " screens-viewport--home" : ""}`,
    [hasHome],
  );

  return (
    <div className="main-screen" role="main" aria-label="Главное меню">
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
            onClick={() => setActive((v) => !v)}
            aria-pressed={active}
          >
            {active ? "Остановить майнинг" : "Активировать майнинг"}
          </button>
        </div>
      </header>

      <section className={mainBodyClass} aria-label="Контент">
        <div className={viewportClass}>
          {prev && prevNode && (
            <div key={prev} className={`screen-wrapper ${outgoingClass}`}>
              {prevNode}
            </div>
          )}
          <div key={screen} className={`screen-wrapper screen-wrapper--active ${incomingClass}`}>
            {currentNode}
          </div>
        </div>
      </section>

      {(showNav || !loading) && <NavBar current={screen} onNavigate={navigate} />}
    </div>
  );
}

function HomeScreen({ miningActive }: { miningActive: boolean }) {
  return (
    <div className="screen home">
      <Maining active={miningActive} />
    </div>
  );
}
