/**
 * Shared hooks for the application
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getAudioPreferences,
  subscribeAudioPreferences,
  type AudioPreferences,
} from "@/shared/state/audioPreferences";
import { getTelegramInfo, type TelegramInfo } from "@/shared/utils/telegram";

const noop = () => getAudioPreferences();

export const useAudioPreferences = (): AudioPreferences => {
  return useSyncExternalStore(subscribeAudioPreferences, getAudioPreferences, noop);
};

export const useTelegramInfo = (): TelegramInfo => {
  const [info, setInfo] = useState<TelegramInfo>(() => getTelegramInfo());

  useEffect(() => {
    setInfo(getTelegramInfo());
  }, []);

  return info;
};
