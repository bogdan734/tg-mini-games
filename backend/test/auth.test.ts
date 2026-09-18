import { describe, expect, it } from 'vitest'
import { signInitData, validateInitData } from '../src/auth'
import { coinsForScore } from '../src/economy'

const TOKEN = '123456:TEST_TOKEN'
const now = 1_700_000_000_000
const fields = (over: Record<string, string> = {}) => ({
  auth_date: String(Math.floor(now / 1000) - 60),
  query_id: 'AAH',
  user: JSON.stringify({ id: 42, first_name: 'Bo', username: 'bo' }),
  ...over,
})

describe('validateInitData', () => {
  it('accepts a correctly signed payload', async () => {
    const raw = await signInitData(fields({ start_param: 'ref_7' }), TOKEN)
    const d = await validateInitData(raw, TOKEN, 86400, now)
    expect(d?.user).toMatchObject({ id: 42, first_name: 'Bo' })
    expect(d?.start_param).toBe('ref_7')
  })

  it('rejects a tampered payload and a wrong token', async () => {
    const raw = await signInitData(fields(), TOKEN)
    expect(await validateInitData(raw.replace('%22id%22%3A42', '%22id%22%3A43'), TOKEN, 86400, now)).toBeNull()
    expect(await validateInitData(raw, 'other', 86400, now)).toBeNull()
    expect(await validateInitData('user=x', TOKEN, 86400, now)).toBeNull()
  })

  it('rejects stale auth_date', async () => {
    const raw = await signInitData(fields({ auth_date: String(Math.floor(now / 1000) - 90000) }), TOKEN)
    expect(await validateInitData(raw, TOKEN, 86400, now)).toBeNull()
  })
})

describe('coinsForScore', () => {
  it('pays only for improvement, 1 coin per 50 points', () => {
    expect(coinsForScore(0, 6060)).toBe(121)
    expect(coinsForScore(6000, 6060)).toBe(1)
    expect(coinsForScore(6060, 6060)).toBe(0)
    expect(coinsForScore(7000, 6060)).toBe(0)
  })
})
