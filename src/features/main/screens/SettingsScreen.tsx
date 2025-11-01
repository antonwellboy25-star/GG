import { useEffect, useMemo, useState } from "react";
import ScreenHeader from "@/features/main/components/ScreenHeader";
import { useUserRuntime } from "@/features/user/UserRuntimeContext";
import { useAudioPreferences, useTelegramInfo } from "@/shared/hooks";
import { setMusicEnabled, setSoundEnabled } from "@/shared/state/audioPreferences";
import { goldFormatter, numberFormatter } from "@/shared/utils/formatters";

export default function SettingsScreen() {
  const [devMode, setDevMode] = useState(false);
  const [devMessage, setDevMessage] = useState<string | null>(null);
  const { balances, runtime, addGram, resetAll } = useUserRuntime();
  const audioPreferences = useAudioPreferences();
  const { profile } = useTelegramInfo();

  const displayName = useMemo(() => {
    if (!profile) return "Гость Telegram";
    const parts = [profile.firstName, profile.lastName].filter(Boolean);
    return parts.length > 0
      ? parts.join(" ")
      : profile.username
        ? `@${profile.username}`
        : "Пользователь";
  }, [profile]);

  const subtitle = useMemo(() => {
    if (!profile) return "Управление аккаунтом и режимами";
    const usernamePart = profile.username ? ` · @${profile.username}` : "";
    return `${displayName}${usernamePart}`;
  }, [displayName, profile]);

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
        <ScreenHeader title="Настройки" subtitle={subtitle} />

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
                <span className="settings-field__label">Имя</span>
                <div className="settings-value">{displayName}</div>
              </div>
              <div className="settings-field">
                <span className="settings-field__label">Username</span>
                <div className="settings-value">
                  {profile?.username ? `@${profile.username}` : "—"}
                </div>
              </div>
              <div className="settings-field">
                <span className="settings-field__label">Telegram ID</span>
                <div className="settings-value">{profile ? profile.id : "—"}</div>
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
              <h2>🎧 Звук</h2>
            </div>
            <div className="settings-card__content">
              <div className="settings-field">
                <span className="settings-field__label">Фоновая музыка</span>
                <label className="settings-toggle settings-toggle--inline">
                  <input
                    type="checkbox"
                    checked={audioPreferences.musicEnabled}
                    onChange={(event) => setMusicEnabled(event.target.checked)}
                  />
                  <span className="settings-toggle__slider" />
                </label>
              </div>
              <div className="settings-field">
                <span className="settings-field__label">Звуковые эффекты</span>
                <label className="settings-toggle settings-toggle--inline">
                  <input
                    type="checkbox"
                    checked={audioPreferences.soundEnabled}
                    onChange={(event) => setSoundEnabled(event.target.checked)}
                  />
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
