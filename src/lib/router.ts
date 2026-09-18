import { useEffect, useState } from 'react'

export type Route = { name: 'hub' } | { name: 'game'; id: string }

function parse(hash: string): Route {
  const m = hash.match(/^#\/game\/([\w-]+)$/)
  return m ? { name: 'game', id: m[1] } : { name: 'hub' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(location.hash))
  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash))
    addEventListener('hashchange', onChange)
    return () => removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export const goHub = () => { location.hash = '#/' }
export const goGame = (id: string) => { location.hash = `#/game/${id}` }
