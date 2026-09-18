# HANDOFF — tg-mini-games (актуально на 2026-09-18, вечер)

Читать первым в новом чате. Дополняет `README.md` (как запускать), `GAMES.md` (правила игр и роадмап),
`ASSETS.md` (лицензии). Память Claude: `~/.claude/projects/-Users-jabko/memory/project_tg_mini_games.md`.

## Что это
Telegram Mini App «хаб мини-игр» для бота **@ADS_gamesBoT**. Клиент: `~/Desktop/tg-mini-games`
(Vite 8 + React 19 + TS, canvas 2D), хостинг GitHub Pages `https://bogdan734.github.io/tg-mini-games/`
(деплой = push в `main`, ~1 мин). Бэкенд: Cloudflare Worker `backend/` →
`https://tg-mini-games.ads-games.workers.dev` + D1 `tg-mini-games`. Бот работает через webhook на Worker.

Игры: **Snake Defense** (`src/games/snake-td/`, референс Evo Defense: червь по кольцу, бойцы с мечами,
слияние, эволюции, 4 карты, боссы, дуэли) и **Merge Defense** (`src/games/merge-td/`, референс LUDUS:
стихии на плитках, рецепты слияния, 12 волн). Демо «Поймай точку» — заглушка, можно убрать.

Платформа: профиль по подписи `initData`, монеты 🪙 (без pay-to-win: всё за игру, Stars только
ускоряют), магазин скинов (`shared/catalog.json`), ежедневные задания, ивенты с прогрессом, рейтинг
глобальный/друзья/общий, донаты Stars, дуэли (общий сид), рефералы.

## Пользователь и его правила (важно)
- Пишет по-русски, коротко. Отвечать так же, по делу, без воды. Caveman-режим включён хуком.
- Работать автономно: не спрашивать разрешения между шагами, доводить до прода, показывать
  скриншоты как доказательство. Спрашивать только когда решение реально его.
- Требования к качеству: «дорого». Его прямая критика 18.09: «очень дёшево, дешёвая графика ударов
  и персонажей, быстро надоедает, первая игра не как в видео (где мечи)». Ответ на это — переезд
  на Tiny Swords (см. ниже). Дальше держать планку: анимированные персонажи, эффекты ударов,
  ничего «кружочками». Бесплатные паки качать можно (разрешил явно), лицензии фиксировать в `ASSETS.md`.
- Экономика: НЕТ pay-to-win. Ивентовые скины не продаются. Stars = только ускорение.
- Порядок его приоритетов был: магазин → ивенты/задания/лидерборд/PvP → вторая игра. Всё сделано.
  Дальше — по его фидбеку после игры в Telegram (он ещё не дал отзыв на новый арт).

## Арт и рендер (текущее)
- Пак **Tiny Swords, CC0-версия** («TS_old version_CC0 Licensed», Update 010) лежит в
  `public/games/assets/ts/` (troops/goblins/buildings/terrain/ui/effects/deco). Листы 192×192 кадры.
  Раскладка: Warrior 6×8 (idle, walk, attackR×2, attackD×2, attackU×2); Archer 8×7 (idle, walk,
  shootU, UR, R, DR, D); Pawn 6×6 (idle, walk, hammer×2, carry×2); Torch 7×5 (idle, walk, atkR, atkD,
  atkU); TNT 7×3 (idle, walk, throw); Wood_Tower 4 кадра 256×192; Tower/Castle одиночные.
- Общий загрузчик: `src/lib/atlas.ts` (`sheet`, `drawFrame`, `tilePattern`, 9/3-slice для UI).
- Snake Defense рендер: `src/games/snake-td/render/draw.ts`. Юниты = войска (volt→Лучник/archer,
  frost→Кузнец/pawn, blaze→Подрывник/tnt, venom→Факельщик/torch, shadow→Рыцарь/warrior). Цвет армии:
  синий → золотой (ур.3+) → пурпур (safe evo) / алый (risky). Анимации атак запускаются из
  `s.fx.shots` (у shot есть `unitId`), направление по углу к цели. Червь рисуется кодом (валуны).
