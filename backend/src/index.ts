import { validateInitData, type TgUser } from './auth'
import { COINS_PER_STAR, coinsForScore, DONATION_TIERS } from './economy'
import { DUEL_TTL_MS, duelRewards, duelWinner, newDuelId, newSeed, type DuelRow } from './duels'
import { activeEvents, eventDelta, EVENTS as EVENT_DEFS } from './events'
import { applyQuest, dailyQuests, dayKey } from './quests'
import { canBuy, canEquip, coinsForRun, defaultFor, ITEMS, itemById } from './shop'
import { clampStats } from './stats'
import { BotApi, type Update } from './telegram'

export interface Env {
  DB: D1Database
  BOT_TOKEN: string
  WEBHOOK_SECRET: string
  WEBAPP_URL: string
  BOT_USERNAME: string
  ALLOWED_ORIGINS: string
}

const GAMES = new Set(['snake-td', 'merge-td', 'catch-dot'])
const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...headers } })

function corsHeaders(env: Env, req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
  const ok = allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin)
  return {
    'access-control-allow-origin': ok ? origin : allowed[0],
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'origin',
  }
}

interface UserRow { id: number; name: string; username: string | null; photo: string | null; coins: number; stars_total: number; referrer_id: number | null; created_at: number }

async function upsertUser(env: Env, u: TgUser, startParam: string | undefined, now: number): Promise<UserRow> {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').slice(0, 64)
  const existing = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(u.id).first<UserRow>()
  if (existing) {
    await env.DB.prepare('UPDATE users SET name = ?, username = ?, photo = ?, last_seen = ? WHERE id = ?')
      .bind(name, u.username ?? null, u.photo_url ?? null, now, u.id).run()
    return { ...existing, name, username: u.username ?? null, photo: u.photo_url ?? null }
  }
  // referral: start_param "ref_<id>" from the bot deep link
  const m = startParam?.match(/^ref_(\d+)$/)
  const referrer = m && Number(m[1]) !== u.id ? Number(m[1]) : null
  await env.DB.prepare('INSERT INTO users (id, name, username, photo, coins, referrer_id, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(u.id, name, u.username ?? null, u.photo_url ?? null, 0, referrer, now, now).run()
  if (referrer) {
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET coins = coins + 20 WHERE id = ?').bind(referrer),
      env.DB.prepare('INSERT INTO coin_log (user_id, delta, reason, created_at) VALUES (?, 20, ?, ?)').bind(referrer, `ref:${u.id}`, now),
    ])
  }
  return { id: u.id, name, username: u.username ?? null, photo: u.photo_url ?? null, coins: 0, stars_total: 0, referrer_id: referrer, created_at: now }
}

async function authed(env: Env, req: Request): Promise<{ user: UserRow; tg: TgUser; startParam?: string } | Response> {
  const h = req.headers.get('authorization') ?? ''
  if (!h.startsWith('tma ')) return json({ error: 'unauthorized' }, 401)
  const data = await validateInitData(h.slice(4), env.BOT_TOKEN)
  if (!data) return json({ error: 'bad initData' }, 401)
  const user = await upsertUser(env, data.user, data.start_param, Date.now())
  return { user, tg: data.user, startParam: data.start_param }
}

async function ownedItems(env: Env, userId: number): Promise<Set<string>> {
  const rows = await env.DB.prepare('SELECT item_id FROM inventory WHERE user_id = ?').bind(userId).all<{ item_id: string }>()
  return new Set(rows.results.map((r) => r.item_id))
}

async function equippedItems(env: Env, userId: number): Promise<Record<string, string>> {
  const rows = await env.DB.prepare('SELECT slot, item_id FROM equipped WHERE user_id = ?').bind(userId).all<{ slot: string; item_id: string }>()
  const out: Record<string, string> = { units: defaultFor('units'), snake: defaultFor('snake') }
  for (const r of rows.results) out[r.slot] = r.item_id
  return out
}

const publicUser = (u: UserRow) => ({ id: u.id, name: u.name, username: u.username, photo: u.photo, coins: u.coins, starsTotal: u.stars_total })

