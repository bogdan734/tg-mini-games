import { useState } from 'react'
import { createDonation, getMe } from '../lib/api'
import { haptic, openInvoice } from '../lib/telegram'

export default function Donate({ tiers, onClose }: { tiers: { stars: number; title: string }[]; onClose: () => void }) {
  const [busy, setBusy] = useState<number | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const pay = async (stars: number) => {
    setBusy(stars)
    haptic('light')
    const link = await createDonation(stars)
    if (!link) { setMsg('Не удалось создать счёт, попробуй позже'); setBusy(null); return }
    const status = await openInvoice(link)
    if (status === 'paid') { setMsg(`Спасибо! ⭐ ${stars} → +${stars * 10} 🪙`); haptic('success'); void getMe(true) }
    else if (status === 'cancelled') setMsg(null)
    else setMsg('Оплата не прошла')
    setBusy(null)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="title">⭐ Поддержать</h2>
          <button className="back-btn" onClick={onClose}>✕</button>
        </div>
        <p className="subtitle">Оплата звёздами Telegram. За каждую ⭐ — 10 🪙 на счёт.</p>
        <div className="tiers">
          {tiers.map((t) => (
            <button key={t.stars} className="tier" disabled={busy !== null} onClick={() => pay(t.stars)}>
              <b>{t.title}</b>
              <span>⭐ {t.stars}</span>
            </button>
          ))}
        </div>
        {msg && <p className="subtitle">{msg}</p>}
      </div>
    </div>
  )
}
