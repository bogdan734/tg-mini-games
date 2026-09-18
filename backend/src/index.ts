import { validateInitData, type TgUser } from './auth'
import { COINS_PER_STAR, coinsForScore, DONATION_TIERS } from './economy'
import { canBuy, canEquip, coinsForRun, defaultFor, eventGrants, ITEMS, EVENTS as SHOP_EVENTS, itemById } from './shop'
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
    ? 'AND (s.user_id = ? OR u.referrer_id = ? OR u.id = (SELECT referrer_id FROM users WHERE id = ?))'
    : ''
  const friendsBind = scope === 'friends' ? [userId, userId, userId] : []
  const rows = await env.DB.prepare(
    `SELECT s.user_id AS id, u.name, u.username, u.photo, s.score, s.wave
     FROM scores s JOIN users u ON u.id = s.user_id
     WHERE s.game = ? AND s.level = ? ${friendsFilter}
     ORDER BY s.score DESC, s.updated_at ASC LIMIT 50`,
  ).bind(game, level, ...friendsBind).all<{ id: number; name: string; username: string | null; photo: string | null; score: number; wave: number }>()
  const mine = await env.DB.prepare('SELECT score FROM scores WHERE user_id = ? AND game = ? AND level = ?').bind(userId, game, level).first<{ score: number }>()
  let rank: number | null = null
  if (mine) {
    const above = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM scores s JOIN users u ON u.id = s.user_id WHERE s.game = ? AND s.level = ? AND s.score > ? ${friendsFilter}`,
    ).bind(game, level, mine.score, ...friendsBind).first<{ n: number }>()
    rank = (above?.n ?? 0) + 1
  }
  return { entries: rows.results.map((r, i) => ({ ...r, rank: i + 1, me: r.id === userId })), me: { score: mine?.score ?? 0, rank } }
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
    const body = (await req.json().catch(() => null)) as { game?: string; level?: number; score?: number; wave?: number; won?: boolean } | null
    if (!body || !GAMES.has(body.game ?? '') || !Number.isInteger(body.level) || !Number.isInteger(body.score) || (body.score ?? 0) < 0 || (body.score ?? 0) > 1e7) {
      return json({ error: 'bad score' }, 400)
    }
    const { game, level, score } = body as { game: string; level: number; score: number }
    const wave = Number.isInteger(body.wave) ? (body.wave as number) : 0
    const now = Date.now()
    const prev = await env.DB.prepare('SELECT score FROM scores WHERE user_id = ? AND game = ? AND level = ?').bind(user.id, game, level).first<{ score: number }>()
    const prevBest = prev?.score ?? 0
    const coins = coinsForScore(prevBest, score) + coinsForRun(wave)
    const stmts: D1PreparedStatement[] = []
    const owned = await ownedItems(env, user.id)
    const granted = eventGrants({ won: body.won === true, level, now }).filter((id) => !owned.has(id))
    for (const id of granted) {
      stmts.push(env.DB.prepare('INSERT OR IGNORE INTO inventory (user_id, item_id, source, acquired_at) VALUES (?, ?, ?, ?)').bind(user.id, id, 'event:launch', now))
    }
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
    return json({ best: Math.max(prevBest, score), improved: score > prevBest, coinsEarned: coins, coins: user.coins + coins, rank: board.me.rank, granted })
  }

  if (path === '/leaderboard') {
    const game = url.searchParams.get('game') ?? ''
    const level = Number(url.searchParams.get('level') ?? 0)
    const scope = url.searchParams.get('scope') === 'friends' ? 'friends' : 'global'
    if (!GAMES.has(game) || !Number.isInteger(level)) return json({ error: 'bad params' }, 400)
    return json(await leaderboard(env, user.id, game, level, scope))
  }

  if (path === '/shop') {
    const [owned, equipped] = await Promise.all([ownedItems(env, user.id), equippedItems(env, user.id)])
    return json({ items: ITEMS, events: SHOP_EVENTS, owned: [...owned], equipped, coins: user.coins })
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
