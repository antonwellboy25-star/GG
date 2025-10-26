import { useEffect, useMemo, useState } from "react";
import ScreenHeader from "@/features/main/components/ScreenHeader";
import { shopItems } from "@/features/main/data/shop";
import { useUserRuntime } from "@/features/user/UserRuntimeContext";

type ShopItem = (typeof shopItems)[number];

export default function ShopScreen() {
  const { balances, spendGram, recordBurn } = useUserRuntime();
  const items = shopItems;
  const [selected, setSelected] = useState<ShopItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const numberFormatter = useMemo(() => new Intl.NumberFormat("ru-RU"), []);
  const goldFormatter = useMemo(
    () =>
      new Intl.NumberFormat("ru-RU", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const canAfford = useMemo(() => {
    if (!selected) return true;
    return balances.gram >= selected.price;
  }, [balances.gram, selected]);

  const handleBuyClick = (item: ShopItem) => {
    setSelected(item);
    setError(null);
  };

  const handleCloseModal = () => {
    setSelected(null);
    setError(null);
  };

  const handleConfirmPurchase = () => {
    if (!selected) return;
    if (balances.gram < selected.price) {
      setError("Недостаточно GRAM. Пополните баланс перед покупкой.");
      return;
    }

    const success = spendGram(selected.price);
    if (!success) {
      setError("Не удалось списать GRAM. Попробуйте снова.");
      return;
    }

    recordBurn(selected.price, {
      goldEarned: 0,
      source: "purchase",
      description: selected.name,
    });
    setNotice(`Сожжено ${numberFormatter.format(selected.price)} GRAM за «${selected.name}».`);
    handleCloseModal();
  };

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

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
              {numberFormatter.format(balances.gram)} GRAM · {goldFormatter.format(balances.gold)}{" "}
              GOLD
            </span>
          </div>
        </ScreenHeader>

        {notice && <div className="shop-notice">{notice}</div>}

        <div className="shop-grid">
          {items.map((item) => (
            <div
              key={item.id}
              className={`shop-item ${!item.available ? "shop-item--unavailable" : ""}`}
            >
              {item.badge && <div className="shop-item__badge">{item.badge}</div>}

              <div className="shop-item__icon">{item.icon}</div>

              <div className="shop-item__content">
                <h3 className="shop-item__name">{item.name}</h3>
                <p className="shop-item__description">{item.description}</p>
                <div className="shop-item__effect">{item.effect}</div>
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
                  className="shop-item__button"
                  disabled={!item.available}
                  onClick={() => handleBuyClick(item)}
                >
                  {item.available
                    ? `Сжечь ${numberFormatter.format(item.price)} GRAM`
                    : "Недоступно"}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="shop-note">
          <div className="shop-note__icon">ℹ️</div>
          <p>
            Все покупки работают через TON blockchain. После подключения смарт-контракта вы сможете
            совершать покупки напрямую из кошелька.
          </p>
        </div>

        {selected && (
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shop-purchase-title"
          >
            <div className="modal__backdrop" onClick={handleCloseModal} aria-hidden />
            <div className="modal__content">
              <h2 id="shop-purchase-title">Подтверждение покупки</h2>
              <p className="modal__item">{selected.name}</p>
              <p className="modal__details">
                Нужно сжечь {numberFormatter.format(selected.price)} GRAM
                {selected.effect ? ` для эффекта: ${selected.effect}` : ""}.
              </p>
              <p className="modal__hint">
                Баланс: {numberFormatter.format(balances.gram)} GRAM ·{" "}
                {goldFormatter.format(balances.gold)} GOLD
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
                  Сжечь {numberFormatter.format(selected.price)} GRAM
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
