import { useEffect, useMemo, useState } from "react";
import ScreenHeader from "@/features/main/components/ScreenHeader";
import { tasks as defaultTasks, type Task } from "@/features/main/data/tasks";
import { ggFormatter } from "@/shared/utils/formatters";
import { haptics } from "@/shared/utils/haptics";
import { useUserRuntime } from "@/features/user/UserRuntimeContext";
import { useTonWallet } from "@tonconnect/ui-react";

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);
  const { runtime, addGold } = useUserRuntime();
  const wallet = useTonWallet();

  // daily login eligibility (once per day)
  const [dailyEligible, setDailyEligible] = useState<boolean>(false);
  useEffect(() => {
    const key = "gg_daily_login_date";
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const todayKey = `${y}-${m + 1}-${d}`;
    const last = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    if (last !== todayKey) {
      // посещение сегодня впервые — задание доступно к получению
      setDailyEligible(true);
      try {
        localStorage.setItem(key, todayKey);
      } catch {}
    }
  }, []);

  const eligibility = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const t of tasks) {
      switch (t.id) {
        case "1": // Первая сессия майнинга
          map[t.id] = runtime.sessionsCompleted >= 1;
          break;
        case "2": // Подключите TON кошелек
          map[t.id] = Boolean(wallet);
          break;
        case "3": // Пригласите друга — нет серверной части, считаем недоступным
          map[t.id] = false;
          break;
        case "4": // Ежедневный вход
          map[t.id] = dailyEligible;
          break;
        case "5": // Подпишитесь на канал — требует серверной проверки
          map[t.id] = false;
          break;
        case "6": // Сожгите 10000 GRAM
          map[t.id] = runtime.burnedGram >= 10_000;
          break;
        default:
          map[t.id] = false;
      }
    }
    return map;
  }, [tasks, runtime.sessionsCompleted, runtime.burnedGram, wallet, dailyEligible]);

  const handleClaim = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.completed || !eligibility[taskId]) return;

    // начисляем награду
    addGold(task.reward);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed: true } : t)));
    haptics.success();
  };

  const tasksByType = {
    onboarding: tasks.filter((t) => t.type === "onboarding"),
    daily: tasks.filter((t) => t.type === "daily"),
    social: tasks.filter((t) => t.type === "social"),
  };

  const totalReward = tasks.reduce((sum, task) => sum + (task.completed ? task.reward : 0), 0);
  const completedCount = tasks.filter((t) => t.completed).length;

  return (
    <section className="screen tasks" aria-label="Задания">
      <div className="tasks-container screen-stack">
        <ScreenHeader title="Задания" subtitle="Выполняйте задания и получайте награды" />

        {/* Progress Overview */}
        <div className="tasks-progress-card">
          <div className="tasks-progress-card__stats">
            <div className="tasks-progress-stat">
              <div className="tasks-progress-stat__value">
                {completedCount}/{tasks.length}
              </div>
              <div className="tasks-progress-stat__label">Выполнено</div>
            </div>
            <div className="tasks-progress-stat tasks-progress-stat--highlight">
              <div className="tasks-progress-stat__value">+{ggFormatter.format(totalReward)}</div>
              <div className="tasks-progress-stat__label">GG заработано</div>
            </div>
          </div>
          <div className="tasks-progress-bar">
            <div
              className="tasks-progress-bar__fill"
              style={{ width: `${(completedCount / tasks.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Onboarding Tasks */}
        <div className="tasks-section">
          <h2 className="tasks-section__title">🚀 Начало работы</h2>
          <div className="tasks-list">
            {tasksByType.onboarding.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                eligible={eligibility[task.id]}
                formatter={ggFormatter}
                onClaim={handleClaim}
              />
            ))}
          </div>
        </div>

        {/* Daily Tasks */}
        <div className="tasks-section">
          <h2 className="tasks-section__title">📅 Ежедневные задания</h2>
          <div className="tasks-list">
            {tasksByType.daily.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                eligible={eligibility[task.id]}
                formatter={ggFormatter}
                onClaim={handleClaim}
              />
            ))}
          </div>
        </div>

        {/* Social Tasks */}
        <div className="tasks-section">
          <h2 className="tasks-section__title">💬 Социальные задания</h2>
          <div className="tasks-list">
            {tasksByType.social.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                eligible={eligibility[task.id]}
                formatter={ggFormatter}
                onClaim={handleClaim}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskCard({
  task,
  eligible,
  formatter,
  onClaim,
}: {
  task: Task;
  eligible: boolean;
  formatter: Intl.NumberFormat;
  onClaim: (taskId: string) => void;
}) {
  return (
    <div className={`task-card ${task.completed ? "task-card--completed" : ""}`}>
      <div className="task-card__icon">{task.completed ? "✅" : "⭕"}</div>
      <div className="task-card__content">
        <h3 className="task-card__title">{task.title}</h3>
        <p className="task-card__description">{task.description}</p>
      </div>
      <div className="task-card__reward">
        <div className="task-card__reward-value">+{formatter.format(task.reward)}</div>
        <div className="task-card__reward-label">GG</div>
      </div>
      <button
        type="button"
        className={`task-card__action ${task.completed ? "task-card__action--completed" : ""}`}
        onClick={() => !task.completed && eligible && onClaim(task.id)}
        disabled={task.completed || !eligible}
      >
        {task.completed ? "Получено" : eligible ? "Получить" : "Недоступно"}
      </button>
    </div>
  );
}
