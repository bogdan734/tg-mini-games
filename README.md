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
  games/snake-td/     Snake Defense: engine/ (чистая логика + тесты), render/ (canvas)
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

### 3. Запуск бота (опционально)

```bash
cd bot
cp .env.example .env   # вписать BOT_TOKEN и WEBAPP_URL
npm start
```

Бот нужен только для `/start` с кнопкой. Mini App через Menu Button работает и без
запущенного бота.

## Тест внутри Telegram с dev-сервера

Telegram открывает только https. Для локальной проверки: `npx cloudflared tunnel --url http://localhost:5173`
и подставить выданный URL в Menu Button на время теста.
