import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { RecentSession, StatisticsSummary } from "@/features/main/data/statistics";
import { recentSessions as baseSessions } from "@/features/main/data/statistics";
import { getDifficultySnapshot } from "@/shared/utils/miningDifficulty";
const MAX_HISTORY_RECORDS = 20;
const MAX_RECENT_SESSIONS = 10;

type BurnSource = "mining" | "purchase" | "other";

export type BurnRecord = {
  id: number;
  gram: number;
  gold: number;
  date: string;
  source: BurnSource;
  description?: string;
};

type RecordBurnOptions = {
  goldEarned?: number;
  source?: BurnSource;
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

type DifficultyState = {
  goldPerGram: number;
  gramPerGold: number;
  nextUpdate: Date;
  dayIndex: number;
};

type UserRuntimeContextValue = {
  stats: StatisticsSummary;
  runtime: RuntimeState;
  recentSessions: RecentSession[];
  difficulty: DifficultyState;
  balances: {
    gram: number;
    gold: number;
  };
  recordBurn: (gramAmount: number, options?: RecordBurnOptions) => BurnRecord;
  addGram: (gramAmount: number) => void;
  spendGram: (gramAmount: number) => boolean;
  addGold: (goldAmount: number) => void;
  resetAll: () => void;
};

const UserRuntimeContext = createContext<UserRuntimeContextValue | null>(null);

const DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
});

const formatRecentDate = (date: Date) => DATE_FORMATTER.format(date);

const createInitialRuntime = (): RuntimeState => ({
  burnedGram: 0,
  mintedGold: 0,
  history: [],
  gramBalance: 0,
  goldBalance: 0,
  sessionsCompleted: 0,
});

const createInitialSessions = () => baseSessions.map((session) => ({ ...session }));

const createDifficultyState = () => {
  const snapshot = getDifficultySnapshot();
  const goldPerGram = Number(snapshot.currentRate.toFixed(6));
  const gramPerGold = goldPerGram > 0 ? Number((1 / goldPerGram).toFixed(6)) : 0;

  return {
    goldPerGram,
    gramPerGold,
    nextUpdate: snapshot.nextUpdate,
    dayIndex: snapshot.dayIndex,
  } satisfies DifficultyState;
};

export function UserRuntimeProvider({ children }: { children: ReactNode }) {
  const [runtime, setRuntime] = useState<RuntimeState>(createInitialRuntime);
  const [sessions, setSessions] = useState<RecentSession[]>(createInitialSessions);
  const [difficulty, setDifficulty] = useState<DifficultyState>(createDifficultyState);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateDifficulty = () => {
      setDifficulty(createDifficultyState());
    };

    const delay = Math.max(500, difficulty.nextUpdate.getTime() - Date.now());
    const timeoutId = window.setTimeout(updateDifficulty, delay);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [difficulty.nextUpdate]);

  const stats = useMemo<StatisticsSummary>(() => {
    const { mintedGold, burnedGram, sessionsCompleted } = runtime;
    const avgPerSession = sessionsCompleted > 0 ? mintedGold / sessionsCompleted : 0;
    const burnRate = burnedGram > 0 ? mintedGold / burnedGram : 0;

    return {
      totalGG: mintedGold,
      totalSessions: sessionsCompleted,
      avgPerSession,
      burnRate,
    };
  }, [runtime]);

  const recordBurn = useCallback(
    (gramAmount: number, options: RecordBurnOptions = {}): BurnRecord => {
      if (gramAmount <= 0) {
        throw new Error("GRAM amount must be positive");
      }

      const { goldEarned, source = "other", description } = options;
      const gold = goldEarned ?? gramAmount * difficulty.goldPerGram;
      const now = new Date();
      const record: BurnRecord = {
        id: now.getTime(),
        gram: gramAmount,
        gold,
        date: now.toISOString(),
        source,
        description,
      };

      setRuntime((prev) => ({
        ...prev,
        burnedGram: prev.burnedGram + gramAmount,
        mintedGold: prev.mintedGold + gold,
        goldBalance: prev.goldBalance + gold,
        history: [record, ...prev.history].slice(0, MAX_HISTORY_RECORDS),
        sessionsCompleted: prev.sessionsCompleted + (source === "mining" ? 1 : 0),
      }));

      if (source === "mining") {
        const sessionEntry: RecentSession = {
          id: record.id,
          date: formatRecentDate(now),
          burned: gramAmount,
          earned: gold,
          status: "completed",
        };

        setSessions((prev) => [sessionEntry, ...prev].slice(0, MAX_RECENT_SESSIONS));
      }

      return record;
    },
    [difficulty.goldPerGram],
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
    setRuntime(createInitialRuntime());
    setSessions(createInitialSessions());
  }, []);

  const balances = useMemo(
    () => ({
      gram: runtime.gramBalance,
      gold: runtime.goldBalance,
    }),
    [runtime.gramBalance, runtime.goldBalance],
  );

  const value: UserRuntimeContextValue = useMemo(
    () => ({
      stats,
      runtime,
      recentSessions: sessions,
      difficulty,
      balances,
      recordBurn,
      addGram,
      spendGram,
      addGold,
      resetAll,
    }),
    [
      stats,
      runtime,
      sessions,
      difficulty,
      balances,
      recordBurn,
      addGram,
      spendGram,
      addGold,
      resetAll,
    ],
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
