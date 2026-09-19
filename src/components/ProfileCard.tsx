import { useEffect, useState } from 'react'
import { apiEnabled, getMe, onProfile, profileError, type Profile } from '../lib/api'
import { haptic, shareText } from '../lib/telegram'
import Donate from './Donate'
import Leaderboard from './Leaderboard'
import Shop from './Shop'
import Quests from './Quests'

export default function ProfileCard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [modal, setModal] = useState<'board' | 'donate' | 'shop' | 'quests' | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  const load = () => { setFailed(null); void getMe(true).then((p) => { if (!p) setFailed(profileError ?? 'network') }) }
  useEffect(() => {
    void getMe().then((p) => { if (!p) setFailed(profileError ?? 'network') })
    return onProfile(setProfile)
  }, [])

  const u = profile?.user
  if (apiEnabled() && !profile && failed) {
    return (
      <div className="profile">
        <div className="profile-avatar"><span>!</span></div>
        <div className="profile-body">
          <b>Профиль не загрузился</b>
          <span className="profile-offline">{failed}</span>
        </div>
        <button className="chip" onClick={() => { haptic('light'); load() }}>↻</button>
      </div>
    )
  }
  if (!apiEnabled()) {
    return (
      <div className="profile">
        <div className="profile-avatar"><span>👤</span></div>
        <div className="profile-body">
          <b>Гость</b>
          <span className="profile-offline">Открой через Telegram — появятся профиль, монеты и рейтинг</span>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="profile">
        <div className="profile-top">
          <div className="profile-avatar">
            {u?.photo ? <img src={u.photo} alt="" /> : <span>{(u?.name ?? '?').slice(0, 1)}</span>}
          </div>
          <div className="profile-body">
            <b>{u?.name ?? 'Загрузка…'}</b>
            <span className="profile-coins">🪙 {u?.coins ?? 0}{profile && profile.referrals > 0 ? ` · 👥 ${profile.referrals}` : ''}</span>
          </div>
        </div>
        <div className="profile-actions">
          <button className="chip" onClick={() => { haptic('light'); setModal('quests') }}><span>📋</span><small>Задания</small></button>
          <button className="chip" onClick={() => { haptic('light'); setModal('shop') }}><span>🛒</span><small>Магазин</small></button>
          <button className="chip" onClick={() => { haptic('light'); setModal('board') }}><span>🏆</span><small>Рейтинг</small></button>
          <button className="chip" onClick={() => { haptic('light'); setModal('donate') }}><span>⭐</span><small>Поддержать</small></button>
          <button className="chip" onClick={() => { haptic('light'); if (profile) shareText('Залетай в мини-игры, го соревноваться 🎮', profile.inviteLink) }}><span>👥</span><small>Друзья</small></button>
        </div>
      </div>
      {modal === 'board' && <Leaderboard onClose={() => setModal(null)} />}
      {modal === 'donate' && profile && <Donate tiers={profile.donationTiers} onClose={() => setModal(null)} />}
      {modal === 'shop' && <Shop onClose={() => setModal(null)} onDonate={() => setModal('donate')} />}
      {modal === 'quests' && <Quests onClose={() => setModal(null)} />}
    </>
  )
}
