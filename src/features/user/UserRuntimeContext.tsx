import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { recentSessions as baseSessions } from "@/features/main/data/statistics";
import type { StatisticsSummary, RecentSession } from "@/features/main/data/statistics";

const GRAM_PER_GOLD = 1000;

export type BurnRecord = {
  id: number;
  gram: number;
  gold: number;
  date: string;
  source: "mining" | "purchase" | "other";
  description?: string;
};

type RuntimeState = {
  burnedGram: number;
  mintedGold: number;
  history: BurnRecord[];
  gramBalance: number;
  goldBalance: number;
  sessionsCompleted: number;
};

type UserRuntimeContextValue = {
  stats: StatisticsSummary;
  runtime: RuntimeState;
  recentSessions: RecentSession[];
  gramPerGold: number;
  balances: {
    gram: number;
    gold: number;
  };
  recordBurn: (
    gramAmount: number,
    options?: { goldEarned?: number; source?: BurnRecord["source"]; description?: string },
  ) => BurnRecord;
  addGram: (gramAmount: number) => void;
  spendGram: (gramAmount: number) => boolean;
  addGold: (goldAmount: number) => void;
  resetAll: () => void;
};

const UserRuntimeContext = createContext<UserRuntimeContextValue | null>(null);

const INITIAL_RUNTIME: RuntimeState = {
  burnedGram: 0,
  mintedGold: 0,
  history: [],
  gramBalance: 0,
  goldBalance: 0,
  sessionsCompleted: 0,
};

const formatRecentDate = (date: Date) => {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(date);
};

export function UserRuntimeProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<RuntimeState>({ ...INITIAL_RUNTIME });
  const [sessions, setSessions] = useState<RecentSession[]>(baseSessions);

  const stats = useMemo<StatisticsSummary>(() => {
    const mintedTotal = runtime.mintedGold;
    const burnedTotal = runtime.burnedGram;
    const totalSessions = runtime.sessionsCompleted;
    const avgPerSession = totalSessions > 0 ? mintedTotal / totalSessions : 0;
    const burnRate = burnedTotal > 0 ? mintedTotal / burnedTotal : 0;

    return {
      totalGG: mintedTotal,
      totalSessions,
      avgPerSession,
      burnRate,
    };
  }, [runtime.mintedGold, runtime.burnedGram, runtime.sessionsCompleted]);

  const recordBurn = useCallback(
    (
      gramAmount: number,
      options: { goldEarned?: number; source?: BurnRecord["source"]; description?: string } = {},
    ): BurnRecord => {
      if (gramAmount <= 0) {
        throw new Error("GRAM amount must be positive");
      }

      const gold = options.goldEarned ?? gramAmount / GRAM_PER_GOLD;
      const source = options.source ?? "other";
      const now = new Date();
      const record: BurnRecord = {
        id: now.getTime(),
        gram: gramAmount,
        gold,
        date: now.toISOString(),
        source,
        description: options.description,
      };

      setRuntime((prev) => ({
        ...prev,
        burnedGram: prev.burnedGram + gramAmount,
        mintedGold: prev.mintedGold + gold,
        goldBalance: prev.goldBalance + gold,
        history: [record, ...prev.history].slice(0, 20),
        sessionsCompleted: prev.sessionsCompleted + (source === "mining" ? 1 : 0),
      }));

      if (source === "mining") {
        setSessions((prev) =>
          [
            {
              id: record.id,
              date: formatRecentDate(now),
              burned: gramAmount,
              earned: gold,
              status: "completed" as const,
            },
            ...prev,
          ].slice(0, 10),
        );
      }

      return record;
    },
    [],
  );

  const addGram = useCallback((gramAmount: number) => {
    if (gramAmount <= 0) {
      return;
    }
    setRuntime((prev) => ({
      ...prev,
      gramBalance: prev.gramBalance + gramAmount,
    }));
  }, []);

  const spendGram = useCallback((gramAmount: number) => {
    if (gramAmount <= 0) {
      return false;
    }
    let success = false;
    setRuntime((prev) => {
      if (prev.gramBalance < gramAmount) {
        return prev;
      }
      success = true;
      return {
        ...prev,
        gramBalance: prev.gramBalance - gramAmount,
      };
    });
    return success;
  }, []);

  const addGold = useCallback((goldAmount: number) => {
    if (goldAmount <= 0) {
      return;
    }
    setRuntime((prev) => ({
      ...prev,
      goldBalance: prev.goldBalance + goldAmount,
      mintedGold: prev.mintedGold + goldAmount,
    }));
  }, []);

  const resetAll = useCallback(() => {
    setRuntime({ ...INITIAL_RUNTIME });
    setSessions([]);
  }, []);

  const value: UserRuntimeContextValue = useMemo(
    () => ({
      stats,
      runtime,
      recentSessions: sessions,
      gramPerGold: GRAM_PER_GOLD,
      balances: {
        gram: runtime.gramBalance,
        gold: runtime.goldBalance,
      },
      recordBurn,
      addGram,
      spendGram,
      addGold,
      resetAll,
    }),
    [stats, runtime, sessions, recordBurn, addGram, spendGram, addGold, resetAll],
  );

  return <UserRuntimeContext.Provider value={value}>{children}</UserRuntimeContext.Provider>;
}

export function useUserRuntime() {
  const context = useContext(UserRuntimeContext);
  if (!context) {
    throw new Error("useUserRuntime must be used within UserRuntimeProvider");
  }
  return context;
}

export { GRAM_PER_GOLD };
