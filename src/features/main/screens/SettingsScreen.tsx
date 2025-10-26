import { useState } from "react";
import ScreenHeader from "@/features/main/components/ScreenHeader";

export default function SettingsScreen() {
  const [devMode, setDevMode] = useState(false);
  const [balance, setBalance] = useState(0);

  const handleAddFunds = () => {
    setBalance((prev) => prev + 1000);
  };

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
                    <span className="dev-balance__value">{balance} GRAM</span>
                  </div>
                  <button type="button" className="dev-button" onClick={handleAddFunds}>
                    + Добавить 1000 GRAM
                  </button>
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

          {/* Mining Settings */}
          <div className="settings-card">
            <div className="settings-card__header">
              <h2>⛏️ Майнинг</h2>
            </div>
            <div className="settings-card__content">
              <div className="settings-field">
                <span className="settings-field__label">Режим отображения</span>
                <select className="settings-select">
                  <option>Полная сцена</option>
                  <option>Компактный</option>
                </select>
              </div>
              <div className="settings-field">
                <span className="settings-field__label">Автоматический старт</span>
                <label className="settings-toggle settings-toggle--inline">
                  <input type="checkbox" />
                  <span className="settings-toggle__slider" />
                </label>
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
