export type TaskType = "daily" | "onboarding" | "social";

export type Task = {
  id: string;
  title: string;
  description: string;
  reward: number;
  completed: boolean;
  type: TaskType;
};

export const tasks: Task[] = [
  {
    id: "1",
    title: "Первая сессия майнинга",
    description: "Запустите вашу первую сессию майнинга GG",
    reward: 0.25,
    completed: false,
    type: "onboarding",
  },
  {
    id: "2",
    title: "Подключите TON кошелёк",
    description: "Привяжите TON wallet для вывода средств",
    reward: 0.15,
    completed: false,
    type: "onboarding",
  },
  {
    id: "3",
    title: "Пригласите друга",
    description: "Пригласите хотя бы одного реферала",
    reward: 0.4,
    completed: false,
    type: "social",
  },
  {
    id: "4",
    title: "Ежедневный вход",
    description: "Заходите в приложение каждый день",
    reward: 0.05,
    completed: true,
    type: "daily",
  },
  {
    id: "5",
    title: "Подпишитесь на канал",
    description: "Подпишитесь на наш Telegram канал",
    reward: 0.1,
    completed: false,
    type: "social",
  },
  {
    id: "6",
    title: "Сожгите 10000 GRAM",
    description: "Достигните отметки в 10000 сожжённых GRAM",
    reward: 0.6,
    completed: false,
    type: "onboarding",
  },
];
