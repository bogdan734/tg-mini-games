import { describe, expect, it } from 'vitest'
import { boardPath, pointAt } from '../path'

describe('boardPath', () => {
  const p = boardPath(390, 470, 36)

  it('starts top-right and ends bottom-right', () => {
    expect(pointAt(p, 0)).toMatchObject({ x: 354, y: 36 })
    const end = pointAt(p, p.length)
    expect(end.x).toBeCloseTo(354)
    expect(end.y).toBeCloseTo(434)
  })

  it('has a length longer than three sides minus corners', () => {
    expect(p.length).toBeGreaterThan(900)
    expect(p.length).toBeLessThan(1100)
  })

  it('clamps distance outside the path', () => {
    expect(pointAt(p, -50)).toMatchObject({ x: 354, y: 36 })
    expect(pointAt(p, 9999).y).toBeCloseTo(434)
  })

  it('walks left first, then down', () => {
    expect(pointAt(p, 100).x).toBeCloseTo(254)
    const mid = pointAt(p, p.length / 2)
    expect(mid.x).toBeCloseTo(36)
  })
})
