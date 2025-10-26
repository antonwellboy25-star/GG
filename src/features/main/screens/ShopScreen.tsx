import ScreenHeader from "@/features/main/components/ScreenHeader";
import { shopItems } from "@/features/main/data/shop";

export default function ShopScreen() {
  const items = shopItems;

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
            <span className="shop-balance__value">2,450 GG</span>
          </div>
        </ScreenHeader>

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
                  <span className="shop-item__price-value">{item.price.toLocaleString()}</span>
                  <span className="shop-item__price-currency">GG</span>
                </div>
                <button type="button" className="shop-item__button" disabled={!item.available}>
                  {item.available ? "Купить" : "Недоступно"}
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
      </div>
    </section>
  );
}
