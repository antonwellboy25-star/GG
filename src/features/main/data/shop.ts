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
    name: "Speed Booster",
    description: "Ускоряет майнинг на 25% на 24 часа",
    price: 500,
    icon: "⚡",
    effect: "+25% скорость",
    available: true,
    badge: "Популярное",
  },
  {
    id: "2",
    name: "Double Reward",
    description: "Удваивает награду за следующую сессию",
    price: 1_000,
    icon: "💎",
    effect: "x2 награда",
    available: true,
    badge: "Лучшее",
  },
  {
    id: "3",
    name: "Auto-Collect",
    description: "Автоматически собирает награды 7 дней",
    price: 2_500,
    icon: "🤖",
    effect: "Авто-сбор",
    available: true,
  },
  {
    id: "4",
    name: "Premium Pass",
    description: "Доступ ко всем функциям на месяц",
    price: 5_000,
    icon: "👑",
    effect: "VIP статус",
    available: false,
    badge: "Скоро",
  },
  {
    id: "5",
    name: "Referal Boost",
    description: "Увеличивает бонус с рефералов до 15%",
    price: 1_500,
    icon: "🎯",
    effect: "+5% реф. бонус",
    available: true,
  },
  {
    id: "6",
    name: "Lucky Pack",
    description: "Случайная награда от 100 до 10000 GG",
    price: 750,
    icon: "🎁",
    effect: "Случайная награда",
    available: true,
  },
];
