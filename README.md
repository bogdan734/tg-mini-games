# tg-mini-games

Telegram Mini App: хаб со списком игр. Каждая игра — отдельный модуль, хаб показывает
карточки, рекорды и открывает игру по тапу.

Стек: Vite + React + TypeScript, `@twa-dev/sdk`. Хостинг — GitHub Pages (деплой через
GitHub Actions на каждый push в `main`). Бот — `bot/` на grammY, только кнопка «Играть».

## Структура

```
src/
  lib/telegram.ts     init, haptics, BackButton, имя пользователя
  lib/storage.ts      рекорды: Telegram CloudStorage → fallback localStorage
  lib/router.ts       hash-роутер: #/  и  #/game/<id>
  games/types.ts      GameMeta, GameProps
  games/registry.ts   СПИСОК ИГР — добавлять новые сюда
  games/<id>/         код игры (default export, принимает { onScore })
  games/snake-td/     Snake Defense: engine/ (логика + тесты, levels/boss), render/ (canvas, sfx)
  games/merge-td/     Merge Defense: engine/ (башни/рецепты/волны + тесты), render/ (canvas)
  screens/Hub.tsx     список игр
  screens/GameScreen.tsx  обёртка: заголовок, кнопка назад, запись рекорда
bot/index.mjs         бот: /start → кнопка Web App, menu button
.github/workflows/deploy.yml   сборка + деплой на Pages
```

## Локальная разработка

```bash
npm install
npm run dev        # http://localhost:5173 — работает и вне Telegram (мок-режим)
npm run build      # tsc + vite build → dist/
npm test           # vitest: движки игр
```

Спрайты Snake Defense пересобираются из CC0-частей Kenney (см. `ASSETS.md`):
`python3 scripts/build-sprites.py <путь к monster-builder-pack/PNG/Default>`.

В dev-сборке у Snake Defense есть хук `window.__std` (`state`, `step(sec)`, `api`) для
автотестов и проверки баланса из консоли.

## Добавить игру

1. Создать `src/games/<id>/<Name>.tsx`, default export компонент с props `{ onScore }`.
   Вызвать `onScore(score)` в конце раунда — хаб сам сохранит рекорд.
2. Добавить запись в `src/games/registry.ts` (`ready: true`).

## Бэкенд (Cloudflare Workers + D1)

`backend/` — Worker `https://tg-mini-games.ads-games.workers.dev`, база D1 `tg-mini-games`.
Авторизация — подпись `initData` Telegram (заголовок `Authorization: tma <initData>`).

| Endpoint | Что делает |
|----------|------------|
| `POST /api/me` | профиль, монеты, рефералы, ссылка-приглашение, тарифы доната |
| `POST /api/score` `{game, level, score, wave}` | сохраняет рекорд, начисляет монеты (1 за 50 очков улучшения), отдаёт место |
| `GET /api/leaderboard?game&level&scope=global\|friends` | топ-50 + моё место; друзья = кого пригласил / кто пригласил |
| `POST /api/donate` `{stars}` | ссылка на инвойс Telegram Stars |
| `GET /api/shop` | каталог (`shared/catalog.json`), что куплено/надето, монеты |
| `POST /api/shop/buy` `{item}` | покупка за монеты (ивентовые вещи не продаются) |
| `POST /api/shop/equip` `{slot, item}` | надеть свой/дефолтный скин |
| `GET /api/quests`, `POST /api/quests/claim` | 3 ежедневных задания (детерминированно по дню и user id), награда монетами |
| `GET /api/events` | активные ивенты с прогрессом; награды выдаются автоматически при выполнении |
| `POST /api/duel/create` `{level}`, `GET /api/duel?id`, `POST /api/duel/result`, `GET /api/duels` | асинхронные дуэли: общий сид, сравнение очков, +30/+10 🪙 |
| `GET /api/leaderboard?game=all` | общий рейтинг — сумма лучших результатов по всем играм и картам |
| `POST /webhook` | обновления бота: `/start`, pre-checkout, successful_payment (+10 монет за ⭐) |

