import { useEffect, useState, useSyncExternalStore } from "react";
import {
  type AudioPreferences,
  getAudioPreferences,
  subscribeAudioPreferences,
} from "@/shared/state/audioPreferences";
import { getTelegramInfo, type TelegramInfo } from "@/shared/utils/telegram";

export { useBoosts } from "@/shared/state/boosts";
export {
  useTelegramStarsPurchase,
  type StarsInvoiceResult,
} from "@/shared/hooks/useTelegramPayments";

export const useAudioPreferences = (): AudioPreferences => {
  return useSyncExternalStore(subscribeAudioPreferences, getAudioPreferences, getAudioPreferences);
};

export const useTelegramInfo = (): TelegramInfo => {
  const [info, setInfo] = useState<TelegramInfo>(() => getTelegramInfo());

  useEffect(() => {
    setInfo(getTelegramInfo());
  }, []);

  return info;
};
