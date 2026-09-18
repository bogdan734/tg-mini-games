import { useEffect, useState } from 'react'
import { buyItem, equipItem, getShop, type Shop as ShopData, type ShopItem } from '../lib/api'
import { haptic } from '../lib/telegram'

const KINDS: { kind: ShopItem['kind']; title: string }[] = [
  { kind: 'units', title: 'Бойцы' }, { kind: 'snake', title: 'Змея' }, { kind: 'map', title: 'Карты' },
]
const SNAKE_SWATCH: Record<string, string> = {
  'snake:stone': 'linear-gradient(135deg,#d8dfeb,#6b7590)', 'snake:lava': 'linear-gradient(135deg,#ffd27a,#b3341a)',
  'snake:ice': 'linear-gradient(135deg,#ffffff,#5ea6e8)', 'snake:gold': 'linear-gradient(135deg,#fff3b0,#c98a12)',
}
const MAP_ICON: Record<number, string> = { 2: '🏜️', 3: '❄️', 4: '♾️' }
const ERR: Record<string, string> = { poor: 'Не хватает монет', event_only: 'Только за ивент', owned: 'Уже есть', offline: 'Открой в Telegram' }

function Preview({ item }: { item: ShopItem }) {
  if (item.kind === 'units') return <img className="shop-img" src={`${import.meta.env.BASE_URL}games/snake-td/units/${item.id.slice(6)}/frost_2.png`} alt="" />
  if (item.kind === 'snake') return <span className="shop-swatch" style={{ background: SNAKE_SWATCH[item.id] }} />
  return <span className="shop-emoji">{MAP_ICON[item.level ?? 0] ?? '🗺️'}</span>
}

export default function Shop({ onClose, onDonate, unlockedMap = 1 }: { onClose: () => void; onDonate: () => void; unlockedMap?: number }) {
  const [kind, setKind] = useState<ShopItem['kind']>('units')
  const [shop, setShop] = useState<ShopData | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => { void getShop().then(setShop) }, [])

  const owned = new Set(shop?.owned ?? [])
  const items = (shop?.items ?? []).filter((i) => i.kind === kind)

  const act = async (item: ShopItem) => {
    if (!shop) return
    setBusy(item.id)
    haptic('light')
    const isOwned = owned.has(item.id) || item.default
    if (item.kind === 'map') {
      const r = await buyItem(item.id)
      setMsg('ok' in r ? `Карта «${item.name}» открыта` : ERR[r.error] ?? 'Ошибка')
      if ('ok' in r) { setShop({ ...shop, coins: r.coins, owned: r.owned }); haptic('success') }
    } else if (isOwned) {
      const eq = await equipItem(item.kind, item.id)
      if (eq) { setShop({ ...shop, equipped: eq }); setMsg(`Надето: ${item.name}`) }
    } else {
      const r = await buyItem(item.id)
      if ('ok' in r) {
        const eq = await equipItem(item.kind, item.id)
        setShop({ ...shop, coins: r.coins, owned: r.owned, equipped: eq ?? shop.equipped })
        setMsg(`Куплено и надето: ${item.name}`)
        haptic('success')
      } else { setMsg(ERR[r.error] ?? 'Ошибка'); haptic('error') }
    }
    setBusy(null)
  }

  const label = (item: ShopItem): string => {
    if (item.kind === 'map') return item.level! <= unlockedMap || owned.has(item.id) ? 'Открыта' : `${item.price} 🪙`
    if (shop?.equipped[item.kind] === item.id) return 'Надето'
    if (owned.has(item.id) || item.default) return 'Надеть'
    if (item.event) return owned.has(item.id) ? 'Надеть' : 'Ивент'
    return `${item.price} 🪙`
  }
  const disabled = (item: ShopItem): boolean => {
    if (busy) return true
    if (item.kind === 'map') return item.level! <= unlockedMap || owned.has(item.id)
    if (shop?.equipped[item.kind] === item.id) return true
    if (item.event && !owned.has(item.id)) return true
    return false
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2 className="title">🛒 Магазин</h2>
          <div className="std-row">
            <button className="back-btn" onClick={onDonate}>🪙 {shop?.coins ?? 0} · ⭐</button>
            <button className="back-btn" onClick={onClose}>✕</button>
          </div>
        </div>
        <p className="subtitle">Всё за монеты. Монеты — за игру, рекорды и друзей; ⭐ только ускоряют. Ивентовые вещи не продаются.</p>
        <div className="tabs">
          {KINDS.map((k) => <button key={k.kind} className={kind === k.kind ? 'tab active' : 'tab'} onClick={() => { haptic('light'); setKind(k.kind) }}>{k.title}</button>)}
        </div>
        <div className="shop-list">
          {!shop && <p className="subtitle">Загрузка…</p>}
          {items.map((item) => (
            <div key={item.id} className="shop-row">
              <Preview item={item} />
              <div className="shop-body">
                <b>{item.name}</b>
                <small>{item.event ? shop?.events[item.event]?.desc ?? item.desc : item.desc}</small>
              </div>
              <button className="btn-small" disabled={disabled(item)} onClick={() => act(item)}>{label(item)}</button>
            </div>
          ))}
        </div>
        {msg && <p className="subtitle">{msg}</p>}
      </div>
    </div>
  )
}