async function leaderboard(env: Env, userId: number, game: string, level: number, scope: 'global' | 'friends') {
  // friends = me + people I invited + the person who invited me
  const friendsFilter = scope === 'friends'
    ? 'AND (u.id = ? OR u.referrer_id = ? OR u.id = (SELECT referrer_id FROM users WHERE id = ?))'
    : ''
  const friendsBind = scope === 'friends' ? [userId, userId, userId] : []
  const all = game === 'all'
  const where = all ? '' : 'AND s.game = ? AND s.level = ?'
  const whereBind = all ? [] : [game, level]
  type Row = { id: number; name: string; username: string | null; photo: string | null; score: number; wave: number }
  const rows = await env.DB.prepare(
    `SELECT u.id AS id, u.name, u.username, u.photo, SUM(s.score) AS score, MAX(s.wave) AS wave
     FROM scores s JOIN users u ON u.id = s.user_id
     WHERE 1 = 1 ${where} ${friendsFilter}
     GROUP BY u.id ORDER BY score DESC, MIN(s.updated_at) ASC LIMIT 50`,
  ).bind(...whereBind, ...friendsBind).all<Row>()
  const mine = await env.DB.prepare(`SELECT SUM(score) AS score FROM scores s WHERE s.user_id = ? ${where}`).bind(userId, ...whereBind).first<{ score: number | null }>()
  let rank: number | null = null
  if (mine?.score) {
    const above = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT u.id, SUM(s.score) AS total FROM scores s JOIN users u ON u.id = s.user_id
         WHERE 1 = 1 ${where} ${friendsFilter} GROUP BY u.id HAVING total > ?)`,
    ).bind(...whereBind, ...friendsBind, mine.score).first<{ n: number }>()
    rank = (above?.n ?? 0) + 1
  }
  return { entries: rows.results.map((r, i) => ({ ...r, rank: i + 1, me: r.id === userId })), me: { score: mine?.score ?? 0, rank } }
}

async function addCoins(env: Env, userId: number, delta: number, reason: string, now: number): Promise<void> {
  if (delta <= 0) return
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(delta, userId),
    env.DB.prepare('INSERT INTO coin_log (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)').bind(userId, delta, reason, now),
  ])
}

/** Move today's quests and active events forward for a finished run. Returns what got completed. */
async function progressRun(env: Env, userId: number, level: number, stats: ReturnType<typeof clampStats>, now: number) {
  const day = dayKey(now)
  const quests = dailyQuests(userId, day)
  const qRows = await env.DB.prepare('SELECT quest_id, progress FROM quest_progress WHERE user_id = ? AND day = ?').bind(userId, day).all<{ quest_id: string; progress: number }>()
  const qMap = new Map(qRows.results.map((r) => [r.quest_id, r.progress]))
  const questsCompleted: string[] = []
  const stmts: D1PreparedStatement[] = []
  for (const q of quests) {
    const before = qMap.get(q.id) ?? 0
    const after = applyQuest(q, before, stats)
    if (after === before) continue
    if (after >= q.target) questsCompleted.push(q.id)
    stmts.push(env.DB.prepare('INSERT INTO quest_progress (user_id, day, quest_id, progress) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, day, quest_id) DO UPDATE SET progress = excluded.progress').bind(userId, day, q.id, after))
  }
  const eRows = await env.DB.prepare('SELECT event_id, progress, claimed FROM event_progress WHERE user_id = ?').bind(userId).all<{ event_id: string; progress: number; claimed: number }>()
  const eMap = new Map(eRows.results.map((r) => [r.event_id, r]))
  const eventsCompleted: string[] = []
  const granted: string[] = []
  let coins = 0
  for (const [id, ev] of activeEvents(now)) {
    const cur = eMap.get(id)
    if (cur?.claimed) continue
    const delta = eventDelta(ev, stats, level)
    if (delta <= 0) continue
    const after = Math.min(ev.target, (cur?.progress ?? 0) + delta)
    const done = after >= ev.target
    stmts.push(env.DB.prepare('INSERT INTO event_progress (user_id, event_id, progress, claimed) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, event_id) DO UPDATE SET progress = excluded.progress, claimed = excluded.claimed').bind(userId, id, after, done ? 1 : 0))
    if (done) {
      eventsCompleted.push(id)
      coins += ev.rewards.coins
      for (const item of ev.rewards.items) {
        granted.push(item)
        stmts.push(env.DB.prepare('INSERT OR IGNORE INTO inventory (user_id, item_id, source, acquired_at) VALUES (?, ?, ?, ?)').bind(userId, item, `event:${id}`, now))
      }
    }
  }
  if (stmts.length) await env.DB.batch(stmts)
  return { questsCompleted, eventsCompleted, granted, coins }
}

const shortUser = (r: { id: number; name: string; photo: string | null } | null) => (r ? { id: r.id, name: r.name, photo: r.photo } : null)

async function duelView(env: Env, d: DuelRow, me: number) {
  const [c, o] = await Promise.all([
    env.DB.prepare('SELECT id, name, photo FROM users WHERE id = ?').bind(d.creator_id).first<{ id: number; name: string; photo: string | null }>(),
    d.opponent_id ? env.DB.prepare('SELECT id, name, photo FROM users WHERE id = ?').bind(d.opponent_id).first<{ id: number; name: string; photo: string | null }>() : Promise.resolve(null),
  ])
  return {
    id: d.id, level: d.level, seed: d.seed, status: d.status, expiresAt: d.expires_at,
    me: d.creator_id === me ? 'creator' : d.opponent_id === me ? 'opponent' : null,
    creator: { ...shortUser(c ?? null), score: d.creator_score, wave: d.creator_wave },
    opponent: o ? { ...shortUser(o), score: d.opponent_score, wave: d.opponent_wave } : null,
    winner: duelWinner(d),
  }
}

async function handleApi(env: Env, req: Request, url: URL): Promise<Response> {
  const a = await authed(env, req)
  if (a instanceof Response) return a
  const { user, tg } = a
  const path = url.pathname.replace(/^\/api/, '')

  if (path === '/me') {
    const scores = await env.DB.prepare('SELECT game, level, score, wave FROM scores WHERE user_id = ?').bind(user.id).all()
    const referrals = await env.DB.prepare('SELECT COUNT(*) AS n FROM users WHERE referrer_id = ?').bind(user.id).first<{ n: number }>()
    const [owned, equipped] = await Promise.all([ownedItems(env, user.id), equippedItems(env, user.id)])
    return json({
      user: publicUser(user), scores: scores.results, referrals: referrals?.n ?? 0,
      inviteLink: `https://t.me/${env.BOT_USERNAME}?startapp=ref_${user.id}`, donationTiers: DONATION_TIERS,
      owned: [...owned], equipped,
    })
  }

  if (path === '/score' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { game?: string; level?: number; score?: number; wave?: number; won?: boolean; killed?: number; merges?: number; evolutions?: number } | null
    if (!body || !GAMES.has(body.game ?? '') || !Number.isInteger(body.level) || !Number.isInteger(body.score) || (body.score ?? 0) < 0 || (body.score ?? 0) > 1e7) {
      return json({ error: 'bad score' }, 400)
    }
    const { game, level, score } = body as { game: string; level: number; score: number }
    const wave = Number.isInteger(body.wave) ? (body.wave as number) : 0
    const now = Date.now()
    const prev = await env.DB.prepare('SELECT score FROM scores WHERE user_id = ? AND game = ? AND level = ?').bind(user.id, game, level).first<{ score: number }>()
    const prevBest = prev?.score ?? 0
    const stats = clampStats({ ...body, wave })
    const progress = await progressRun(env, user.id, level, stats, now)
    const coins = coinsForScore(prevBest, score) + coinsForRun(wave) + progress.coins
    const stmts: D1PreparedStatement[] = []
    const granted = progress.granted
    if (score > prevBest) {
      stmts.push(env.DB.prepare(
        'INSERT INTO scores (user_id, game, level, score, wave, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, game, level) DO UPDATE SET score = excluded.score, wave = excluded.wave, updated_at = excluded.updated_at',
      ).bind(user.id, game, level, score, wave, now))
    }
    if (coins > 0) {
      stmts.push(env.DB.prepare('UPDATE users SET coins = coins + ? WHERE id = ?').bind(coins, user.id))
      stmts.push(env.DB.prepare('INSERT INTO coin_log (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)').bind(user.id, coins, `score:${game}:${level}`, now))
    }
    if (stmts.length) await env.DB.batch(stmts)
    const board = await leaderboard(env, user.id, game, level, 'global')
    return json({
      best: Math.max(prevBest, score), improved: score > prevBest, coinsEarned: coins, coins: user.coins + coins, rank: board.me.rank, granted,
      questsCompleted: progress.questsCompleted, eventsCompleted: progress.eventsCompleted,
    })
  }

  if (path === '/leaderboard') {
    const game = url.searchParams.get('game') ?? ''
    const level = Number(url.searchParams.get('level') ?? 0)
    const scope = url.searchParams.get('scope') === 'friends' ? 'friends' : 'global'
    if ((game !== 'all' && !GAMES.has(game)) || !Number.isInteger(level)) return json({ error: 'bad params' }, 400)
    return json(await leaderboard(env, user.id, game, level, scope))
  }

  if (path === '/quests') {
    const now = Date.now(), day = dayKey(now)
    const rows = await env.DB.prepare('SELECT quest_id, progress, claimed FROM quest_progress WHERE user_id = ? AND day = ?').bind(user.id, day).all<{ quest_id: string; progress: number; claimed: number }>()
    const m = new Map(rows.results.map((r) => [r.quest_id, r]))
    return json({ day, quests: dailyQuests(user.id, day).map((q) => ({ ...q, progress: m.get(q.id)?.progress ?? 0, claimed: Boolean(m.get(q.id)?.claimed) })) })
  }

  if (path === '/quests/claim' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { id?: string } | null
    const now = Date.now(), day = dayKey(now)
    const q = dailyQuests(user.id, day).find((x) => x.id === body?.id)
    if (!q) return json({ error: 'not today' }, 400)
    const upd = await env.DB.prepare('UPDATE quest_progress SET claimed = 1 WHERE user_id = ? AND day = ? AND quest_id = ? AND claimed = 0 AND progress >= ?').bind(user.id, day, q.id, q.target).run()
    if (!upd.meta.changes) return json({ error: 'not done' }, 400)
    await addCoins(env, user.id, q.reward, `quest:${q.id}`, now)
    return json({ ok: true, coins: user.coins + q.reward, reward: q.reward })
  }

  if (path === '/events') {
    const now = Date.now()
    const rows = await env.DB.prepare('SELECT event_id, progress, claimed FROM event_progress WHERE user_id = ?').bind(user.id).all<{ event_id: string; progress: number; claimed: number }>()
    const m = new Map(rows.results.map((r) => [r.event_id, r]))
    return json({
      events: activeEvents(now).map(([id, ev]) => ({ id, title: ev.title, desc: ev.desc, until: ev.until, target: ev.target, rewards: ev.rewards, progress: m.get(id)?.progress ?? 0, done: Boolean(m.get(id)?.claimed) })),
      all: Object.entries(EVENT_DEFS).map(([id, ev]) => ({ id, title: ev.title, until: ev.until })),
    })
  }

  if (path === '/duel/create' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { level?: number } | null
    const level = Number(body?.level)
    if (![1, 2, 3, 4].includes(level)) return json({ error: 'bad level' }, 400)
    const now = Date.now()
    const d: DuelRow = { id: newDuelId(), level, seed: newSeed(), creator_id: user.id, opponent_id: null, creator_score: null, creator_wave: null, opponent_score: null, opponent_wave: null, status: 'open', created_at: now, expires_at: now + DUEL_TTL_MS }
    await env.DB.prepare('INSERT INTO duels (id, level, seed, creator_id, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(d.id, d.level, d.seed, d.creator_id, d.status, d.created_at, d.expires_at).run()
    return json({ duel: await duelView(env, d, user.id), link: `https://t.me/${env.BOT_USERNAME}?startapp=duel_${d.id}` })
  }

  if (path === '/duel') {
    const id = url.searchParams.get('id') ?? ''
    const d = await env.DB.prepare('SELECT * FROM duels WHERE id = ?').bind(id).first<DuelRow>()
    if (!d) return json({ error: 'not found' }, 404)
    if (d.status === 'open' && d.opponent_id === null && d.creator_id !== user.id && Date.now() < d.expires_at) {
      await env.DB.prepare('UPDATE duels SET opponent_id = ? WHERE id = ? AND opponent_id IS NULL').bind(user.id, id).run()
      d.opponent_id = user.id
    }
    return json({ duel: await duelView(env, d, user.id) })
  }

  if (path === '/duel/result' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { id?: string; score?: number; wave?: number } | null
    const id = body?.id ?? '', score = Number(body?.score), wave = Number(body?.wave ?? 0)
    if (!Number.isInteger(score) || score < 0 || score > 1e7) return json({ error: 'bad score' }, 400)
    const d = await env.DB.prepare('SELECT * FROM duels WHERE id = ?').bind(id).first<DuelRow>()
    if (!d) return json({ error: 'not found' }, 404)
    const side = d.creator_id === user.id ? 'creator' : d.opponent_id === user.id ? 'opponent' : null
    if (!side || d.status !== 'open') return json({ error: 'not yours' }, 400)
    if ((side === 'creator' ? d.creator_score : d.opponent_score) !== null) return json({ error: 'already played' }, 400)
    const col = side === 'creator' ? 'creator' : 'opponent'
    await env.DB.prepare(`UPDATE duels SET ${col}_score = ?, ${col}_wave = ? WHERE id = ?`).bind(score, wave, id).run()
    if (side === 'creator') { d.creator_score = score; d.creator_wave = wave } else { d.opponent_score = score; d.opponent_wave = wave }
    const winner = duelWinner(d)
    let reward = 0
    if (winner) {
      const now = Date.now()
      const r = duelRewards(winner)
      await env.DB.prepare("UPDATE duels SET status = 'done' WHERE id = ?").bind(id).run()
      d.status = 'done'
      await addCoins(env, d.creator_id, r.creator, `duel:${id}`, now)
      if (d.opponent_id) await addCoins(env, d.opponent_id, r.opponent, `duel:${id}`, now)
      reward = side === 'creator' ? r.creator : r.opponent
    }
    return json({ duel: await duelView(env, d, user.id), reward })
  }

  if (path === '/duels') {
    const rows = await env.DB.prepare('SELECT * FROM duels WHERE creator_id = ? OR opponent_id = ? ORDER BY created_at DESC LIMIT 20').bind(user.id, user.id).all<DuelRow>()
    return json({ duels: await Promise.all(rows.results.map((d) => duelView(env, d, user.id))) })
  }

  if (path === '/shop') {
    const [owned, equipped] = await Promise.all([ownedItems(env, user.id), equippedItems(env, user.id)])
    return json({ items: ITEMS, events: EVENT_DEFS, owned: [...owned], equipped, coins: user.coins })
  }

  if (path === '/shop/buy' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { item?: string } | null
    const id = body?.item ?? ''
    const owned = await ownedItems(env, user.id)
    const err = canBuy(id, owned, user.coins)
    if (err) return json({ error: err }, err === 'poor' ? 402 : 400)
    const price = itemById(id)!.price!
    const now = Date.now()
    // guard against double-spend: the UPDATE only succeeds if the balance still covers the price
    const upd = await env.DB.prepare('UPDATE users SET coins = coins - ? WHERE id = ? AND coins >= ?').bind(price, user.id, price).run()
    if (!upd.meta.changes) return json({ error: 'poor' }, 402)
    await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO inventory (user_id, item_id, source, acquired_at) VALUES (?, ?, ?, ?)').bind(user.id, id, 'shop', now),
      env.DB.prepare('INSERT INTO coin_log (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)').bind(user.id, -price, `buy:${id}`, now),
    ])
    owned.add(id)
    return json({ ok: true, coins: user.coins - price, owned: [...owned] })
  }

  if (path === '/shop/equip' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { slot?: string; item?: string } | null
    const slot = body?.slot ?? '', id = body?.item ?? ''
    const owned = await ownedItems(env, user.id)
    if (!canEquip(slot, id, owned)) return json({ error: 'cannot equip' }, 400)
    await env.DB.prepare('INSERT INTO equipped (user_id, slot, item_id) VALUES (?, ?, ?) ON CONFLICT(user_id, slot) DO UPDATE SET item_id = excluded.item_id').bind(user.id, slot, id).run()
    return json({ ok: true, equipped: await equippedItems(env, user.id) })
  }

  if (path === '/donate' && req.method === 'POST') {
    const body = (await req.json().catch(() => null)) as { stars?: number } | null
    const tier = DONATION_TIERS.find((t) => t.stars === body?.stars)
    if (!tier) return json({ error: 'bad tier' }, 400)
    const bot = new BotApi(env.BOT_TOKEN)
    const link = await bot.createStarsInvoiceLink(tier.title, `Поддержка Mini Games. Спасибо, ${tg.first_name}!`, `donate:${user.id}:${tier.stars}`, tier.stars)
    return json({ link })
  }

  return json({ error: 'not found' }, 404)
}

