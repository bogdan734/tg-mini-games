import { useEffect, useState } from 'react'
import ProfileCard from '../components/ProfileCard'
import { GAMES } from '../games/registry'
import { setPendingDuel } from '../lib/api'
import { goGame } from '../lib/router'
import { getBest } from '../lib/storage'
import { haptic, startParam } from '../lib/telegram'

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
    <div className="screen hub">
      <div className="hub-title ribbon"><span>Mini Games</span></div>
      <ProfileCard />
      <div className="game-list">
        {GAMES.map((g) => (
          <button
            key={g.id}
            className="game-card parchment"
            disabled={!g.ready}
            onClick={() => { haptic('light'); goGame(g.id) }}
          >
            <div className="game-cover" style={{ backgroundImage: `url(${import.meta.env.BASE_URL}games/covers/${g.id}.png)` }}>
              {!g.ready && <span className="badge">Скоро</span>}
            </div>
            <div className="game-body">
              <div className="game-text">
                <span className="name">{g.icon} {g.title}</span>
                <span className="desc">{g.description}</span>
                {g.ready && <span className="best">Рекорд: {best[g.id] ?? 0}</span>}
              </div>
              <span className="ts-btn">Играть</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
