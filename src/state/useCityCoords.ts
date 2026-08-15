import { useEffect, useMemo, useRef, useState } from 'react'
import { loadCities, type City } from '../data/cities'

type State = { coords: Map<string, City>; loaded: Set<string> }

const EMPTY: State = { coords: new Map(), loaded: new Set() }

/**
 * Cities for the given countries, keyed by id. One cache shared by the map pins
 * and the badge rules, so a country's chunk is only ever fetched once.
 * `ready` turns true when every requested country has been fetched — badge rules
 * must not judge a half-loaded world.
 */
export function useCityCoords(countries: Set<string>) {
  const [state, setState] = useState<State>(EMPTY)
  const inFlight = useRef(new Set<string>())

  const needed = useMemo(() => [...countries].sort().join(','), [countries])

  useEffect(() => {
    if (!needed) return
    let alive = true
    const pending = needed.split(',').filter((iso) => !inFlight.current.has(iso))
    if (!pending.length) return
    for (const iso of pending) inFlight.current.add(iso)

    Promise.all(pending.map((iso) => loadCities(iso).then((list) => [iso, list] as const))).then(
      (results) => {
        if (!alive) return
        setState((prev) => {
          const coords = new Map(prev.coords)
          const loaded = new Set(prev.loaded)
          for (const [iso, list] of results) {
            loaded.add(iso)
            for (const c of list) coords.set(String(c.id), c)
          }
          return { coords, loaded }
        })
      },
    )

    return () => {
      alive = false
    }
  }, [needed])

  const ready = useMemo(
    () => !needed || needed.split(',').every((iso) => state.loaded.has(iso)),
    [needed, state.loaded],
  )

  return { coords: state.coords, ready }
}
