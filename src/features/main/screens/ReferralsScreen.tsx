import { useState } from "react";
import ScreenHeader from "@/features/main/components/ScreenHeader";
import {
  referralCode,
  referralLink,
  stats as referralStats,
  topReferrals,
} from "@/features/main/data/referrals";
import { copyToClipboard } from "@/shared/utils/clipboard";
import { openTelegramShare } from "@/shared/utils/share";

export default function ReferralsScreen() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    openTelegramShare({
      url: referralLink,
      text: "Присоединяйся к GG Mining!",
    });
  };

  return (
    <section className="screen referrals" aria-label="Рефералы">
      <div className="referrals-container screen-stack">
        <ScreenHeader title="Рефералы" subtitle="Приглашайте друзей и зарабатывайте вместе" />

        {/* Stats Overview */}
        <div className="referrals-stats">
          <div className="referral-stat-card">
            <div className="referral-stat-card__icon">👥</div>
            <div className="referral-stat-card__value">{referralStats.totalReferrals}</div>
            <div className="referral-stat-card__label">Всего рефералов</div>
          </div>
          <div className="referral-stat-card">
            <div className="referral-stat-card__icon">✨</div>
            <div className="referral-stat-card__value">{referralStats.activeReferrals}</div>
            <div className="referral-stat-card__label">Активных</div>
          </div>
          <div className="referral-stat-card referral-stat-card--highlight">
            <div className="referral-stat-card__icon">💎</div>
            <div className="referral-stat-card__value">
              {referralStats.totalEarned.toLocaleString()}
            </div>
            <div className="referral-stat-card__label">GG заработано</div>
          </div>
        </div>

        {/* Referral Link Card */}
        <div className="referral-link-card">
          <div className="referral-link-card__header">
            <h2>Ваша реферальная ссылка</h2>
            <p>Получайте 10% от всех сессий ваших рефералов</p>
          </div>

          <div className="referral-link-card__code">
            <div className="referral-code-box">
              <span className="referral-code-box__label">Код:</span>
              <span className="referral-code-box__value">{referralCode}</span>
            </div>
            <button type="button" className="copy-button" onClick={() => handleCopy(referralCode)}>
              {copied ? "✓ Скопировано" : "📋 Копировать"}
            </button>
          </div>

          <div className="referral-link-card__actions">
            <button
              type="button"
              className="referral-action-btn referral-action-btn--primary"
              onClick={handleShare}
            >
              <span>📤</span>
              Поделиться в Telegram
            </button>
            <button
              type="button"
              className="referral-action-btn"
              onClick={() => handleCopy(referralLink)}
            >
              <span>🔗</span>
              Скопировать ссылку
            </button>
          </div>
        </div>

        {/* Top Referrals */}
        <div className="referral-section">
          <h2 className="referral-section__title">Топ рефералов</h2>
          <div className="referral-list">
            {topReferrals.map((ref, index) => (
              <div key={ref.id} className="referral-item">
                <div className="referral-item__rank">#{index + 1}</div>
                <div className="referral-item__content">
                  <div className="referral-item__name">{ref.name}</div>
                  <div className="referral-item__details">
                    <span>{ref.sessions} сессий</span>
                    <span className="referral-item__separator">•</span>
                    <span className="referral-item__earned">+{ref.earned} GG</span>
                  </div>
                </div>
                <div className="referral-item__badge">🔥</div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="referral-info-box">
          <div className="referral-info-box__icon">💡</div>
          <div className="referral-info-box__content">
            <h3>Как это работает?</h3>
            <ul>
              <li>Поделитесь своей уникальной ссылкой</li>
              <li>Друзья регистрируются через вашу ссылку</li>
              <li>Вы получаете 10% от их добычи автоматически</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