/** Telegram bot updates (webhook). Handles /start, Stars payments. */
async function handleWebhook(env: Env, req: Request): Promise<Response> {
  if (req.headers.get('x-telegram-bot-api-secret-token') !== env.WEBHOOK_SECRET) return new Response('forbidden', { status: 403 })
  const upd = (await req.json().catch(() => null)) as Update | null
  if (!upd) return new Response('ok')
  const bot = new BotApi(env.BOT_TOKEN)
  try {
    if (upd.pre_checkout_query) {
      await bot.answerPreCheckoutQuery(upd.pre_checkout_query.id, true)
    } else if (upd.message?.successful_payment && upd.message.from) {
      const p = upd.message.successful_payment
      const uid = upd.message.from.id
      const now = Date.now()
      const dup = await env.DB.prepare('SELECT 1 FROM payments WHERE charge_id = ?').bind(p.telegram_payment_charge_id).first()
      if (!dup) {
        const coins = p.total_amount * COINS_PER_STAR
        await env.DB.batch([
          env.DB.prepare('INSERT INTO payments (charge_id, user_id, stars, payload, created_at) VALUES (?, ?, ?, ?, ?)').bind(p.telegram_payment_charge_id, uid, p.total_amount, p.invoice_payload, now),
          env.DB.prepare('INSERT INTO users (id, name, coins, stars_total, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET coins = coins + ?, stars_total = stars_total + ?')
            .bind(uid, upd.message.from.first_name, coins, p.total_amount, now, now, coins, p.total_amount),
          env.DB.prepare('INSERT INTO coin_log (user_id, delta, reason, created_at) VALUES (?, ?, ?, ?)').bind(uid, coins, `stars:${p.total_amount}`, now),
        ])
      }
      await bot.sendMessage(uid, `Спасибо за поддержку! ⭐ ${p.total_amount} → +${p.total_amount * COINS_PER_STAR} монет на счёт.`)
    } else if (upd.message?.text?.startsWith('/start') && upd.message.chat.type === 'private') {
      const arg = upd.message.text.split(' ')[1]
      const url = arg ? `${env.WEBAPP_URL}?startapp=${encodeURIComponent(arg)}` : env.WEBAPP_URL
      await bot.sendMessage(upd.message.chat.id, 'Привет! Жми кнопку и выбирай игру 👇', {
        reply_markup: { inline_keyboard: [[{ text: '🎮 Играть', web_app: { url } }]] },
      })
    } else if (upd.message?.chat.type === 'private') {
      await bot.sendMessage(upd.message.chat.id, 'Нажми /start или кнопку меню, чтобы открыть игры.')
    }
  } catch (e) {
    console.error('webhook error', e)
  }
  return new Response('ok')
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname === '/webhook' && req.method === 'POST') return handleWebhook(env, req)
    const cors = corsHeaders(env, req)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (url.pathname === '/health') return json({ ok: true }, 200, cors)
    if (url.pathname.startsWith('/api/')) {
      const res = await handleApi(env, req, url)
      for (const [k, v] of Object.entries(cors)) res.headers.set(k, v)
      return res
    }
    return json({ error: 'not found' }, 404, cors)
  },
} satisfies ExportedHandler<Env>
