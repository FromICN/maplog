import Dexie, { type EntityTable } from 'dexie'

export type VisitKind = 'country' | 'city'

export type Visit = {
  id?: number
  kind: VisitKind
  /** ISO alpha-2 for countries, city id for cities. */
  refId: string
  countryIso: string
  startDate?: string
  endDate?: string
  note?: string
  createdAt: number
}

export type Wish = {
  id?: number
  kind: VisitKind
  refId: string
  createdAt: number
}

/** Only the moment of earning is stored; whether a badge is earned is derived. */
export type BadgeRecord = {
  id: string
  unlockedAt: number
}

const db = new Dexie('maplog') as Dexie & {
  visits: EntityTable<Visit, 'id'>
  wishes: EntityTable<Wish, 'id'>
  badges: EntityTable<BadgeRecord, 'id'>
}

db.version(1).stores({
  visits: '++id, kind, refId, countryIso, tripId, startDate, [kind+refId]',
  wishes: '++id, kind, refId, &[kind+refId]',
  trips: '++id, startDate',
})

// Trips were dropped from the product. Version 2 deletes the table and the
// index that pointed at it; anyone who already opened version 1 gets migrated.
db.version(2).stores({
  visits: '++id, kind, refId, countryIso, startDate, [kind+refId]',
  trips: null,
})

db.version(3).stores({
  badges: 'id, unlockedAt',
})

export { db }

export async function toggleCountryVisit(iso: string) {
  const existing = await db.visits.where({ kind: 'country', refId: iso }).first()
  if (existing?.id) {
    await db.visits.delete(existing.id)
    return false
  }
  await db.visits.add({ kind: 'country', refId: iso, countryIso: iso, createdAt: Date.now() })
  return true
}

/**
 * Logging a city implies you were in the country, so the country visit is
 * created alongside it — and removing the last city leaves the country visited.
 */
export async function toggleCityVisit(cityId: number, countryIso: string) {
  const refId = String(cityId)
  const existing = await db.visits.where({ kind: 'city', refId }).first()
  if (existing?.id) {
    await db.visits.delete(existing.id)
    return false
  }
  await db.transaction('rw', db.visits, async () => {
    const country = await db.visits.where({ kind: 'country', refId: countryIso }).first()
    if (!country) {
      await db.visits.add({
        kind: 'country',
        refId: countryIso,
        countryIso,
        createdAt: Date.now(),
      })
    }
    await db.visits.add({ kind: 'city', refId, countryIso, createdAt: Date.now() })
  })
  return true
}

export type VisitEntry = {
  countryIso: string
  cityId?: number
  /** Shot date from a photo, YYYY-MM-DD. */
  startDate?: string
}

/**
 * Adds places without disturbing what is already recorded — importing the same
 * photos twice should not create duplicates or move dates around.
 */
export async function addVisits(entries: VisitEntry[]) {
  let added = 0
  await db.transaction('rw', db.visits, async () => {
    for (const entry of entries) {
      const country = await db.visits
        .where({ kind: 'country', refId: entry.countryIso })
        .first()
      if (!country) {
        await db.visits.add({
          kind: 'country',
          refId: entry.countryIso,
          countryIso: entry.countryIso,
          startDate: entry.startDate,
          createdAt: Date.now(),
        })
        added++
      }
      if (entry.cityId === undefined) continue
      const refId = String(entry.cityId)
      const city = await db.visits.where({ kind: 'city', refId }).first()
      if (city) continue
      await db.visits.add({
        kind: 'city',
        refId,
        countryIso: entry.countryIso,
        startDate: entry.startDate,
        createdAt: Date.now(),
      })
      added++
    }
  })
  return added
}

export async function toggleWish(kind: VisitKind, refId: string) {
  const existing = await db.wishes.where({ kind, refId }).first()
  if (existing?.id) {
    await db.wishes.delete(existing.id)
    return false
  }
  await db.wishes.add({ kind, refId, createdAt: Date.now() })
  return true
}
