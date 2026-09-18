import { Suspense, useCallback, useEffect } from 'react'
import { findGame } from '../games/registry'
import { setBest } from '../lib/storage'
import { goHub } from '../lib/router'
import { isTelegram, showBackButton } from '../lib/telegram'

export default function GameScreen({ id }: { id: string }) {
  const game = findGame(id)

  useEffect(() => showBackButton(goHub), [])

  const onScore = useCallback((score: number) => { void setBest(id, score) }, [id])

  if (!game) {
    goHub()
    return null
  }
  const Game = game.component

  return (
    <div className="screen">
      <div className="game-header">
        {!isTelegram && <button className="back-btn" onClick={goHub}>← Назад</button>}
        <h1 className="title">{game.icon} {game.title}</h1>
      </div>
      <Suspense fallback={<p className="subtitle">Загрузка…</p>}>
        <Game onScore={onScore} />
      </Suspense>
    </div>
  )
}
