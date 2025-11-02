# Реферальная система — Backend API

Backend для реферальной программы реализован как Express‑сервер (см. `server/`).
Он использует SQLite (через `better-sqlite3`) для хранения реферальных кодов,
связей и накопленных бонусов.

Запуск сервера:

```bash
npm run server
```

Перед запуском скопируйте `.env.example` в `.env` и заполните значения.

```bash
cp .env.example .env
```

## Настройки окружения

| Переменная | Описание |
| --- | --- |
| `PORT` | Порт HTTP API (по умолчанию 3000) |
| `CORS_ORIGIN` | Разрешённые Origin (через запятую, `*` — разрешить все) |
| `TELEGRAM_BOT_TOKEN` | Токен бота для проверки `initData` (обязательно в production) |
| `TELEGRAM_BOT_USERNAME` | Юзернейм бота без `@` |
| `TELEGRAM_MINIAPP_SHORT_NAME` | Short name Mini App (опционально) |
| `REFERRAL_DB_PATH` | Путь до файла SQLite (создаётся автоматически) |
| `ALLOW_UNSAFE_TELEGRAM` | В dev режиме разрешает заглушки `X-Debug-Telegram-User` |

## Заголовок аутентификации

Все защищённые эндпоинты ожидают заголовок:

```
X-Telegram-Init-Data: <initData>
```

В dev режиме (если `ALLOW_UNSAFE_TELEGRAM=true` и нет initData) можно передать
заглушку:

```
X-Debug-Telegram-User: {"id":123,"username":"dev"}
```

## Маршруты API

### `POST /api/referrals/generate`

Возвращает (или создаёт) реферальный код текущего пользователя.
Опционально принимает `campaign` в теле запроса.

Ответ:

```json
{
  "referralCode": "a7f3k9m2p4x8",
  "links": {
    "payload": "ref__a7f3k9m2p4x8",
    "universal": "https://t.me/GGmainer_bot?startapp=ref__a7f3k9m2p4x8",
    "webApp": "https://t.me/GGmainer_bot?startapp=ref__a7f3k9m2p4x8",
    "bot": "https://t.me/GGmainer_bot?start=ref__a7f3k9m2p4x8",
    "native": "tg://resolve?domain=GGmainer_bot&startapp=ref__a7f3k9m2p4x8"
  },
  "createdAt": "2025-11-02T09:30:00.000Z"
}
```

### `POST /api/referrals/validate`

Подтверждает старт нового пользователя по реферальному `startParam`.

Тело запроса:

```json
{
  "startParam": "ref__a7f3k9m2p4x8"
}
```

Ответы:

- `201 Created` — связь создана, возвращает `referrerId`, `referralCode`, `campaign`.
- `200 OK` c `valid:false, reason:"already_referred"` — пользователь уже привязан.
- `400 Bad Request` — некорректный payload или попытка самореферала.
- `404 Not Found` — код не существует.

### `GET /api/referrals/stats`

Возвращает агрегированную статистику для авторизованного пользователя:

```json
{
  "totalReferrals": 3,
  "activeReferrals": 1,
  "totalEarned": 250,
  "referrals": [
    {
      "userId": "654321",
      "username": "alice",
      "firstName": "Alice",
      "lastName": null,
      "campaign": null,
      "joinedAt": "2025-11-01T12:00:00Z",
      "totalEarned": 150,
      "lastBonusAt": "2025-11-02T08:00:00Z",
      "lastActivityAt": "2025-11-02T08:00:00Z"
    }
  ]
}
```

`activeReferrals` рассчитывается как количество связей с начисленными бонусами (`total_earned > 0`).

### `POST /api/referrals/reward`

Начисляет бонус рефереру, когда приглашённый пользователь завершает майнинг.

Тело:

```json
{
  "goldEarned": 120
}
```

Ответ:

```json
{
  "awarded": true,
  "bonus": 12,
  "referrerId": "123456789"
}
```

Если пользователь не имеет реферера, возвращает `{ "awarded": false, "bonus": 0 }`.

> **Примечание:** бонус округляется вниз до целого (`Math.floor`), что соответствует правилу «10% GOLD».

## Структура базы данных

Создаётся автоматически при старте сервера (`data/referrals.db`).

```sql
CREATE TABLE IF NOT EXISTS referral_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS referral_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  referrer_id TEXT NOT NULL,
  referred_user_id TEXT NOT NULL UNIQUE,
  campaign TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_earned INTEGER NOT NULL DEFAULT 0,
  last_bonus_at TEXT,
  last_activity_at TEXT,
  referred_username TEXT,
  referred_first_name TEXT,
  referred_last_name TEXT
);
```

## Использование на фронтенде

- В `src/shared/utils/telegram.ts` пока остаётся клиентская генерация кода (base64url).
  При появлении backend интеграции замените её на вызов `/api/referrals/generate`.
- Хуки/экраны могут использовать fetch (или react-query) для получения
  `referralCode`, `links` и статистики.
- Для начисления бонуса после майнинга отправляйте POST `/api/referrals/reward`
  с количеством заработанного GOLD.

## Безопасность

- В production обязательно задайте `TELEGRAM_BOT_TOKEN`, чтобы верифицировать
  `X-Telegram-Init-Data` согласно документации Telegram Web Apps.
- Самореферал запрещён (`referrer_id == referred_user_id`).
- Один пользователь может быть приглашён только один раз (`UNIQUE` на `referred_user_id`).
- Коды генерируются случайно (base64url, 16 символов) и не раскрывают Telegram ID.
- Все даты хранятся в формате ISO (UTC) внутри SQLite.

## Тестирование

1. Скопируйте `.env.example` → `.env` и задайте `ALLOW_UNSAFE_TELEGRAM=true`.
2. Запустите сервер `npm run server`.
3. Отправьте запросы с заголовком `X-Debug-Telegram-User` через Postman/HTTPie.
4. Проверьте файл БД (`sqlite3 data/referrals.db`).
5. Запустите интеграционные тесты майнинга, подтверждая начисление бонусов.
