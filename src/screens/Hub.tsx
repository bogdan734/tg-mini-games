import { useEffect, useState } from 'react'
import { GAMES } from '../games/registry'
import { getBest } from '../lib/storage'
import { goGame } from '../lib/router'
import { haptic, startParam, userName } from '../lib/telegram'
import { setPendingDuel } from '../lib/api'
import ProfileCard from '../components/ProfileCard'

export default function Hub() {
  const [best, setBest] = useState<Record<string, number>>({})

  useEffect(() => {
    const sp = startParam()
    if (sp?.startsWith('duel_')) { setPendingDuel(sp.slice(5)); goGame('snake-td'); return }
  }, [])

  useEffect(() => {
    let alive = true
    Promise.all(GAMES.map(async (g) => [g.id, await getBest(g.id)] as const)).then((pairs) => {
      if (alive) setBest(Object.fromEntries(pairs))
    })
    return () => { alive = false }
  }, [])

  return (
    <div className="screen">
      <div>
        <h1 className="title">Привет, {userName()} 👋</h1>
        <p className="subtitle">Выбери игру</p>
      </div>
      <ProfileCard />
      <div className="game-grid">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className="game-card"
            disabled={!g.ready}
            onClick={() => { haptic('light'); goGame(g.id) }}
          >
            {!g.ready && <span className="badge">Скоро</span>}
            <span className="icon">{g.icon}</span>
            <span className="name">{g.title}</span>
            <span className="desc">{g.description}</span>
            {g.ready && <span className="best">Рекорд: {best[g.id] ?? 0}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
