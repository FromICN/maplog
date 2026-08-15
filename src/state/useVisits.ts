import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { db } from '../db/db'

export type VisitState = {
  /** ISO alpha-2 of every country with a logged visit. */
  visited: Set<string>
  /** Cities logged per country — this drives how brightly a country burns. */
  cityCount: Map<string, number>
  /** GeoNames ids of logged cities, as strings. */
  cities: Set<string>
  wishes: Set<string>
  ready: boolean
}

const EMPTY: VisitState = {
  visited: new Set(),
  cityCount: new Map(),
  cities: new Set(),
  wishes: new Set(),
  ready: false,
}

export function useVisits(): VisitState {
  const rows = useLiveQuery(
    async () => ({
      visits: await db.visits.toArray(),
      wishes: await db.wishes.where('kind').equals('country').toArray(),
    }),
    [],
  )

  return useMemo(() => {
    if (!rows) return EMPTY
    const visited = new Set<string>()
    const cityCount = new Map<string, number>()
    const cities = new Set<string>()
    for (const v of rows.visits) {
      if (v.kind === 'country') visited.add(v.refId)
      else {
        visited.add(v.countryIso)
        cities.add(v.refId)
        cityCount.set(v.countryIso, (cityCount.get(v.countryIso) ?? 0) + 1)
      }
    }
    return {
      visited,
      cityCount,
      cities,
      wishes: new Set(rows.wishes.map((w) => w.refId)),
      ready: true,
    }
  }, [rows])
}

/** 0 unvisited · 1–4 lit, brighter with more cities · 5 on the wish list. */
export type PaintLevel = 0 | 1 | 2 | 3 | 4 | 5

export function litLevel(cities: number): PaintLevel {
  if (cities >= 6) return 4
  if (cities >= 3) return 3
  if (cities >= 1) return 2
  return 1
}
