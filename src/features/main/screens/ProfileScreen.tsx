import type { SendTransactionRequest } from "@tonconnect/sdk";
import {
  TonConnectButton,
  useTonAddress,
  useTonConnectUI,
  useTonWallet,
} from "@tonconnect/ui-react";
import { useState } from "react";
import ScreenHeader from "@/features/main/components/ScreenHeader";
import { useUserRuntime } from "@/features/user/UserRuntimeContext";
import { useTelegramStarsPurchase } from "@/shared/hooks";
import { GRAM_DECIMALS, GRAM_TOPUP_ADDRESS } from "@/shared/config";
import { goldFormatter, numberFormatter } from "@/shared/utils/formatters";
import { confirmStarsTopUpInvoice, createStarsTopUpInvoice } from "@/shared/utils/payments";

export default function ProfileScreen() {
  const wallet = useTonWallet();
  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const { runtime, addGram, balances } = useUserRuntime();
  const {
    supportsStars,
    reason: starsRestrictionReason,
    starsBalance,
    openInvoice: openStarsInvoice,
  } = useTelegramStarsPurchase();

  const [paymentMethod, setPaymentMethod] = useState<"ton" | "stars">("ton");
  const [gramInput, setGramInput] = useState("1000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleTopUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (paymentMethod === "ton") {
      await handleTonTopUp();
    } else {
      await handleStarsTopUp();
    }
  };

  const handleTonTopUp = async () => {
    if (!wallet) {
      setError("Подключите кошелёк Ton Connect перед операцией");
      return;
    }

    const normalized = Number(gramInput.replace(",", "."));
    if (!Number.isFinite(normalized) || normalized <= 0) {
      setError("Введите корректную сумму GRAM");
      return;
    }

    if (!Number.isInteger(normalized)) {
      setError("Укажите целое количество GRAM");
      return;
    }

    const decimalsMultiplier = 10 ** GRAM_DECIMALS;
    const nanotons = BigInt(normalized) * BigInt(decimalsMultiplier);

    const transaction: SendTransactionRequest = {
      validUntil: Math.floor(Date.now() / 1000) + 600,
      messages: [
        {
          address: GRAM_TOPUP_ADDRESS,
          amount: nanotons.toString(),
        },
      ],
    } as const;

    try {
      setLoading(true);
      await tonConnectUI.sendTransaction(transaction);
      addGram(normalized);
      setSuccess(`Баланс пополнен на ${numberFormatter.format(normalized)} GRAM.`);
      setGramInput("1000");
    } catch (burnError) {
      if (burnError instanceof Error) {
        setError(burnError.message);
      } else {
        setError("Не удалось отправить транзакцию");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStarsTopUp = async () => {
    const normalized = Number(gramInput.replace(",", "."));
    if (!Number.isFinite(normalized) || normalized <= 0) {
      setError("Введите корректную сумму GRAM");
      return;
    }

    if (!Number.isInteger(normalized)) {
      setError("Укажите целое количество GRAM");
      return;
    }

    if (!supportsStars) {
      setError(starsRestrictionReason ?? "Telegram Stars недоступны в этом окружении.");
      return;
    }

    try {
      setLoading(true);
      const invoice = await createStarsTopUpInvoice(normalized);
      const result = await openStarsInvoice(invoice.invoice);

      if (result.status !== "paid") {
        const message =
          result.status === "failed"
            ? "Telegram не подтвердил оплату. Повторите попытку."
            : "Платёж отменён.";
        setError(message);
        return;
      }

      try {
        await confirmStarsTopUpInvoice(invoice.invoiceId, {
          status: result.status,
          telegramPaymentChargeId: result.telegramPaymentChargeId,
          providerPaymentChargeId: result.providerPaymentChargeId,
          invoiceSlug: result.slug,
        });
      } catch (confirmError) {
        console.warn("Failed to confirm Stars top-up", confirmError);
      }

      addGram(invoice.grams);
      setSuccess(
        `Начислено ${numberFormatter.format(invoice.grams)} GRAM. Списано ${numberFormatter.format(invoice.stars)} ⭐️.`,
      );
      setGramInput(String(invoice.grams));
    } catch (starsTopUpError) {
      if (starsTopUpError instanceof Error) {
        setError(starsTopUpError.message);
      } else {
        setError("Не удалось создать счёт для оплаты звёздами.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="screen profile" aria-label="Профиль">
      <div className="profile-container screen-stack">
        <ScreenHeader title="Профиль" subtitle="Управление аккаунтом и кошельком" />

        <div className="profile-card profile-card--wallet">
          <div className="profile-card__header">
            <h2>Подключение кошелька</h2>
            <TonConnectButton className="profile-ton-button" />
          </div>
          <div className="profile-card__body">
            {wallet ? (
              <div className="profile-wallet-info">
                <span className="profile-wallet-info__label">Подключённый адрес:</span>
                <span className="profile-wallet-info__value">{walletAddress}</span>
              </div>
            ) : (
              <p className="profile-wallet-placeholder">
                Подключите кошелёк Ton Connect, чтобы пополнять GRAM и получать GOLD.
              </p>
            )}
            <div className="profile-balance">
              <div className="profile-balance__item">
                <span className="profile-balance__label">GRAM</span>
                <span className="profile-balance__value">
                  {numberFormatter.format(balances.gram)}
                </span>
              </div>
              <div className="profile-balance__divider" aria-hidden />
              <div className="profile-balance__item">
                <span className="profile-balance__label">GOLD</span>
                <span className="profile-balance__value">
                  {goldFormatter.format(balances.gold)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <form className="profile-card" onSubmit={handleTopUp}>
          <div className="profile-card__header">
            <h2>Пополнение баланса</h2>
            <p>Пополните GRAM через TON Connect или купите GRAM за звёзды Telegram.</p>
          </div>

          <div className="profile-card__body">
            <div className="profile-payment-methods">
              <button
                type="button"
                className={`profile-payment-method ${paymentMethod === "ton" ? "profile-payment-method--active" : ""}`}
                onClick={() => setPaymentMethod("ton")}
              >
                TON Connect
              </button>
              <button
                type="button"
                className={`profile-payment-method ${paymentMethod === "stars" ? "profile-payment-method--active" : ""}`}
                onClick={() => setPaymentMethod("stars")}
                disabled={!supportsStars}
              >
                Telegram Stars
                {starsBalance != null &&
                  supportsStars &&
                  ` (${numberFormatter.format(starsBalance)} ⭐️)`}
              </button>
            </div>

            <label className="profile-input-label" htmlFor="gramAmount">
              Сумма GRAM
            </label>
            <div className="profile-input-group">
              <input
                id="gramAmount"
                name="gramAmount"
                type="number"
                min={1}
                step={1}
                value={gramInput}
                onChange={(event) => setGramInput(event.target.value)}
                className="profile-input"
                placeholder="1000"
                required
                disabled={loading}
              />
              {paymentMethod === "stars" && supportsStars && (
                <span className="profile-preview">
                  Оплата пройдёт внутри Telegram, сумма в звёздах покажется перед подтверждением.
                </span>
              )}
              {paymentMethod === "stars" && !supportsStars && (
                <span className="profile-preview">
                  {starsRestrictionReason ?? "Telegram Stars недоступны."}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="profile-submit"
              disabled={
                loading ||
                (paymentMethod === "ton" && !wallet) ||
                (paymentMethod === "stars" && !supportsStars)
              }
            >
              {loading
                ? paymentMethod === "stars"
                  ? "Ожидание оплаты…"
                  : "Отправка..."
                : paymentMethod === "stars"
                  ? "Оплатить звёздами"
                  : "Пополнить через TON"}
            </button>

            {error && <p className="profile-alert profile-alert--error">{error}</p>}
            {success && <p className="profile-alert profile-alert--success">{success}</p>}
          </div>
        </form>

        <div className="profile-card">
          <div className="profile-card__header">
            <h2>Вывод средств</h2>
            <p>Выведите заработанные средства на ваш кошелёк</p>
          </div>

          <div className="profile-card__body">
            <div className="profile-withdrawal">
              <div className="profile-withdrawal-option">
                <div className="profile-withdrawal-option__header">
                  <h3>💎 GRAM</h3>
                  <p>Доступно: {numberFormatter.format(balances.gram)}</p>
                </div>
                <button
                  type="button"
                  className="profile-withdrawal-button"
                  disabled={!wallet || balances.gram <= 0}
                >
                  Вывести GRAM
                </button>
              </div>

              <div className="profile-withdrawal-option profile-withdrawal-option--soon">
                <div className="profile-withdrawal-option__header">
                  <h3>⭐ GG (GOLD)</h3>
                  <p>Доступно: {goldFormatter.format(balances.gold)}</p>
                </div>
                <div className="profile-withdrawal-soon">
                  <span className="profile-withdrawal-soon__badge">Soon</span>
                  <p className="profile-withdrawal-soon__text">Вывод GG будет доступен позже</p>
                </div>
              </div>
            </div>

            {!wallet && (
              <p className="profile-alert profile-alert--info">
                Подключите кошелёк TON для вывода средств
              </p>
            )}
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-card__header">
            <h2>История обмена</h2>
          </div>
          <div className="profile-card__body">
            {runtime.history.length === 0 ? (
              <p className="profile-history-empty">История появится после майнинга или покупок.</p>
            ) : (
              <ul className="profile-history-list">
                {runtime.history.map((record) => (
                  <li key={record.id} className="profile-history-item">
                    <div className="profile-history-item__badge">
                      {record.source === "mining" ? "⛏️" : "🛒"}
                    </div>
                    <div className="profile-history-item__body">
                      <span className="profile-history-item__amount">
                        {record.gold > 0 ? `+${goldFormatter.format(record.gold)} GOLD` : "—"}
                      </span>
                      <span className="profile-history-item__subtitle">
                        {numberFormatter.format(record.gram)} GRAM ·{" "}
                        {record.source === "mining"
                          ? "Майнинг"
                          : `Покупка${record.description ? `: ${record.description}` : ""}`}
                      </span>
                    </div>
                    <time dateTime={record.date}>
                      {new Date(record.date).toLocaleString("ru-RU", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
