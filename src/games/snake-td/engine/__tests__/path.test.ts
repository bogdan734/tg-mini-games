import { describe, expect, it } from 'vitest'
import { distanceToPath, pointAt } from '../path'
import { getLevel, LEVELS, unlockAfterWin } from '../levels'
import { PATH_WIDTH, SLOT_R } from '../layout'

describe('ring path (level 1)', () => {
  const p = getLevel(1).path

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

describe('levels', () => {
  it('every slot sits clear of the road', () => {
    for (const lvl of LEVELS) {
      for (const slot of lvl.slots) {
        expect(distanceToPath(lvl.path, slot), `${lvl.name} slot ${slot.x},${slot.y}`).toBeGreaterThanOrEqual(PATH_WIDTH / 2 + SLOT_R - 6)
      }
    }
  })

  it('every level route starts at the spawn and ends at the gate on the right edge', () => {
    for (const lvl of LEVELS) {
      expect(lvl.spawn).toEqual({ x: 354, y: 36 })
      expect(lvl.gate.x).toBeCloseTo(354)
      expect(lvl.path.length).toBeGreaterThan(1000)
    }
  })

  it('unlocks the next level on a win, never beyond the last', () => {
    expect(unlockAfterWin(1, 1)).toBe(2)
    expect(unlockAfterWin(1, 3)).toBe(3)
    expect(unlockAfterWin(4, 4)).toBe(4)
  })
})
