import { useEffect, useState } from "react";
import { getTelegramInfo, type TelegramInfo } from "@/shared/utils/telegram";

export const useTelegramInfo = (): TelegramInfo => {
  const [info, setInfo] = useState<TelegramInfo>(() => getTelegramInfo());

  useEffect(() => {
    setInfo(getTelegramInfo());
  }, []);

  return info;
};
