# Рекомендации по безопасности для GG Mining

## Обнаруженные уязвимости

### 1. Клиентская логика баланса (КРИТИЧНО)
**Проблема:** Весь баланс (GRAM и GOLD) хранится и обрабатывается только на клиенте в `UserRuntimeContext`.

**Риски:**
- Пользователь может открыть консоль браузера и вызвать `addGram(1000000)` для накрутки баланса
- Можно изменить state через React DevTools
- Нет проверки на сервере при покупках или майнинге

**Решение:**
```typescript
// На сервере нужно создать эндпоинты:
// POST /api/user/mining/start - начать майнинг (проверка наличия GRAM)
// POST /api/user/mining/complete - завершить майнинг (выдача GOLD)
// POST /api/user/shop/purchase - покупка буста (списание GRAM)
// GET /api/user/balance - получить текущий баланс

// Баланс должен храниться в БД на сервере
// Каждая операция должна валидироваться через Telegram WebApp initData
```

### 2. Отсутствие аутентификации (КРИТИЧНО)
**Проблема:** Нет проверки подлинности пользователя через Telegram WebApp.

**Решение:**
```typescript
// server/telegram.js уже содержит telegramAuthMiddleware
// Нужно применить его ко всем API эндпоинтам с балансом

// Добавить в server/index.js:
app.use('/api/user/*', telegramAuthMiddleware);
app.use('/api/mining/*', telegramAuthMiddleware);
app.use('/api/shop/*', telegramAuthMiddleware);
```

### 3. Временные метки майнинга на клиенте
**Проблема:** В `MainScreen.tsx` майнинг контролируется через `requestAnimationFrame` на клиенте.

**Риски:**
- Можно изменить системное время
- Можно остановить и перезапустить для сброса прогресса
- Можно изменить duration через DevTools

**Решение:**
```typescript
// Майнинг должен начинаться на сервере с timestamp
// Клиент только отображает прогресс
// Сервер проверяет время при завершении

// POST /api/mining/start
// Response: { sessionId, startTime, endTime, gramCost }

// POST /api/mining/complete
// Body: { sessionId }
// Server checks: endTime >= currentTime
```

### 4. Dev Mode дает бесплатные GRAM
**Проблема:** В `SettingsScreen.tsx` есть кнопка добавления 1000 GRAM без проверки.

**Решение:**
```typescript
// Добавить проверку окружения
const isDevelopment = import.meta.env.DEV;
const isTestUser = profile?.id && TEST_USER_IDS.includes(profile.id);

// Показывать Dev Mode только для разработчиков
if (!isDevelopment && !isTestUser) {
  // Не показывать Dev Mode
}
```

## План внедрения защиты

### Шаг 1: Создать API для баланса
```javascript
// server/routes/user.js
import express from 'express';
import { getBalance, addBalance, spendBalance } from '../services/balance.js';

const router = express.Router();

router.get('/balance', async (req, res) => {
  const { telegramId } = req.user;
  const balance = await getBalance(telegramId);
  res.json(balance);
});

router.post('/balance/spend', async (req, res) => {
  const { telegramId } = req.user;
  const { amount, type } = req.body;
  
  // Валидация
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  
  const result = await spendBalance(telegramId, amount, type);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  
  res.json(result);
});

export default router;
```

### Шаг 2: Создать БД схему
```sql
CREATE TABLE users (
  telegram_id BIGINT PRIMARY KEY,
  gram_balance DECIMAL(20, 6) DEFAULT 0,
  gold_balance DECIMAL(20, 6) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  telegram_id BIGINT NOT NULL,
  type ENUM('mining', 'purchase', 'topup', 'withdrawal'),
  gram_amount DECIMAL(20, 6),
  gold_amount DECIMAL(20, 6),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);

CREATE TABLE mining_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  telegram_id BIGINT NOT NULL,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  gram_cost DECIMAL(20, 6) NOT NULL,
  gold_reward DECIMAL(20, 6),
  status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
  completed_at TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES users(telegram_id)
);
```

### Шаг 3: Обновить клиентскую логику
```typescript
// В UserRuntimeContext.tsx
const startMining = async () => {
  try {
    const response = await fetch('/api/mining/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getTelegramInitData()}`
      }
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const session = await response.json();
    return session;
  } catch (error) {
    console.error('Mining start failed:', error);
    throw error;
  }
};
```

### Шаг 4: Добавить rate limiting
```javascript
// server/middleware/rateLimit.js
import rateLimit from 'express-rate-limit';

export const miningLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 10, // максимум 10 запросов
  message: 'Too many mining requests, please try again later'
});

export const purchaseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: 'Too many purchase requests, please try again later'
});
```

## Приоритеты

1. **КРИТИЧНО**: Перенести баланс на сервер (Шаг 1-3)
2. **ВЫСОКИЙ**: Добавить аутентификацию Telegram для всех эндпоинтов
3. **СРЕДНИЙ**: Добавить rate limiting
4. **НИЗКИЙ**: Скрыть Dev Mode на проде

## Дополнительные меры

1. **Логирование**: Записывать все транзакции в БД для аудита
2. **Мониторинг**: Отслеживать подозрительную активность (много запросов, большие суммы)
3. **Шифрование**: Использовать HTTPS для всех запросов
4. **Валидация**: Проверять все входные данные на сервере
5. **CSRF защита**: Использовать токены для защиты от CSRF атак
