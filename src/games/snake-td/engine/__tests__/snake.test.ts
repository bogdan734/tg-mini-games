import { describe, expect, it } from 'vitest'
import { createGame } from '../game'
import { PATH } from '../layout'
import { advanceSnake, makeSnake, removeDead, segmentPos, SPACING, waveSpeed } from '../snake'

describe('makeSnake', () => {
  it('builds head-first with tankier tail', () => {
    const s = makeSnake(1, 100)
    expect(s.length).toBe(14)
    expect(s[0].head).toBe(true)
    expect(s[0].hp).toBeGreaterThan(s[1].hp)
    expect(s[s.length - 1].hp).toBeGreaterThanOrEqual(s[1].hp)
    expect(s[0].id).toBe(100)
  })
})

describe('advanceSnake', () => {
  it('moves the head by speed * dt', () => {
    const g = createGame()
    g.snake = makeSnake(1, 1)
    advanceSnake(g, 1)
    expect(g.headD).toBeCloseTo(waveSpeed(1))
  })

  it('keeps looping: the leader passing the gate costs lives (head = 3)', () => {
    const g = createGame()
    g.snake = makeSnake(1, 1)
    g.headD = PATH.length - 1
    const passes = advanceSnake(g, 0.05)
    expect(passes).toBe(1)
    expect(g.lives).toBe(7)
    expect(g.snake).toHaveLength(14)
    expect(g.snake[0].head).toBe(true)
    expect(segmentPos(g, 0)).toBeCloseTo(waveSpeed(1) * 0.05 - 1)
  })

  it('a headless leader costs one life per pass', () => {
    const g = createGame()
    g.snake = makeSnake(1, 1).slice(1)
    g.headD = PATH.length - 1
    advanceSnake(g, 0.05)
    expect(g.lives).toBe(9)
  })
})

describe('removeDead', () => {
  it('drops dead middle segments without moving the head', () => {
    const g = createGame()
    g.snake = makeSnake(1, 1)
    g.headD = 200
    g.snake[3].hp = 0
    const dead = removeDead(g)
    expect(dead).toHaveLength(1)
    expect(g.snake).toHaveLength(13)
    expect(g.headD).toBe(200)
  })

  it('shifts headD back when the head dies', () => {
    const g = createGame()
    g.snake = makeSnake(1, 1)
    g.headD = 200
    g.snake[0].hp = 0
    removeDead(g)
    expect(g.headD).toBe(200 - SPACING)
    expect(g.snake[0].head).toBe(false)
  })
})
