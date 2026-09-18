import { useEffect, useState } from 'react'
import { getLeaderboard, type Board } from '../lib/api'
import { haptic } from '../lib/telegram'

const LEVELS = [
  { id: 1, name: 'Луг' }, { id: 2, name: 'Пустыня' }, { id: 3, name: 'Снега' }, { id: 4, name: '∞' },
]

export default function Leaderboard({ onClose, game = 'snake-td', initialLevel = 1 }: { onClose: () => void; game?: string; initialLevel?: number }) {
  const [scope, setScope] = useState<'global' | 'friends'>('global')
  const [level, setLevel] = useState(initialLevel)
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    getLeaderboard(game, level, scope).then((b) => { if (alive) { setBoard(b); setLoading(false) } })
    return () => { alive = false }
  }, [game, level, scope])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="title">🏆 Рейтинг</h2>
          <button className="back-btn" onClick={onClose}>✕</button>
        </div>
        <div className="tabs">
          <button className={scope === 'global' ? 'tab active' : 'tab'} onClick={() => { haptic('light'); setScope('global') }}>Все</button>
          <button className={scope === 'friends' ? 'tab active' : 'tab'} onClick={() => { haptic('light'); setScope('friends') }}>Друзья</button>
        </div>
        {game === 'snake-td' && (
          <div className="tabs small">
            {LEVELS.map((l) => (
              <button key={l.id} className={level === l.id ? 'tab active' : 'tab'} onClick={() => { haptic('light'); setLevel(l.id) }}>{l.name}</button>
            ))}
          </div>
        )}
        <div className="board">
          {loading && <p className="subtitle">Загрузка…</p>}
          {!loading && board && board.entries.length === 0 && (
            <p className="subtitle">{scope === 'friends' ? 'Пока никого — пригласи друзей кнопкой 👥' : 'Пока пусто — будь первым!'}</p>
          )}
          {!loading && board?.entries.map((e) => (
            <div key={e.id} className={e.me ? 'board-row me' : 'board-row'}>
              <span className="board-rank">{e.rank <= 3 ? ['🥇', '🥈', '🥉'][e.rank - 1] : e.rank}</span>
              <span className="board-avatar">{e.photo ? <img src={e.photo} alt="" /> : (e.name.slice(0, 1))}</span>
              <span className="board-name">{e.name}</span>
              <span className="board-score">{e.score}</span>
            </div>
          ))}
        </div>
        {!loading && board?.me.rank && <p className="subtitle">Твоё место: #{board.me.rank} · {board.me.score} очков</p>}
      </div>
    </div>
  )
}
