import ScreenHeader from "@/features/main/components/ScreenHeader";
import { useUserRuntime } from "@/features/user/UserRuntimeContext";

const numberFormatter = new Intl.NumberFormat("ru-RU");
const ggFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const goldFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 4,
});

export default function StatisticsScreen() {
  const { stats, recentSessions, runtime, gramPerGold } = useUserRuntime();
  const burnRatePercent = stats.burnRate * 100;

  return (
    <section className="screen statistics" aria-label="Статистика">
      <div className="stats-container screen-stack">
        <ScreenHeader title="Статистика" subtitle="Ваши достижения в майнинге" />

        {/* Summary Cards */}
        <div className="stats-grid">
          <div className="stats-card stats-card--primary">
            <div className="stats-card__icon">💰</div>
            <div className="stats-card__content">
              <div className="stats-card__value">{ggFormatter.format(stats.totalGG)}</div>
              <div className="stats-card__label">GG заработано</div>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-card__icon">⛏️</div>
            <div className="stats-card__content">
              <div className="stats-card__value">{numberFormatter.format(stats.totalSessions)}</div>
              <div className="stats-card__label">Сессий майнинга</div>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-card__icon">📊</div>
            <div className="stats-card__content">
              <div className="stats-card__value">{ggFormatter.format(stats.avgPerSession)}</div>
              <div className="stats-card__label">GG в среднем</div>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-card__icon">🔥</div>
            <div className="stats-card__content">
              <div className="stats-card__value">{burnRatePercent.toFixed(2)}%</div>
              <div className="stats-card__label">Текущий коэффициент</div>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-card__icon">🏅</div>
            <div className="stats-card__content">
              <div className="stats-card__value">
                +{goldFormatter.format(runtime.mintedGold)} GOLD
              </div>
              <div className="stats-card__label">Получено за обмен</div>
            </div>
          </div>
        </div>

        <div className="stats-note">
          <span className="stats-note__icon">ℹ️</span>
          <p className="stats-note__text">
            Фиксированный курс: 1 GOLD = {numberFormatter.format(gramPerGold)} GRAM.
          </p>
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
                        {numberFormatter.format(session.burned)} GRAM
                      </span>
                    </div>
                    <div className="timeline-stat timeline-stat--earned">
                      <span className="timeline-stat__label">Получено:</span>
                      <span className="timeline-stat__value">
                        +{goldFormatter.format(session.earned)} GOLD
                      </span>
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
