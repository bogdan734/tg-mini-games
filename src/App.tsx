import { useRoute } from './lib/router'
import Hub from './screens/Hub'
import GameScreen from './screens/GameScreen'

export default function App() {
  const route = useRoute()
  return route.name === 'game' ? <GameScreen id={route.id} /> : <Hub />
}
