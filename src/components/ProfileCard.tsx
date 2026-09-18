import { useEffect, useState } from 'react'
import { apiEnabled, getMe, onProfile, type Profile } from '../lib/api'
import { haptic, shareText } from '../lib/telegram'
import Donate from './Donate'
import Leaderboard from './Leaderboard'

export default function ProfileCard() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [modal, setModal] = useState<'board' | 'donate' | null>(null)

  useEffect(() => {
    void getMe()
    return onProfile(setProfile)
  }, [])

  if (!apiEnabled()) return null
  const u = profile?.user

  return (
    <>
      <div className="profile">
        <div className="profile-avatar">
          {u?.photo ? <img src={u.photo} alt="" /> : <span>{(u?.name ?? '?').slice(0, 1)}</span>}
        </div>
        <div className="profile-body">
          <b>{u?.name ?? 'Загрузка…'}</b>
          <span className="profile-coins">🪙 {u?.coins ?? 0}</span>
        </div>
        <div className="profile-actions">
          <button className="chip" onClick={() => { haptic('light'); setModal('board') }}>🏆</button>
          <button className="chip" onClick={() => { haptic('light'); setModal('donate') }}>⭐</button>
          <button className="chip" onClick={() => { haptic('light'); if (profile) shareText('Залетай в мини-игры, го соревноваться 🎮', profile.inviteLink) }}>👥</button>
        </div>
      </div>
      {modal === 'board' && <Leaderboard onClose={() => setModal(null)} />}
      {modal === 'donate' && profile && <Donate tiers={profile.donationTiers} onClose={() => setModal(null)} />}
    </>
  )
}
