export type StatisticsSummary = {
  totalGG: number;
  totalSessions: number;
  avgPerSession: number;
  burnRate: number;
};

export type RecentSession = {
  id: number;
  date: string;
  burned: number;
  earned: number;
  status: "completed" | "failed" | "running";
};

export const statisticsSummary: StatisticsSummary = {
  totalGG: 0,
  totalSessions: 0,
  avgPerSession: 0,
  burnRate: 0,
};

export const recentSessions: RecentSession[] = [];
