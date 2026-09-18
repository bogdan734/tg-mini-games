/** Telegram Mini App initData validation (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app). */

export interface TgUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  language_code?: string
}

export interface InitData {
  user: TgUser
  auth_date: number
  start_param?: string
  query_id?: string
}

const enc = new TextEncoder()

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, enc.encode(data))
}

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** Returns the parsed init data when the signature matches the bot token, or null. */
export async function validateInitData(raw: string, botToken: string, maxAgeSec = 86400, now = Date.now()): Promise<InitData | null> {
  const params = new URLSearchParams(raw)
  const hash = params.get('hash')
  if (!hash) return null
  params.delete('hash')
  const dataCheck = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n')
  const secret = await hmac(enc.encode('WebAppData'), botToken)
  const expected = hex(await hmac(secret, dataCheck))
  if (expected.length !== hash.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ hash.charCodeAt(i)
  if (diff !== 0) return null
  const authDate = Number(params.get('auth_date') ?? 0)
  if (!authDate || now / 1000 - authDate > maxAgeSec) return null
  const userRaw = params.get('user')
  if (!userRaw) return null
  let user: TgUser
  try { user = JSON.parse(userRaw) as TgUser } catch { return null }
  if (typeof user.id !== 'number' || typeof user.first_name !== 'string') return null
  return { user, auth_date: authDate, start_param: params.get('start_param') ?? undefined, query_id: params.get('query_id') ?? undefined }
}

/** Test helper / reference: builds a signed initData string. */
export async function signInitData(fields: Record<string, string>, botToken: string): Promise<string> {
  const params = new URLSearchParams(fields)
  const dataCheck = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`).join('\n')
  const secret = await hmac(enc.encode('WebAppData'), botToken)
  params.set('hash', hex(await hmac(secret, dataCheck)))
  return params.toString()
}
