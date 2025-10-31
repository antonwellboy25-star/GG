import { useSyncExternalStore } from "react";
import {
  getAudioPreferences,
  subscribeAudioPreferences,
  type AudioPreferences,
} from "@/shared/state/audioPreferences";

const noop = () => getAudioPreferences();

export const useAudioPreferences = (): AudioPreferences => {
  return useSyncExternalStore(subscribeAudioPreferences, getAudioPreferences, noop);
};
