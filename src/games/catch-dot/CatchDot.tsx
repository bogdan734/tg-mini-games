import { useCallback, useEffect, useRef, useState } from 'react'
import { haptic } from '../../lib/telegram'
import type { GameProps } from '../types'

const ROUND_SECONDS = 20
const DOT = 56

type Phase = 'idle' | 'playing' | 'over'

export default function CatchDot({ onScore }: GameProps) {
  const arenaRef = useRef<HTMLDivElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS)
  const [pos, setPos] = useState({ x: 50, y: 50 })

  const moveDot = useCallback(() => {
    const el = arenaRef.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const pad = DOT / 2 + 8
    setPos({
      x: pad + Math.random() * (width - pad * 2),
      y: pad + Math.random() * (height - pad * 2),
    })
  }, [])

  const start = () => {
    setScore(0)
    setTimeLeft(ROUND_SECONDS)
    setPhase('playing')
    moveDot()
    haptic('medium')
  }

  useEffect(() => {
    if (phase !== 'playing') return
    const t = setInterval(() => setTimeLeft((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [phase])

  useEffect(() => {
    if (phase === 'playing' && timeLeft <= 0) {
      setPhase('over')
      haptic('success')
      onScore(score)
    }
  }, [phase, timeLeft, score, onScore])

  const hit = () => {
    if (phase !== 'playing') return
    setScore((s) => s + 1)
    haptic('light')
    moveDot()
  }

  return (
    <>
      <div className="hud">
        <span>Счёт <b>{score}</b></span>
        <span>Время <b>{Math.max(0, timeLeft)}</b></span>
      </div>
      <div className="arena" ref={arenaRef}>
        {phase === 'playing' && (
          <div
            className="dot"
            style={{ left: pos.x, top: pos.y }}
            onPointerDown={hit}
          />
        )}
        {phase !== 'playing' && (
          <div className="overlay">
            <h2>{phase === 'idle' ? 'Поймай точку' : `Результат: ${score}`}</h2>
            <p className="subtitle">{ROUND_SECONDS} секунд, тапай по точке как можно чаще</p>
            <button className="btn-primary" onClick={start}>
              {phase === 'idle' ? 'Старт' : 'Ещё раз'}
            </button>
          </div>
        )}
      </div>
    </>
  )
}