```bash
cd backend
npm test                 # vitest: подпись initData, экономика
npx wrangler dev         # локально на :8787 (нужен backend/.dev.vars с BOT_TOKEN, WEBHOOK_SECRET)
npx wrangler deploy      # деплой (нужен `npx wrangler login`)
npm run db:migrate       # миграции D1 на проде
```

Секреты Worker: `BOT_TOKEN`, `WEBHOOK_SECRET` (`npx wrangler secret put ...`). Бот работает через
webhook на Worker — `bot/index.mjs` (polling) больше не нужен; если запускать его локально,
сначала снять webhook (`deleteWebhook`).

Фронт берёт адрес API из `.env.production` / `.env.development` (`VITE_API_URL`); вне Telegram API
отключён. Для QA в браузере: в dev положить подписанный `initData` в `localStorage.devInitData`.

## Задания, ивенты, дуэли

- **Задания**: шаблоны в `backend/src/quests.ts`; каждому игроку на день выпадают 3 (хэш даты и id),
  прогресс считается из статистики партии (`killed`, `merges`, `evolutions`, `wave`, `won`), значения
  клампятся (`stats.ts`). Забрать награду — кнопка в «📋 Задания».
- **Ивенты**: `shared/catalog.json → events` с условием (`win_map` / `kills`), сроком и наградами
  (монеты + эксклюзивные предметы). Прогресс в `event_progress`, выдача автоматическая.
- **Дуэли**: `⚔️` у карты в меню Snake Defense создаёт дуэль и даёт ссылку `?startapp=duel_<id>`;
  соперник открывает её, оба играют с одним сидом (`engine/rng.ts`, mulberry32). Ссылка живёт 3 дня.

## Магазин и экономика

Единая валюта 🪙. Источники: 1 за 50 очков улучшения рекорда, до 5 за партию, 20 за приглашённого
друга, 10 за ⭐ (донат), ежедневные задания (15–40), ивенты (100–150), дуэли (30 победа / 10 участие). Тратится на косметику (наборы бойцов, скины змеи) и ранний доступ к картам,
которые и так открываются прохождением. Ивентовые скины не продаются. Каталог — `shared/catalog.json`,
правила — `backend/src/shop.ts` (тесты в `backend/test/shop.test.ts`).

## Первый запуск (один раз)

### 1. GitHub

```bash
# создать ПУБЛИЧНЫЙ репозиторий tg-mini-games на https://github.com/new (без README)
git remote add origin git@github.com:bogdan734/tg-mini-games.git
git push -u origin main
```

Workflow сам включит Pages. Если нет — Settings → Pages → Source: **GitHub Actions**.
Адрес: `https://bogdan734.github.io/tg-mini-games/`

### 2. Бот в @BotFather

1. `/newbot` → имя и username → сохранить токен.
2. `/setuserpic` → загрузить `bot/avatar.png`.
3. `/mybots` → бот → Bot Settings → Menu Button → указать URL Pages.
   (То же делает `bot/index.mjs` при старте — можно пропустить.)
4. Опционально `/newapp` — «Direct Link» вида `t.me/<bot>/<app>`.

### 3. Бот

Логика бота живёт в Worker (`backend/src/index.ts`, `/webhook`). Установить webhook один раз:

```bash
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook" -H 'content-type: application/json' \
  -d '{"url":"https://tg-mini-games.ads-games.workers.dev/webhook","secret_token":"<WEBHOOK_SECRET>","allowed_updates":["message","pre_checkout_query"]}'
```

## Тест внутри Telegram с dev-сервера

Telegram открывает только https. Для локальной проверки: `npx cloudflared tunnel --url http://localhost:5173`
и подставить выданный URL в Menu Button на время теста.
