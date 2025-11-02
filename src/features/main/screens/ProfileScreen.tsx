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
import { GRAM_DECIMALS, GRAM_TOPUP_ADDRESS } from "@/shared/config/ton";
import { goldFormatter, numberFormatter } from "@/shared/utils/formatters";

export default function ProfileScreen() {
  const wallet = useTonWallet();
  const walletAddress = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const { runtime, difficulty, addGram, balances } = useUserRuntime();

  const [gramInput, setGramInput] = useState("1000");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleTopUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

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

        <form className="profile-card profile-card--burn" onSubmit={handleTopUp}>
          <div className="profile-card__header">
            <h2>Пополнение баланса</h2>
            <p>
              Переведите GRAM на игровой счёт. Сжигание происходит автоматически во время майнинга.
            </p>
            <p className="profile-card__hint">
              Текущий курс:{" "}
              <strong>1 GRAM → {goldFormatter.format(difficulty.goldPerGram)} GOLD</strong>.{" "}
              Следующий пересчёт{" "}
              {difficulty.nextUpdate.toLocaleString("ru-RU", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
              .
            </p>
          </div>

          <div className="profile-card__body">
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
              />
            </div>

            <button type="submit" className="profile-submit" disabled={loading}>
              {loading ? "Отправка..." : "Пополнить баланс"}
            </button>

            {error && <p className="profile-alert profile-alert--error">{error}</p>}
            {success && <p className="profile-alert profile-alert--success">{success}</p>}
          </div>
        </form>

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
