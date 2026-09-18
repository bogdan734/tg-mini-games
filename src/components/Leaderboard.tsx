import { useEffect, useState } from 'react'
import { getLeaderboard, type Board } from '../lib/api'
import { haptic } from '../lib/telegram'

const BOARDS = [
  { key: 'all', game: 'all', level: 0, name: 'Общий' },
  { key: 's1', game: 'snake-td', level: 1, name: '🐍 Луг' }, { key: 's2', game: 'snake-td', level: 2, name: '🐍 Пустыня' },
  { key: 's3', game: 'snake-td', level: 3, name: '🐍 Снега' }, { key: 's4', game: 'snake-td', level: 4, name: '🐍 ∞' },
  { key: 'm1', game: 'merge-td', level: 1, name: '🏰 Merge' },
]

export default function Leaderboard({ onClose, initialKey = 'all' }: { onClose: () => void; initialKey?: string }) {
  const [scope, setScope] = useState<'global' | 'friends'>('global')
  const [key, setKey] = useState(initialKey)
  const [board, setBoard] = useState<Board | null>(null)
  const [loading, setLoading] = useState(true)
  const sel = BOARDS.find((b) => b.key === key) ?? BOARDS[0]

  useEffect(() => {
    let alive = true
    setLoading(true)
    getLeaderboard(sel.game, sel.level, scope).then((b) => { if (alive) { setBoard(b); setLoading(false) } })
    return () => { alive = false }
  }, [sel.game, sel.level, scope])

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
        <div className="tabs small wrap">
          {BOARDS.map((b) => (
            <button key={b.key} className={key === b.key ? 'tab active' : 'tab'} onClick={() => { haptic('light'); setKey(b.key) }}>{b.name}</button>
          ))}
        </div>
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
