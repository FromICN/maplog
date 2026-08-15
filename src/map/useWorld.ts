import { useEffect, useState } from 'react'
import { loadWorld, type World } from '../data/countries'

type State = { world: World | null; error: string | null }

export function useWorld(): State {
  const [state, setState] = useState<State>({ world: null, error: null })

  useEffect(() => {
    let alive = true
    loadWorld().then(
      (world) => alive && setState({ world, error: null }),
      (e: unknown) => alive && setState({ world: null, error: String(e) }),
    )
    return () => {
      alive = false
    }
  }, [])

  return state
}
