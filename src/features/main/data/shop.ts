export type ShopItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  icon: string;
  effect: string;
  available: boolean;
  badge?: string;
};

export const shopItems: ShopItem[] = [
  {
    id: "1",
    name: "Pulse Booster",
    description: "Ускоряет добычу на несколько ближайших сессий",
    price: 6_000,
    icon: "⚡",
    effect: "+25% награда (3 сессии)",
    available: true,
    badge: "Популярное",
  },
  {
    id: "2",
    name: "Stability Core",
    description: "Повышает эффективность сжигания в течение суток",
    price: 12_000,
    icon: "💎",
    effect: "+40% эффективность (24 часа)",
    available: true,
    badge: "Лучшее",
  },
  {
    id: "3",
    name: "Auto-Collect Mini",
    description: "Автосбор наград без входа в игру",
    price: 8_500,
    icon: "🤖",
    effect: "Авто-сбор (7 дней)",
    available: true,
  },
  {
    id: "4",
    name: "Premium Pass",
    description: "Расширенные возможности и косметика на месяц",
    price: 25_000,
    icon: "👑",
    effect: "VIP статус",
    available: false,
    badge: "Скоро",
  },
  {
    id: "5",
    name: "Referral Pulse",
    description: "Увеличивает доход от сети рефералов",
    price: 5_500,
    icon: "🎯",
    effect: "+5% реф. бонус (14 дней)",
    available: true,
  },
  {
    id: "6",
    name: "Lucky Spark",
    description: "Шанс получить существенный прирост GOLD",
    price: 2_800,
    icon: "🎁",
    effect: "0.1-1.0 GOLD",
    available: true,
  },
];
