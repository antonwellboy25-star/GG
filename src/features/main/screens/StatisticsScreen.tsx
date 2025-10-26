import ScreenHeader from "@/features/main/components/ScreenHeader";
import { recentSessions, statisticsSummary } from "@/features/main/data/statistics";

export default function StatisticsScreen() {
  const stats = statisticsSummary;

  return (
    <section className="screen statistics" aria-label="Статистика">
      <div className="stats-container screen-stack">
        <ScreenHeader title="Статистика" subtitle="Ваши достижения в майнинге" />

        {/* Summary Cards */}
        <div className="stats-grid">
          <div className="stats-card stats-card--primary">
            <div className="stats-card__icon">💰</div>
            <div className="stats-card__content">
              <div className="stats-card__value">{stats.totalGG.toLocaleString()}</div>
              <div className="stats-card__label">GG заработано</div>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-card__icon">⛏️</div>
            <div className="stats-card__content">
              <div className="stats-card__value">{stats.totalSessions}</div>
              <div className="stats-card__label">Сессий майнинга</div>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-card__icon">📊</div>
            <div className="stats-card__content">
              <div className="stats-card__value">{stats.avgPerSession}</div>
              <div className="stats-card__label">GG в среднем</div>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-card__icon">🔥</div>
            <div className="stats-card__content">
              <div className="stats-card__value">{stats.burnRate * 100}%</div>
              <div className="stats-card__label">Коэф. сжигания</div>
            </div>
          </div>
        </div>

        {/* Recent Sessions */}
        <div className="stats-section">
          <h2 className="stats-section__title">Последние сессии</h2>
          <div className="stats-timeline">
            {recentSessions.map((session) => (
              <div key={session.id} className="timeline-item">
                <div className="timeline-item__marker" />
                <div className="timeline-item__content">
                  <div className="timeline-item__header">
                    <span className="timeline-item__date">{session.date}</span>
                    <span className="timeline-item__badge timeline-item__badge--success">
                      ✓ Завершено
                    </span>
                  </div>
                  <div className="timeline-item__stats">
                    <div className="timeline-stat">
                      <span className="timeline-stat__label">Сожжено:</span>
                      <span className="timeline-stat__value">
                        {session.burned.toLocaleString()} GRAM
                      </span>
                    </div>
                    <div className="timeline-stat timeline-stat--earned">
                      <span className="timeline-stat__label">Получено:</span>
                      <span className="timeline-stat__value">+{session.earned} GG</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Empty State for new users */}
        {stats.totalSessions === 0 && (
          <div className="stats-empty">
            <div className="stats-empty__icon">📈</div>
            <h3>Начните майнить</h3>
            <p>Ваша статистика появится после первой сессии</p>
          </div>
        )}
      </div>
    </section>
  );
}
