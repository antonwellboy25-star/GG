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
  totalGG: 12_450,
  totalSessions: 87,
  avgPerSession: 143,
  burnRate: 0.1,
};

export const recentSessions: RecentSession[] = [
  { id: 1, date: "26 окт", burned: 1_000, earned: 100, status: "completed" },
  { id: 2, date: "25 окт", burned: 1_500, earned: 150, status: "completed" },
  { id: 3, date: "24 окт", burned: 2_000, earned: 200, status: "completed" },
];
