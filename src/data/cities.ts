export type City = {
  id: number
  /** Local or international name, as GeoNames records it. */
  name: string
  /** Korean name where GeoNames has a language-tagged one. */
  ko: string
  lat: number
  lon: number
  population: number
  /** State or province, for telling apart the many Springfields. */
  admin: string | null
}

/** What the picker shows as the primary label. */
export function cityLabel(c: City) {
  return c.ko || c.name
}

type Chunk = { admins: string[]; cities: [number, string, string, number, number, number, number][] }

const chunks = new Map<string, Promise<City[]>>()
let index: Promise<Record<string, number>> | null = null

/** How many cities exist per country, so the UI can say so before loading one. */
export function loadCityIndex(): Promise<Record<string, number>> {
  index ??= fetch(`${import.meta.env.BASE_URL}data/cities/index.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
  return index
}

/** Cities for one country, fetched once and kept for the session. */
export function loadCities(iso2: string): Promise<City[]> {
  let pending = chunks.get(iso2)
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}data/cities/${iso2}.json`)
      .then(async (r) => {
        if (!r.ok) return []
        const chunk: Chunk = await r.json()
        return chunk.cities.map(([id, name, ko, lat, lon, population, adminIdx]) => ({
          id,
          name,
          ko,
          lat,
          lon,
          population,
          admin: adminIdx >= 0 ? (chunk.admins[adminIdx] ?? null) : null,
        }))
      })
      .catch(() => [])
    chunks.set(iso2, pending)
  }
  return pending
}
