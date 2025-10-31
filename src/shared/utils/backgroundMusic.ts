import backgroundMusicUrl from "@/assets/audio/background.mp3";
import { isMusicEnabled, subscribeAudioPreferences } from "@/shared/state/audioPreferences";

const RESUME_EVENTS: Array<keyof WindowEventMap> = ["pointerdown", "touchstart", "keydown"];

let audioElement: HTMLAudioElement | null = null;
let resumePending = false;
let boundResumeHandler: (() => void) | null = null;
let initialized = false;
let autoPlayUnlocked = false;

const ensureAudio = () => {
  if (!audioElement) {
    const element = new Audio(backgroundMusicUrl);
    element.loop = true;
    element.preload = "auto";
    element.volume = 0.03;
    audioElement = element;
  }
  return audioElement;
};

const cleanupResumeListeners = () => {
  const handler = boundResumeHandler;
  if (!handler) return;
  RESUME_EVENTS.forEach((event) => {
    window.removeEventListener(event, handler);
  });
  document.removeEventListener("visibilitychange", handler);
  boundResumeHandler = null;
};

const installResumeListeners = () => {
  if (boundResumeHandler) return;
  const handler = async () => {
    if (!resumePending) {
      cleanupResumeListeners();
      return;
    }

    const element = audioElement ?? ensureAudio();
    try {
      await element.play();
      resumePending = false;
      cleanupResumeListeners();
    } catch {
      // Keep waiting for the next interaction.
    }
  };
  boundResumeHandler = handler;

  RESUME_EVENTS.forEach((event) => {
    window.addEventListener(event, handler, { passive: true, capture: false });
  });
  document.addEventListener("visibilitychange", handler, { passive: true, capture: false });
};

export const preloadBackgroundMusic = (signal?: AbortSignal) => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  const element = ensureAudio();

  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  if (element.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const handleAbort = () => {
      element.pause();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      element.removeEventListener("canplaythrough", handleCanPlay);
      element.removeEventListener("error", handleError);
      signal?.removeEventListener("abort", handleAbort);
    };

    const handleCanPlay = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      resolve();
    };

    element.addEventListener("canplaythrough", handleCanPlay, { once: true });
    element.addEventListener("error", handleError, { once: true });
    signal?.addEventListener("abort", handleAbort, { once: true });

    try {
      element.load();
    } catch (_error) {
      cleanup();
      resolve();
    }
  });
};

export const playBackgroundMusic = async () => {
  if (typeof window === "undefined") return;
  if (!isMusicEnabled()) {
    pauseBackgroundMusic();
    return;
  }
  autoPlayUnlocked = true;
  const element = ensureAudio();

  try {
    await element.play();
    resumePending = false;
    cleanupResumeListeners();
  } catch {
    resumePending = true;
    installResumeListeners();
  }
};

export const pauseBackgroundMusic = () => {
  if (!audioElement) return;
  audioElement.pause();
  resumePending = false;
  cleanupResumeListeners();
};

export const stopBackgroundMusic = () => {
  if (!audioElement) return;
  audioElement.pause();
  try {
    audioElement.currentTime = 0;
  } catch (_error) {
    // Ignore DOM exceptions if unable to reset time (e.g., media not seekable yet).
  }
  resumePending = false;
  cleanupResumeListeners();
};

export const setBackgroundMusicVolume = (volume: number) => {
  const element = audioElement ?? ensureAudio();
  element.volume = Math.min(1, Math.max(0, volume));
};

const applyMusicPreference = () => {
  if (typeof window === "undefined") return;
  if (!isMusicEnabled()) {
    pauseBackgroundMusic();
    return;
  }

  if (!autoPlayUnlocked) {
    return;
  }

  const element = ensureAudio();
  if (element.paused && !resumePending) {
    void playBackgroundMusic();
  }
};

export const initBackgroundMusic = () => {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  ensureAudio();
};

export const enableBackgroundMusicAutoplay = () => {
  autoPlayUnlocked = true;
  applyMusicPreference();
};

if (typeof window !== "undefined") {
  subscribeAudioPreferences(applyMusicPreference);
}
