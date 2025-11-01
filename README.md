# GG Mini App

Этот проект — Telegram Mini App (WebApp) с майнинг-экраном и реферальной системой.

## Реферальные ссылки по актуальной документации Telegram

Согласно последним рекомендациям Telegram Web Apps:
- Для запуска Mini App используйте параметр `startapp`: `https://t.me/<bot>?startapp=<payload>`
- Для открытия чата с ботом и передачи пейлоада — `start`: `https://t.me/<bot>?start=<payload>`
- Внутри Mini App стартовый параметр доступен в `Telegram.WebApp.initDataUnsafe.start_param`.
- Также возможен веб-фолбэк через `tgWebAppStartParam` в query-параметрах URL.

В проекте генерация и парсинг ссылок находится в `src/shared/utils/telegram.ts`.

### Формат пейлоада
- Пейлоад строится как `ref__<code>__cmp-<campaign>` (все части санитизируются и обрезаются по длине согласно лимиту 64 символа).
- Если задан только `<code>` или только `<campaign>`, формат корректно упрощается.

### Доступные ссылки
Функция `buildReferralLinks` возвращает:
- `universal` — универсальная ссылка, отдающая предпочтение Mini App (`?startapp=`)
- `webApp` — ссылка на Mini App (с `?startapp=`, и, при наличии, с short name в пути)
- `bot` — ссылка в чат бота (`?start=`)
- `native` — `tg://resolve?...&startapp=` для прямого открытия Mini App в Telegram

## Переменные окружения
Задайте их в `.env` (или через переменные окружения для Vite):

- `VITE_TG_BOT` — имя бота без `@` (например, `GGmainer_bot`).
- `VITE_TG_MINIAPP` — short name Mini App, настроенный в @BotFather (опционально).

Если `VITE_TG_MINIAPP` не задан, будет использована форма `https://t.me/<bot>?startapp=...` (рекомендуемая и совместимая).

## Локальная разработка

```bash
npm install
npm run dev
```

Сборка:

```bash
npm run build
```

Линт:

```bash
npm run lint
```
