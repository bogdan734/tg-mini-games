import type { GameProps } from '../types'

export default function ComingSoon(_: GameProps) {
  return (
    <div className="arena">
      <div className="overlay">
        <h2>Скоро</h2>
        <p className="subtitle">Игра в разработке</p>
      </div>
    </div>
  )
}
