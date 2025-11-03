import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ScreenHeader from "@/features/main/components/ScreenHeader";
import { shopItems } from "@/features/main/data/shop";
import { useUserRuntime } from "@/features/user/UserRuntimeContext";
import { ggFormatter, numberFormatter } from "@/shared/utils/formatters";
import { useBoosts } from "@/shared/hooks";
import { haptics } from "@/shared/utils/haptics";
import type { ActiveBoost, BoostActivationResult } from "@/shared/state/boosts";

type ShopItem = (typeof shopItems)[number];

const REFRESH_INTERVAL_MS = 30_000;

const formatFactor = (factor: number) => {
  const delta = (factor - 1) * 100;
  if (!Number.isFinite(delta)) {
    return `x${factor.toFixed(2)}`;
  }
  if (Math.abs(delta) < 0.1) {
    return `x${factor.toFixed(2)}`;
  }
  const decimals = Math.abs(delta) < 10 ? 1 : 0;
  return `${delta >= 0 ? "+" : ""}${delta.toFixed(decimals)}%`;
};

const formatSessions = (count: number) => {
  const abs = Math.abs(count) % 100;
  const mod10 = abs % 10;
  if (abs > 10 && abs < 20) {
    return `${count} сессий`;
  }
  if (mod10 === 1) {
    return `${count} сессию`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${count} сессии`;
  }
  return `${count} сессий`;
};

const formatExpiryLabel = (expiresAt: number | undefined, now: number) => {
  if (!expiresAt) return "Активен";
  const diff = Math.max(0, expiresAt - now);
  const minutes = Math.ceil(diff / 60_000);
  let relative: string;
  if (minutes < 60) {
    relative = `через ${minutes} мин`;
  } else if (minutes < 60 * 24) {
    relative = `через ${Math.ceil(minutes / 60)} ч`;
  } else {
    relative = `через ${Math.ceil(minutes / (60 * 24))} д`;
  }
  const absolute = new Date(expiresAt).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${relative} · до ${absolute}`;
};

const getBoostTag = (boost: ActiveBoost) => {
  switch (boost.kind) {
    case "session":
      return "Сессии";
    case "timed":
      return "Время";
    case "auto-collect":
      return "Автосбор";
    default:
      return "Буст";
  }
};

export default function ShopScreen() {
  const { balances, spendGram, recordBurn } = useUserRuntime();
  const { activateBoost, activeBoosts, multiplier } = useBoosts();
  const items = shopItems;
  const [selected, setSelected] = useState<ShopItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [view, setView] = useState<"catalog" | "active">("catalog");

  const canAfford = useMemo(() => {
    if (!selected) return true;
    return balances.gram >= selected.price;
  }, [balances.gram, selected]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, []);

  const activeList = useMemo(() => {
    return activeBoosts
      .filter((boost) => {
        if (boost.kind === "session") {
          return (boost.sessionsRemaining ?? 0) > 0;
        }
        if (boost.kind === "timed") {
          return (boost.expiresAt ?? now) > now;
        }
        if (boost.kind === "auto-collect") {
          return boost.expiresAt > now;
        }
        return true;
      })
      .sort((a, b) => {
        const left =
          a.kind === "timed" || a.kind === "auto-collect" ? (a.expiresAt ?? 0) : a.activatedAt;
        const right =
          b.kind === "timed" || b.kind === "auto-collect" ? (b.expiresAt ?? 0) : b.activatedAt;
        return left - right;
      });
  }, [activeBoosts, now]);

  const activeItemIds = useMemo(() => {
    const ids = new Set<string>();
    for (const boost of activeList) {
      if (boost.originItemId) {
        ids.add(boost.originItemId);
      }
    }
    return ids;
  }, [activeList]);

  const multiplierValue = useMemo(() => Number(multiplier.toFixed(2)), [multiplier]);
  const multiplierLabel =
    multiplierValue > 1
      ? `Общий множитель: x${multiplierValue.toFixed(2)}`
      : "Множитель: x1.00 (без усилений)";

  const handleBuyClick = (item: ShopItem) => {
    setSelected(item);
    setError(null);
    haptics.selection();
  };

  const handleCloseModal = () => {
    setSelected(null);
    setError(null);
    haptics.impact("soft");
  };

  const handleConfirmPurchase = () => {
    if (!selected) return;
    if (balances.gram < selected.price) {
      setError("Недостаточно GRAM. Пополните баланс перед покупкой.");
      haptics.warning();
      return;
    }

    const success = spendGram(selected.price);
    if (!success) {
      setError("Не удалось списать GRAM. Попробуйте снова.");
      haptics.error();
      return;
    }

    let activation: BoostActivationResult | null = null;
    if (selected.boost) {
      activation = activateBoost(selected.boost, {
        name: selected.name,
        icon: selected.icon,
        itemId: selected.id,
        description: selected.description,
      });
    }

    const buildNotice = () => {
      if (!activation) {
        return `Потрачено ${numberFormatter.format(selected.price)} GRAM за «${selected.name}».`;
      }

      switch (activation.kind) {
        case "session-multiplier": {
          const effect = formatFactor(activation.factor);
          return `Активирован ${selected.name}: ${effect} на ${formatSessions(activation.sessionsRemaining)}.`;
        }
        case "timed-multiplier": {
          const effect = formatFactor(activation.factor);
          const expiry = formatExpiryLabel(activation.expiresAt, Date.now());
          const prefix = activation.extended ? "Продлён" : "Активирован";
          return `${prefix} ${selected.name}: ${effect}, ${expiry}.`;
        }
        case "auto-collect": {
          const expiry = formatExpiryLabel(activation.expiresAt, Date.now());
          const prefix = activation.extended ? "Продлён" : "Активирован";
          return `${prefix} автосбор: ${expiry}.`;
        }
        case "instant-gold": {
          return `Везение! +${ggFormatter.format(activation.goldAwarded)} GOLD.`;
        }
        default:
          return `Потрачено ${numberFormatter.format(selected.price)} GRAM за «${selected.name}».`;
      }
    };

    const goldEarned = activation?.kind === "instant-gold" ? activation.goldAwarded : 0;
    recordBurn(selected.price, {
      goldEarned,
      source: "purchase",
      description: selected.name,
    });

    setNotice(buildNotice());
    haptics.success();
    handleCloseModal();
  };

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const selectedItem = selected;

  return (
    <section className="screen shop" aria-label="Магазин">
      <div className="shop-container screen-stack">
        <ScreenHeader
          title="Магазин"
          subtitle="Улучшайте майнинг с помощью бустеров"
          className="shop-header"
        >
          <div className="shop-balance">
            <span className="shop-balance__icon">💰</span>
            <span className="shop-balance__label">Баланс:</span>
            <span className="shop-balance__value">
              {numberFormatter.format(balances.gram)} GRAM · {ggFormatter.format(balances.gold)}{" "}
              GOLD
            </span>
          </div>
        </ScreenHeader>

        {notice && <div className="shop-notice">{notice}</div>}

        <div className="shop-tabs" role="tablist" aria-label="Разделы магазина">
          <button
            type="button"
            className={`shop-tab${view === "catalog" ? " is-active" : ""}`}
            role="tab"
            aria-selected={view === "catalog"}
            onClick={() => setView("catalog")}
          >
            Бусты
          </button>
          <button
            type="button"
            className={`shop-tab${view === "active" ? " is-active" : ""}`}
            role="tab"
            aria-selected={view === "active"}
            onClick={() => setView("active")}
          >
            Активные бусты
          </button>
        </div>

        {view === "catalog" ? (
          <div className="shop-grid" role="tabpanel" aria-label="Каталог бустов">
            {items.map((item) => {
              const isActive = activeItemIds.has(item.id);
              const buttonLabel = !item.available ? "Недоступно" : isActive ? "Куплено" : "Купить";

              return (
                <div
                  key={item.id}
                  className={`shop-item ${!item.available ? "shop-item--unavailable" : ""}`}
                >
                  {item.badge && <div className="shop-item__badge">{item.badge}</div>}

                  <div className="shop-item__icon">{item.icon}</div>

                  <div className="shop-item__content">
                    <h3 className="shop-item__name">{item.name}</h3>
                    <p className="shop-item__description">{item.description}</p>
                    <div className="shop-item__effect">{item.effectLabel}</div>
                  </div>

                  <div className="shop-item__footer">
                    <div className="shop-item__price">
                      <span className="shop-item__price-value">
                        {numberFormatter.format(item.price)}
                      </span>
                      <span className="shop-item__price-currency">GRAM</span>
                    </div>
                    <button
                      type="button"
                      className={`shop-item__button${isActive ? " shop-item__button--owned" : ""}`}
                      disabled={!item.available || isActive}
                      onClick={() => handleBuyClick(item)}
                      aria-label={
                        item.available && !isActive
                          ? `Купить за ${numberFormatter.format(item.price)} GRAM`
                          : item.available
                            ? "Буст уже активен"
                            : undefined
                      }
                    >
                      {buttonLabel}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <section className="shop-active" role="tabpanel" aria-label="Активные бусты">
            <div className="shop-active__header">
              <h2>Активные бусты</h2>
              <span className="shop-active__summary">{multiplierLabel}</span>
            </div>
            {activeList.length > 0 ? (
              <ul className="shop-active__list">
                {activeList.map((boost) => {
                  const icon = boost.icon ?? "✨";
                  let primary = "";
                  let secondary = "";

                  if (boost.kind === "session") {
                    primary = formatFactor(boost.factor);
                    const remaining = boost.sessionsRemaining ?? 0;
                    secondary = `Осталось: ${formatSessions(remaining)}`;
                  } else if (boost.kind === "timed") {
                    primary = formatFactor(boost.factor);
                    secondary = formatExpiryLabel(boost.expiresAt, now);
                  } else if (boost.kind === "auto-collect") {
                    primary = "Автосбор активен";
                    secondary = formatExpiryLabel(boost.expiresAt, now);
                  }

                  return (
                    <li key={boost.id} className="shop-active__item">
                      <span className="shop-active__icon" aria-hidden>
                        {icon}
                      </span>
                      <div className="shop-active__body">
                        <div className="shop-active__title">
                          <span className="shop-active__name">{boost.name}</span>
                          <span className="shop-active__tag">{getBoostTag(boost)}</span>
                        </div>
                        <span className="shop-active__primary">{primary}</span>
                        <span className="shop-active__secondary">{secondary}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="shop-empty">Нет активных бустов. Откройте бусты в каталоге.</div>
            )}
          </section>
        )}
      </div>

      {selectedItem &&
        createPortal(
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-purchase-title"
          >
            <div className="modal__backdrop" onClick={handleCloseModal} aria-hidden />
            <div className="modal__content">
              <h2 id="shop-purchase-title">Подтверждение покупки</h2>
              <p className="modal__item">{selectedItem.name}</p>
              <p className="modal__details">
                Цена: {numberFormatter.format(selectedItem.price)} GRAM
                {selectedItem.effectLabel ? `. Эффект: ${selectedItem.effectLabel}` : ""}.
              </p>
              <p className="modal__hint">
                Баланс: {numberFormatter.format(balances.gram)} GRAM ·{" "}
                {ggFormatter.format(balances.gold)} GOLD
              </p>
              {!canAfford && !error && (
                <p className="modal__warning">Недостаточно GRAM для покупки. Пополните баланс.</p>
              )}
              {error && <p className="modal__error">{error}</p>}
              <div className="modal__actions">
                <button type="button" className="modal__button" onClick={handleCloseModal}>
                  Отмена
                </button>
                <button
                  type="button"
                  className="modal__button modal__button--primary"
                  onClick={handleConfirmPurchase}
                  disabled={!canAfford}
                >
                  Купить за {numberFormatter.format(selectedItem.price)} GRAM
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </section>
  );
}
