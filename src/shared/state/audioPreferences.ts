const STORAGE_KEY = "gg-audio-preferences-v1";

export type AudioPreferences = {
  soundEnabled: boolean;
  musicEnabled: boolean;
};

const defaultPreferences: AudioPreferences = {
  soundEnabled: true,
  musicEnabled: true,
};

let preferences: AudioPreferences = { ...defaultPreferences };
const listeners = new Set<() => void>();

const readFromStorage = (): AudioPreferences | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AudioPreferences>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      soundEnabled:
        typeof parsed.soundEnabled === "boolean"
          ? parsed.soundEnabled
          : defaultPreferences.soundEnabled,
      musicEnabled:
        typeof parsed.musicEnabled === "boolean"
          ? parsed.musicEnabled
          : defaultPreferences.musicEnabled,
    };
  } catch {
    return null;
  }
};

const writeToStorage = (value: AudioPreferences) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage write failures (e.g., Safari private mode).
  }
};

const notify = () => {
  listeners.forEach((listener) => {
    listener();
  });
};

const applyPreferences = (next: AudioPreferences) => {
  preferences = next;
  writeToStorage(preferences);
  notify();
};

if (typeof window !== "undefined") {
  const stored = readFromStorage();
  if (stored) {
    preferences = stored;
  }

  window.addEventListener(
    "storage",
    (event) => {
      if (event.key !== STORAGE_KEY) return;
      if (!event.newValue) {
        applyPreferences({ ...defaultPreferences });
        return;
      }
      try {
        const parsed = JSON.parse(event.newValue) as Partial<AudioPreferences>;
        if (!parsed || typeof parsed !== "object") return;
        preferences = {
          soundEnabled:
            typeof parsed.soundEnabled === "boolean"
              ? parsed.soundEnabled
              : defaultPreferences.soundEnabled,
          musicEnabled:
            typeof parsed.musicEnabled === "boolean"
              ? parsed.musicEnabled
              : defaultPreferences.musicEnabled,
        };
        notify();
      } catch {
        // Ignore malformed payloads.
      }
    },
    { passive: true },
  );
}

export const getAudioPreferences = () => preferences;

export const subscribeAudioPreferences = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isSoundEnabled = () => preferences.soundEnabled;

export const isMusicEnabled = () => preferences.musicEnabled;

export const setSoundEnabled = (enabled: boolean) => {
  if (preferences.soundEnabled === enabled) return;
  applyPreferences({ ...preferences, soundEnabled: enabled });
};

export const setMusicEnabled = (enabled: boolean) => {
  if (preferences.musicEnabled === enabled) return;
  applyPreferences({ ...preferences, musicEnabled: enabled });
};

export const resetAudioPreferences = () => {
  applyPreferences({ ...defaultPreferences });
};
