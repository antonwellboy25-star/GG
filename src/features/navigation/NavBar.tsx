import { memo, type JSX } from "react";

export type Screen = "main" | "tasks" | "shop" | "statistics" | "referrals" | "settings";

const CENTER_SCREEN: Screen = "main";
const LEFT_SCREENS: Screen[] = ["tasks", "shop"];
const RIGHT_SCREENS: Screen[] = ["statistics", "referrals", "settings"];

export const SCREEN_ORDER: Screen[] = [...LEFT_SCREENS, CENTER_SCREEN, ...RIGHT_SCREENS];

const LABELS: Record<Screen, string> = {
  main: "Главная",
  settings: "Настройки",
  statistics: "Статистика",
  referrals: "Рефералы",
  shop: "Магазин",
  tasks: "Задания",
};

const ICONS: Record<Screen, JSX.Element> = {
  main: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="m12 3-8.5 7.25V20a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-4.5h3v4.5a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-9.75L12 3Z"
      />
    </svg>
  ),
  tasks: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 4h8a2 2 0 0 1 2 2v1h2a1 1 0 0 1 0 2h-.77l-1.5 9a2 2 0 0 1-1.98 1.7H8.25A2 2 0 0 1 6.27 18L4.77 9H4a1 1 0 0 1 0-2h2V6a2 2 0 0 1 2-2Zm0 3h8V6a.5.5 0 0 0-.5-.5h-7A.5.5 0 0 0 8 6v1Zm1.7 6.05 1.55 1.55 3.1-3.1a.8.8 0 0 1 1.13 1.13l-3.7 3.7a.8.8 0 0 1-1.13 0l-2.12-2.11a.8.8 0 0 1 1.13-1.17Z"
      />
    </svg>
  ),
  shop: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M8 7V6a4 4 0 0 1 8 0v1h3.02a1 1 0 0 1 .99 1.15l-1.72 10.33A2.5 2.5 0 0 1 15.82 21H8.18a2.5 2.5 0 0 1-2.45-2.52L3.98 8.15A1 1 0 0 1 4.97 7H8Zm2-1a2 2 0 1 1 4 0v1h-4V6Zm2 5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z"
      />
    </svg>
  ),
  statistics: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M5.5 19a1 1 0 0 1-1-1v-5.5a1 1 0 0 1 1-1H8a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-2.5Zm6.25 0a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h2.5a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1h-2.5Zm6.25 0a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H19a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-1Z"
      />
    </svg>
  ),
  referrals: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 4.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Zm6.75 2.75a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0ZM9.75 16.5a3.25 3.25 0 1 1-6.5 0 3.25 3.25 0 0 1 6.5 0Zm11-1.25a2.75 2.75 0 1 1-5.5 0 2.75 2.75 0 0 1 5.5 0Zm-10.4-.5a4.24 4.24 0 0 0-1.4-2.24 2.5 2.5 0 0 1 4.3 0 4.24 4.24 0 0 0-1.4 2.24 4.3 4.3 0 0 1-1.5 0Z"
      />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 9.25a2.75 2.75 0 1 1 0 5.5 2.75 2.75 0 0 1 0-5.5ZM20.31 11a8 8 0 0 0-.23-1.24l1.42-1.1a.9.9 0 0 0 .2-1.17l-1.5-2.6a.9.9 0 0 0-1.1-.38l-1.67.67a7.8 7.8 0 0 0-1.94-1.12l-.25-1.78A.9.9 0 0 0 13.34 2h-2.68a.9.9 0 0 0-.9.78l-.25 1.78a7.8 7.8 0 0 0-1.94 1.12l-1.67-.67a.9.9 0 0 0-1.1.38l-1.5 2.6a.9.9 0 0 0 .2 1.17l1.42 1.1a8 8 0 0 0 0 2.48l-1.42 1.1a.9.9 0 0 0-.2 1.17l1.5 2.6a.9.9 0 0 0 1.1.38l1.67-.67a7.8 7.8 0 0 0 1.94 1.12l.25 1.78a.9.9 0 0 0 .9.78h2.68a.9.9 0 0 0 .9-.78l.25-1.78a7.8 7.8 0 0 0 1.94-1.12l1.67.67a.9.9 0 0 0 1.1-.38l1.5-2.6a.9.9 0 0 0-.2-1.17L20.08 12c.15-.4.23-.82.23-1.25Z"
      />
    </svg>
  ),
};

type NavBarProps = {
  current: Screen;
  onNavigate: (to: Screen) => void;
};

function NavBarComponent({ current, onNavigate }: NavBarProps) {
  const renderButton = (screen: Screen) => {
    const isActive = current === screen;
    const isCenter = screen === CENTER_SCREEN;
    const classNames = ["nav-btn"];
    if (isCenter) classNames.push("nav-btn--main");
    if (isActive) classNames.push("nav-btn--active");

    return (
      <button
        type="button"
        className={classNames.join(" ")}
        onClick={() => onNavigate(screen)}
        aria-current={isActive ? "page" : undefined}
        aria-label={LABELS[screen]}
      >
        <span className="nav-btn__bubble" aria-hidden="true">
          <span className="nav-btn__icon">{ICONS[screen]}</span>
        </span>
        <span className="nav-btn__label">{LABELS[screen]}</span>
      </button>
    );
  };

  return (
    <nav className="nav-bar" aria-label="Основная навигация">
      <div className="nav-track">
        <ul className="nav-cluster nav-cluster--left">
          {LEFT_SCREENS.map((screen) => (
            <li key={screen} className="nav-item">
              {renderButton(screen)}
            </li>
          ))}
        </ul>

        <div className="nav-center">{renderButton(CENTER_SCREEN)}</div>

        <ul className="nav-cluster nav-cluster--right">
          {RIGHT_SCREENS.map((screen) => (
            <li key={screen} className="nav-item">
              {renderButton(screen)}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

export default memo(NavBarComponent);
