import { useEffect, useMemo, useState } from "react";
import ScreenHeader from "@/features/main/components/ScreenHeader";
import { useUserRuntime } from "@/features/user/UserRuntimeContext";

export default function SettingsScreen() {
  const [devMode, setDevMode] = useState(false);
  const [devMessage, setDevMessage] = useState<string | null>(null);
  const { balances, runtime, addGram, resetAll } = useUserRuntime();

  const numberFormatter = useMemo(() => new Intl.NumberFormat("ru-RU"), []);
  const goldFormatter = useMemo(
    () =>
      new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 4,
      }),
    [],
  );

  const handleAddFunds = () => {
    const amount = 1_000;
    addGram(amount);
    setDevMessage(`Добавлено ${numberFormatter.format(amount)} GRAM на тестовый баланс.`);
  };

  const handleReset = () => {
    resetAll();
    setDevMessage("Баланс и статистика сброшены.");
  };

  useEffect(() => {
    if (!devMode) {
      setDevMessage(null);
    }
  }, [devMode]);

  return (
    <section className="screen settings" aria-label="Настройки">
      <div className="settings-container screen-stack">
        <ScreenHeader title="Настройки" subtitle="Управление аккаунтом и режимами" />

        <div className="settings-sections">
          {/* Dev Mode */}
          <div className="settings-card">
            <div className="settings-card__header">
              <h2>🛠️ Dev Mode</h2>
              <label className="settings-toggle">
                <input
                  type="checkbox"
                  checked={devMode}
                  onChange={(e) => setDevMode(e.target.checked)}
                />
                <span className="settings-toggle__slider" />
              </label>
            </div>
            {devMode && (
              <div className="settings-card__content">
                <div className="dev-panel">
                  <div className="dev-balance">
                    <span className="dev-balance__label">Тестовый баланс:</span>
                    <span className="dev-balance__value">
                      <span>{numberFormatter.format(balances.gram)} GRAM</span>
                      <span>{goldFormatter.format(balances.gold)} GOLD</span>
                    </span>
                  </div>
                  <div className="dev-actions">
                    <button type="button" className="dev-button" onClick={handleAddFunds}>
                      + Добавить 1 000 GRAM
                    </button>
                    <button
                      type="button"
                      className="dev-button dev-button--secondary"
                      onClick={handleReset}
                    >
                      Сбросить баланс и статистику
                    </button>
                  </div>
                  <div className="dev-stats">
                    <div>
                      <span>Сожжено всего:</span>
                      <strong>{numberFormatter.format(runtime.burnedGram)} GRAM</strong>
                    </div>
                    <div>
                      <span>Начислено:</span>
                      <strong>{goldFormatter.format(runtime.mintedGold)} GOLD</strong>
                    </div>
                    <div>
                      <span>Сессий майнинга:</span>
                      <strong>{runtime.sessionsCompleted}</strong>
                    </div>
                  </div>
                  {devMessage && <p className="dev-feedback">{devMessage}</p>}
                  <p className="dev-note">В Dev-режиме майнинг работает без реального пополнения</p>
                </div>
              </div>
            )}
          </div>

          {/* Profile Section */}
          <div className="settings-card">
            <div className="settings-card__header">
              <h2>👤 Профиль</h2>
            </div>
            <div className="settings-card__content">
              <div className="settings-field">
                <span className="settings-field__label">Telegram ID</span>
                <div className="settings-value">Не подключён</div>
              </div>
              <div className="settings-field">
                <span className="settings-field__label">TON Wallet</span>
                <div className="settings-value">Не подключён</div>
              </div>
            </div>
          </div>

          {/* Interface */}
          <div className="settings-card">
            <div className="settings-card__header">
              <h2>🎨 Интерфейс</h2>
            </div>
            <div className="settings-card__content">
              <div className="settings-field">
                <span className="settings-field__label">Анимации</span>
                <label className="settings-toggle settings-toggle--inline">
                  <input type="checkbox" defaultChecked />
                  <span className="settings-toggle__slider" />
                </label>
              </div>
              <div className="settings-field">
                <span className="settings-field__label">Звуковые эффекты</span>
                <label className="settings-toggle settings-toggle--inline">
                  <input type="checkbox" />
                  <span className="settings-toggle__slider" />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
