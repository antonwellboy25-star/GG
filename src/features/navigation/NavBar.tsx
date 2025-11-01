import { type JSX, memo } from "react";
import { haptics } from "@/shared/utils/haptics";
import { playNavTap } from "@/shared/utils/sounds";

export type Screen =
  | "main"
  | "tasks"
  | "shop"
  | "statistics"
  | "referrals"
  | "profile"
  | "settings";

export const SCREEN_ORDER: Screen[] = [
  "main",
  "tasks",
  "shop",
  "statistics",
  "referrals",
  "profile",
  "settings",
];

type ScreenConfig = {
  label: string;
  icon: JSX.Element;
  includeInNav?: boolean;
  isMain?: boolean;
};

const SCREEN_CONFIG: Record<Screen, ScreenConfig> = {
  main: {
    label: "Home",
    includeInNav: true,
    isMain: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12 2.75a1 1 0 0 1 .5.134l7 4a1 1 0 0 1 .5.866v8a1 1 0 0 1-.5.866l-7 4a1 1 0 0 1-1 0l-7-4A1 1 0 0 1 4 15.75v-8a1 1 0 0 1 .5-.866l7-4A1 1 0 0 1 12 2.75Zm0 1.658-6 3.429v6.326l6 3.429 6-3.429V7.837l-6-3.429Zm-1.75 5.09a.75.75 0 0 1 1.125-.66l3.5 2a.75.75 0 0 1 0 1.32l-3.5 2A.75.75 0 0 1 10.25 13.5v-4.002Z"
        />
      </svg>
    ),
  },
  tasks: {
    label: "Tasks",
    includeInNav: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-8.29 13.29L7.7 13.3a1 1 0 0 1 1.41-1.42l1.18 1.18 3.77-3.77a1 1 0 0 1 1.42 1.42l-4.48 4.48a1 1 0 0 1-1.41 0z"
        />
      </svg>
    ),
  },
  shop: {
    label: "Shop",
    includeInNav: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"
        />
      </svg>
    ),
  },
  statistics: {
    label: "Statistics",
    includeInNav: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"
        />
      </svg>
    ),
  },
  referrals: {
    label: "Referrals",
    includeInNav: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
        />
      </svg>
    ),
  },
  profile: {
    label: "Profile",
    includeInNav: true,
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.67-10 5v3h20v-3c0-3.33-6.67-5-10-5z"
        />
      </svg>
    ),
  },
  settings: {
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          fill="currentColor"
          d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
        />
      </svg>
    ),
  },
};

const NAV_ITEMS: Screen[] = SCREEN_ORDER.filter((screen) => SCREEN_CONFIG[screen].includeInNav);

type NavBarProps = {
  current: Screen;
  onNavigate: (to: Screen) => void;
};

function NavBarComponent({ current, onNavigate }: NavBarProps) {
  return (
    <nav className="nav-bar" aria-label="Primary navigation">
      <ul className="nav-bar__surface">
        {NAV_ITEMS.map((screen) => {
          const config = SCREEN_CONFIG[screen];
          const isActive = current === screen;
          const className = `nav-bar__button${config.isMain ? " nav-bar__button--main" : ""}${isActive ? " is-active" : ""}`;

          const handlePress = () => {
            if (isActive) {
              haptics.selection();
            } else {
              haptics.impact("light");
              onNavigate(screen);
            }
            playNavTap();
          };

          return (
            <li key={screen} className="nav-bar__item">
              <button
                type="button"
                className={className}
                onClick={handlePress}
                aria-current={isActive ? "page" : undefined}
                aria-label={config.label}
              >
                <span className="nav-bar__icon" aria-hidden="true">
                  {config.icon}
                </span>
                <span className="nav-bar__label">{config.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default memo(NavBarComponent);
