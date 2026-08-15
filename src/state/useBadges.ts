import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef } from 'react'
import type { World } from '../data/countries'
import { db } from '../db/db'
import { useAppStore } from '../store/useAppStore'
import { evaluateBadges, type Badge } from './badges'
import { useCityCoords } from './useCityCoords'
import { useVisits } from './useVisits'

type BadgeData = {
  badges: Badge[]
  /** False until the visit records, city chunks and stored dates have all landed. */
  settled: boolean
}

/** Evaluates every badge. Pure — no writes, safe to call from any screen. */
export function useBadgeData(world: World | null): BadgeData {
  const visits = useVisits()
  const cityCountries = useMemo(() => new Set(visits.cityCount.keys()), [visits.cityCount])
  const { coords, ready: coordsReady } = useCityCoords(cityCountries)
  const stored = useLiveQuery(() => db.badges.toArray(), [])

  return useMemo(() => {
    if (!world || !visits.ready) return { badges: [], settled: false }

    const cities = []
    for (const id of visits.cities) {
      const city = coords.get(id)
      if (city) cities.push(city)
    }

    const badges = evaluateBadges({
      countries: world.countries,
      visited: visits.visited,
      cities,
      cityTotal: visits.cities.size,
    })

    const dates = new Map((stored ?? []).map((b) => [b.id, b.unlockedAt]))
    const merged = badges.map((b) => ({ ...b, unlockedAt: dates.get(b.id) }))

    // Geography rules read city coordinates, so nothing is final until the
    // chunks for every visited country have arrived.
    return { badges: merged, settled: coordsReady && stored !== undefined }
  }, [world, visits, coords, stored, coordsReady])
}

/**
 * Records when each badge was earned and announces the ones earned just now.
 * Mounted once, at the app root, so a badge earned on the map screen still shows.
 */
/** Long enough for the visit and badge queries to agree after a bulk change. */
const SETTLE_MS = 200

export function useBadgeWatcher(world: World | null) {
  const { badges, settled } = useBadgeData(world)
  const showToast = useAppStore((s) => s.showToast)
  /** What was unlocked last time we looked — null until the first quiet moment. */
  const previous = useRef<Set<string> | null>(null)

  useEffect(() => {
    if (!settled || !badges.length) return

    // Restoring a backup or clearing everything touches both tables at once, and
    // their live queries land separately. Waiting out the gap keeps a half-applied
    // state from being read as two dozen badges won and lost.
    const timer = setTimeout(() => {
      const unlocked = new Set(badges.filter((b) => b.unlocked).map((b) => b.id))
      const before = previous.current
      previous.current = unlocked

      const earned = badges.filter((b) => b.unlocked && b.unlockedAt === undefined)
      const lost = badges.filter((b) => !b.unlocked && b.unlockedAt !== undefined)
      if (earned.length || lost.length) {
        void db.transaction('rw', db.badges, async () => {
          if (earned.length) {
            const now = Date.now()
            await db.badges.bulkPut(earned.map((b) => ({ id: b.id, unlockedAt: now })))
          }
          // Undoing a visit takes the badge back rather than leaving a stale date.
          if (lost.length) await db.badges.bulkDelete(lost.map((b) => b.id))
        })
      }

      // Only a real locked-to-unlocked transition is worth announcing, so opening
      // the app on an existing record — or restoring a backup — stays quiet.
      if (!before || Date.now() < useAppStore.getState().badgeQuietUntil) return
      const fresh = badges.filter((b) => b.unlocked && !before.has(b.id))
      if (!fresh.length) return
      showToast(
        fresh.length === 1
          ? `배지 획득 · ${fresh[0].title}`
          : `배지 ${fresh.length}개 획득 · ${fresh[0].title} 외`,
      )
    }, SETTLE_MS)

    return () => clearTimeout(timer)
  }, [badges, settled, showToast])
}
