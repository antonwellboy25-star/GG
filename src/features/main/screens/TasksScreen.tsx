import { useState } from "react";
import ScreenHeader from "@/features/main/components/ScreenHeader";
import { tasks as defaultTasks, type Task } from "@/features/main/data/tasks";
import { ggFormatter } from "@/shared/utils/formatters";
import { haptics } from "@/shared/utils/haptics";

export default function TasksScreen() {
  const [tasks, setTasks] = useState<Task[]>(defaultTasks);

  const handleClaim = (taskId: string) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, completed: true } : task)),
    );
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
              <TaskCard key={task.id} task={task} formatter={ggFormatter} onClaim={handleClaim} />
            ))}
          </div>
        </div>

        {/* Daily Tasks */}
        <div className="tasks-section">
          <h2 className="tasks-section__title">📅 Ежедневные задания</h2>
          <div className="tasks-list">
            {tasksByType.daily.map((task) => (
              <TaskCard key={task.id} task={task} formatter={ggFormatter} onClaim={handleClaim} />
            ))}
          </div>
        </div>

        {/* Social Tasks */}
        <div className="tasks-section">
          <h2 className="tasks-section__title">💬 Социальные задания</h2>
          <div className="tasks-list">
            {tasksByType.social.map((task) => (
              <TaskCard key={task.id} task={task} formatter={ggFormatter} onClaim={handleClaim} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TaskCard({
  task,
  formatter,
  onClaim,
}: {
  task: Task;
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
        onClick={() => !task.completed && onClaim(task.id)}
        disabled={task.completed}
      >
        {task.completed ? "Получено" : "Получить"}
      </button>
    </div>
  );
}
