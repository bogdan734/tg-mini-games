import { describe, expect, it } from 'vitest'
import { boardPath, pointAt } from '../path'

describe('boardPath', () => {
  const p = boardPath(390, 470, 36)

  it('starts top-right and ends on the right side just below the spawn', () => {
    expect(pointAt(p, 0)).toMatchObject({ x: 354, y: 36 })
    const end = pointAt(p, p.length)
    expect(end.x).toBeCloseTo(354)
    expect(end.y).toBeCloseTo(106)
  })

  it('is roughly a full ring', () => {
    expect(p.length).toBeGreaterThan(1200)
    expect(p.length).toBeLessThan(1400)
  })

  it('clamps distance outside the path', () => {
    expect(pointAt(p, -50)).toMatchObject({ x: 354, y: 36 })
    expect(pointAt(p, 9999).y).toBeCloseTo(106)
  })

  it('walks left first, then down', () => {
    expect(pointAt(p, 100).x).toBeCloseTo(254)
    const quarter = pointAt(p, p.length * 0.35)
    expect(quarter.x).toBeCloseTo(36)
  })
})
