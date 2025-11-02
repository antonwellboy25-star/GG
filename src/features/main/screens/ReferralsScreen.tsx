import { useState } from "react";
import ScreenHeader from "@/features/main/components/ScreenHeader";
import { useTelegramInfo } from "@/shared/hooks";
import { buildReferralLinks } from "@/shared/utils/telegram";
import { copyToClipboard, openTelegramShare } from "@/shared/utils/formatters";

export default function ReferralsScreen() {
  const [copied, setCopied] = useState(false);
  const { profile, referralCode, referralLinks } = useTelegramInfo();

  const effectiveCode = referralCode ?? "—";
  const effectiveLinks = referralLinks ?? buildReferralLinks(null);
  const shareLink = effectiveLinks.universal;

  const displayName = profile
    ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.username || "Вы"
    : "Вы";

  const handleCopy = async (text: string) => {
    const ok = await copyToClipboard(text);
    if (!ok) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    openTelegramShare({
      url: shareLink,
      text: `${displayName} приглашает тебя в GG Mining!`,
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
            <div className="referral-stat-card__value">0</div>
            <div className="referral-stat-card__label">Всего рефералов</div>
          </div>
          <div className="referral-stat-card">
            <div className="referral-stat-card__icon">✨</div>
            <div className="referral-stat-card__value">0</div>
            <div className="referral-stat-card__label">Активных</div>
          </div>
          <div className="referral-stat-card referral-stat-card--highlight">
            <div className="referral-stat-card__icon">💎</div>
            <div className="referral-stat-card__value">0</div>
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
              <span className="referral-code-box__value">{effectiveCode}</span>
            </div>
            <button type="button" className="copy-button" onClick={() => handleCopy(effectiveCode)}>
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
              onClick={() => handleCopy(shareLink)}
            >
              <span>🔗</span>
              Скопировать ссылку
            </button>
          </div>
        </div>

        {/* Top Referrals */}
        <div className="referral-section">
          <h2 className="referral-section__title">Топ рефералов</h2>
          <div className="referral-list empty">
            <p className="referral-empty">
              Статистика появится после запусков программы рекомендаций.
            </p>
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