- Merge Defense рендер: `src/games/merge-td/render/draw.ts`, `LOOK` — маппинг башен на войска,
  тир 2 на деревянной вышке, тир 3 на каменной башне. Враги — гоблины.
- Хаб: `src/screens/Hub.tsx`, стили в `src/index.css` (`.parchment`, `.ribbon`, `.ts-btn`).
  CSS-картинки из `public/` писать как `url('/games/assets/ts/...')` — Vite сам подставит base.
- Kenney-монстры (`scripts/build-sprites.py`) остались только для превью скинов и легаси-иконок.

## Как проверять (обязательно перед пушем)
1. `npx tsc -b` и `npm test` (59 тестов фронта), в `backend/` — `npm test` (25) и `npx tsc -p .`.
2. Dev-сервер: `preview_start {name:"tg-mini-games"}` (конфиг в `~/.claude/launch.json`, порт 5173).
   Dev смотрит на прод-Worker (`.env.development`), CORS для localhost разрешён.
3. В браузере панель бывает скрыта → rAF не тикает и скриншоты таймаутят. Тогда `tabs_select` и
   гонять симуляцию через dev-хуки: `window.__std` (snake) и `window.__mtd` (merge):
   `.state`, `.step(sec)`, `.api.{startWave, buyAndPlace/openChoice+pickChoice, moveOrMerge, reset…}`.
   Скриншоты отстают на ~0.3 с от состояния — делать `wait` перед снимком.
4. Баланс мерить авто-игроком (скрипты были в чате; суть: жадные покупки у дороги + мерж всего что
   можно). Норма: идеальный бот выигрывает карту ≥ 4/6, теряя жизни с 7-й волны (snake) / с 5-й (merge).
5. Профиль/магазин/задания в браузере: подписанный `initData` в `localStorage.devInitData`
   (генерить node-скриптом HMAC как в `backend/src/auth.ts`, токен в `bot/.env`). Тестовых юзеров
   (id 7770000xx) после проверки удалять из D1: `npx wrangler d1 execute tg-mini-games --remote --command "DELETE ..."`.
6. После `wrangler deploy` старая версия отвечает ещё ~20 с — smoke-тесты с задержкой.
7. После push ждать run в Actions (`curl api.github.com/.../actions/runs?per_page=1`, кавычить URL
   из-за `?`) и проверять, что новый бандл/ассет отдаётся.

## Известные грабли
- Vite 8/rolldown: нативный биндинг `@rolldown/binding-darwin-arm64` в `optionalDependencies`,
  иначе `npm run build` падает (npm-баг с optional deps).
- `@twa-dev/sdk`: `isVersionAtLeast` в рантайме нет — своя `versionAtLeast` в `src/lib/telegram.ts`.
- Скриншот через `zoom` с region не поддержан; HMR сбрасывает состояние игры (после правок — reload).
- `gh` и `brew` на Маке нет; git по SSH работает; wrangler залогинен OAuth (аккаунт lolipokpyk@gmail.com).
- itch-скачивание бесплатных паков: POST `/download_url` (csrf) → страница → POST
  `/file/<id>?source=game_download` с cookie; ключ живёт ~60 с, делать одной командой.
- Telegram: fullscreen (API 8.0) включён; safe-area через CSS-переменные `--tg-*`.

## Что дальше (кандидаты, спросить/выбрать по фидбеку)
- Полировка «дорого»: разлёт камней при гибели сегмента, вспышка+фанфары на эволюции, экран старта
  игры с баннером, музыка/звуки из свободных паков, анимация покупки/слияния (появление из дыма).
- Проверить в Telegram, что профиль грузится (карточка теперь показывает ошибку и «↻» — если у
  пользователя ошибка, смотреть логи Worker `npx wrangler tail`).
- Merge Defense: выбор стихии-бонуса между волнами (как в референсе), дуэли, вторая карта.
- Убрать демо «Поймай точку» из хаба или переделать в «Овцы» на арте пака.
- Аналитика: кто сколько играет — таблица в D1 + простой отчёт.
