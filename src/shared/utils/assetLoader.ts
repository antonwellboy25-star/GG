/**
 * Asset Loading Utilities
 * 
 * Manages the progressive loading of application assets during the boot sequence.
 * Loads resources in optimized stages:
 * 1. Essential images (GG logo, GRAM logo)
 * 2. Background music
 * 3. Code-split modules (HomeScreen, MinerScene)
 * 
 * Features:
 * - Weighted progress tracking
 * - Abort signal support for cancellation
 * - Image caching to prevent duplicate loads
 * - RAF synchronization for smooth progress updates
 * 
 * @module shared/utils/assetLoader
 */

import ggLogoUrl from "@/assets/images/GG.png";
import gramLogoUrl from "@/assets/images/GRAM.png";
import { preloadBackgroundMusic } from "@/shared/utils/backgroundMusic";

type LoadCallback = (progress: number) => void;

type LoadOptions = {
  signal?: AbortSignal;
};

type LoaderTask = (options: LoadOptions) => Promise<void>;

type LoaderStage = {
  weight: number;
  task: LoaderTask;
};

const imageCache = new Set<string>();

const preloadImage = (src: string, signal?: AbortSignal) => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (imageCache.has(src)) {
    return Promise.resolve();
  }

  if (signal?.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }

  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";

    const handleAbort = () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    };

    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal?.removeEventListener("abort", handleAbort);
    };

    image.onload = () => {
      cleanup();
      imageCache.add(src);
      resolve();
    };

    image.onerror = () => {
      cleanup();
      resolve();
    };

    signal?.addEventListener("abort", handleAbort, { once: true });

    try {
      image.src = src;
    } catch (_error) {
      cleanup();
      resolve();
    }
  });
};

const waitForAnimationFrame = () =>
  new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

const loaderStages: LoaderStage[] = [
  {
    weight: 0.25,
    task: async ({ signal }) => {
      await preloadImage(ggLogoUrl, signal);
      await waitForAnimationFrame();
    },
  },
  {
    weight: 0.18,
    task: async ({ signal }) => {
      await preloadImage(gramLogoUrl, signal);
      await waitForAnimationFrame();
    },
  },
  {
    weight: 0.35,
    task: async ({ signal }) => {
      await preloadBackgroundMusic(signal);
      await waitForAnimationFrame();
    },
  },
  {
    weight: 0.22,
    task: async () => {
      // Warm up expensive modules that will be used immediately after loading.
      await Promise.all([
        import("@/features/main/components/HomeScreen"),
        import("@/features/mining/components/MinerScene"),
      ]);
      await waitForAnimationFrame();
    },
  },
];

const totalWeight = loaderStages.reduce((sum, current) => sum + current.weight, 0);

export const loadInitialResources = async (onProgress: LoadCallback, options: LoadOptions = {}) => {
  const { signal } = options;
  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  let accumulated = 0;
  onProgress(0);

  for (const stage of loaderStages) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      await stage.task(options);
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") {
        throw error;
      }
      // Ignore other loading errors; progress will continue.
    }

    accumulated += stage.weight;
    onProgress(Math.min(1, accumulated / totalWeight));
  }

  onProgress(1);
};
