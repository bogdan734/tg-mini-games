import { useEffect, useState } from 'react'
import { claimQuest, getDuels, getEvents, getQuests, setPendingDuel, type DuelView, type EventView, type Quest } from '../lib/api'
import { goGame } from '../lib/router'
import { haptic } from '../lib/telegram'

const LEVEL_NAME: Record<number, string> = { 1: 'Излучина', 2: 'Серпантин', 3: 'Песочные часы', 4: 'Клыки' }

function untilText(iso: string): string {
  const d = new Date(iso)
  return `до ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function Quests({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'quests' | 'events' | 'duels'>('quests')
  const [quests, setQuests] = useState<Quest[] | null>(null)
  const [events, setEvents] = useState<EventView[] | null>(null)
  const [duels, setDuels] = useState<DuelView[] | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    void getQuests().then((q) => setQuests(q?.quests ?? []))
    void getEvents().then((e) => setEvents(e?.events ?? []))
    void getDuels().then(setDuels)
  }, [])

  const claim = async (q: Quest) => {
    haptic('light')
    const r = await claimQuest(q.id)
    if (r.ok) { haptic('success'); setMsg(`+${r.reward} 🪙`); setQuests((qs) => (qs ?? []).map((x) => (x.id === q.id ? { ...x, claimed: true } : x))) }
    else setMsg('Не удалось забрать')
  }

  const openDuel = (d: DuelView) => { haptic('light'); setPendingDuel(d.id); onClose(); goGame('snake-td') }

  const duelLine = (d: DuelView): string => {
    const mine = d.me === 'creator' ? d.creator : d.opponent
    const theirs = d.me === 'creator' ? d.opponent : d.creator
    if (d.status === 'done') {
      const res = d.winner === 'draw' ? 'Ничья' : (d.winner === d.me ? 'Победа' : 'Поражение')
      return `${res}: ${mine?.score ?? 0} — ${theirs?.score ?? 0}`
    }
    if (mine?.score === null || mine?.score === undefined) return 'Твой ход — сыграй'
    if (!theirs) return `Ты: ${mine.score}. Ждём соперника`
    return `Ты: ${mine.score}. ${theirs.name ?? 'Соперник'} ещё играет`
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="title">📋 Задания</h2>
          <button className="back-btn" onClick={onClose}>✕</button>
        </div>
        <div className="tabs">
          <button className={tab === 'quests' ? 'tab active' : 'tab'} onClick={() => setTab('quests')}>На сегодня</button>
          <button className={tab === 'events' ? 'tab active' : 'tab'} onClick={() => setTab('events')}>Ивенты</button>
          <button className={tab === 'duels' ? 'tab active' : 'tab'} onClick={() => setTab('duels')}>Дуэли</button>
        </div>
        {tab === 'quests' && (
          <div className="q-list">
            {!quests && <p className="subtitle">Загрузка…</p>}
            {quests?.map((q) => {
              const done = q.progress >= q.target
              return (
                <div key={q.id} className="q-row">
                  <div className="q-body">
                    <b>{q.title}</b>
                    <div className="q-bar"><span style={{ width: `${Math.min(100, (q.progress / q.target) * 100)}%` }} /></div>
                    <small>{Math.min(q.progress, q.target)} / {q.target}</small>
                  </div>
                  <button className="btn-small" disabled={!done || q.claimed} onClick={() => claim(q)}>{q.claimed ? 'Получено' : `+${q.reward} 🪙`}</button>
                </div>
              )
            })}
            <p className="subtitle">Новые задания каждый день в 03:00 по Киеву.</p>
          </div>
        )}
        {tab === 'events' && (
          <div className="q-list">
            {!events && <p className="subtitle">Загрузка…</p>}
            {events?.length === 0 && <p className="subtitle">Сейчас ивентов нет — загляни позже.</p>}
            {events?.map((e) => (
              <div key={e.id} className="q-row">
                <div className="q-body">
                  <b>🎉 {e.title} <small>{untilText(e.until)}</small></b>
                  <small>{e.desc}</small>
                  <div className="q-bar"><span style={{ width: `${Math.min(100, (e.progress / e.target) * 100)}%` }} /></div>
                  <small>{Math.min(e.progress, e.target)} / {e.target} · награда: {e.rewards.coins} 🪙{e.rewards.items.length > 0 && ' + эксклюзивные скины'}</small>
                </div>
                <span className="q-status">{e.done ? '✅' : '⏳'}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'duels' && (
          <div className="q-list">
            <p className="subtitle">Дуэль — одна карта и один сид на двоих: у обоих одинаковые магазин и ивенты, побеждает больший счёт. Победа +30 🪙, участие +10 🪙. Создать дуэль можно в меню карт Snake Defense (⚔️).</p>
            {!duels && <p className="subtitle">Загрузка…</p>}
            {duels?.length === 0 && <p className="subtitle">Дуэлей пока нет.</p>}
            {duels?.map((d) => {
              const mine = d.me === 'creator' ? d.creator : d.opponent
              const canPlay = d.status === 'open' && (mine?.score === null || mine?.score === undefined)
              return (
                <div key={d.id} className="q-row">
                  <div className="q-body">
                    <b>⚔️ {LEVEL_NAME[d.level]} · vs {(d.me === 'creator' ? d.opponent?.name : d.creator.name) ?? '…'}</b>
                    <small>{duelLine(d)}</small>
                  </div>
                  {canPlay && <button className="btn-small" onClick={() => openDuel(d)}>Играть</button>}
                </div>
              )
            })}
          </div>
        )}
        {msg && <p className="subtitle">{msg}</p>}
      </div>
    </div>
  )
}
