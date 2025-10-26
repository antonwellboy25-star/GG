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
    reward: 100,
    completed: false,
    type: "onboarding",
  },
  {
    id: "2",
    title: "Подключите TON кошелёк",
    description: "Привяжите TON wallet для вывода средств",
    reward: 50,
    completed: false,
    type: "onboarding",
  },
  {
    id: "3",
    title: "Пригласите друга",
    description: "Пригласите хотя бы одного реферала",
    reward: 200,
    completed: false,
    type: "social",
  },
  {
    id: "4",
    title: "Ежедневный вход",
    description: "Заходите в приложение каждый день",
    reward: 25,
    completed: true,
    type: "daily",
  },
  {
    id: "5",
    title: "Подпишитесь на канал",
    description: "Подпишитесь на наш Telegram канал",
    reward: 75,
    completed: false,
    type: "social",
  },
  {
    id: "6",
    title: "Сожгите 10000 GRAM",
    description: "Достигните отметки в 10000 сожжённых GRAM",
    reward: 500,
    completed: false,
    type: "onboarding",
  },
];
