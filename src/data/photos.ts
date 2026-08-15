import exifr from 'exifr/dist/lite.esm.mjs'
import type { World } from './countries'
import { cityLabel, loadCities, type City } from './cities'
import { makeProjector } from '../map/projection'

/**
 * Photos are read in the browser and thrown away — only the coordinates matter,
 * and nothing is uploaded anywhere. Files never leave the device.
 */

/** Beyond this the nearest listed city is not where the photo was taken. */
const CITY_RADIUS_KM = 40

/**
 * GeoNames lists Paris's arrondissements as cities in their own right, so the
 * closest match to a photo taken by the Seine is "Paris 04 Hôtel-de-Ville".
 * Within this much of the nearest hit, the bigger place is the better answer.
 */
const PREFER_BIGGER_KM = 12

export type PhotoPlace = {
  key: string
  countryIso: string
  city: City | null
  distanceKm: number | null
  label: string
  photos: number
  /** Earliest shot date across the photos that landed here. */
  date?: string
}

export type PhotoScan = {
  places: PhotoPlace[]
  /** Photos with no GPS at all — usually screenshots or stripped exports. */
  noLocation: number
  /** Photos whose coordinates fall outside every country, like mid-ocean shots. */
  unmatched: number
}

type Found = { lat: number; lon: number; date?: string }

async function readLocation(file: File): Promise<Found | null> {
  try {
    const gps = (await exifr.gps(file)) as { latitude?: number; longitude?: number } | undefined
    if (!gps || typeof gps.latitude !== 'number' || typeof gps.longitude !== 'number') return null
    if (!Number.isFinite(gps.latitude) || !Number.isFinite(gps.longitude)) return null

    let date: string | undefined
    try {
      const meta = (await exifr.parse(file, ['DateTimeOriginal'])) as
        | { DateTimeOriginal?: Date }
        | undefined
      const taken = meta?.DateTimeOriginal
      if (taken instanceof Date && !Number.isNaN(taken.valueOf())) {
        date = taken.toISOString().slice(0, 10)
      }
    } catch {
      // A photo without a usable date still has a usable place.
    }
    return { lat: gps.latitude, lon: gps.longitude, date }
  } catch {
    return null
  }
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const R = 6371
  const toRad = Math.PI / 180
  const dLat = (bLat - aLat) * toRad
  const dLon = (bLon - aLon) * toRad
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/**
 * Countries the point could belong to, nearest cell first. One raster cell is
 * about 19 km wide, so a photo taken near a border can land on the wrong side —
 * the neighbours come along as candidates and the nearest real city decides.
 */
function countriesNear(world: World, x: number, y: number): string[] {
  const found: string[] = []
  const read = (px: number, py: number) => {
    if (px < 0 || py < 0 || px >= world.width || py >= world.height) return
    const index = world.grid[py * world.width + px]
    if (!index || index === world.landOther) return
    const iso = world.byIndex[index]?.iso2
    if (iso && !found.includes(iso)) found.push(iso)
  }
  read(x, y)
  for (let r = 1; r <= 3; r++) {
    for (let d = -r; d <= r; d++) {
      read(x + d, y - r)
      read(x + d, y + r)
      read(x - r, y + d)
      read(x + r, y + d)
    }
  }
  return found
}

export async function scanPhotos(
  world: World,
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<PhotoScan> {
  const project = makeProjector(world.projection)
  const found: (Found & { candidates: string[] })[] = []
  let noLocation = 0
  let unmatched = 0

  for (let i = 0; i < files.length; i++) {
    const location = await readLocation(files[i])
    onProgress?.(i + 1, files.length)
    if (!location) {
      noLocation++
      continue
    }
    const [px, py] = project(location.lon, location.lat)
    const candidates = countriesNear(world, Math.round(px), Math.round(py))
    if (!candidates.length) {
      unmatched++
      continue
    }
    found.push({ ...location, candidates })
  }

  const chunks = new Map<string, City[]>()
  for (const iso of new Set(found.flatMap((f) => f.candidates))) {
    chunks.set(iso, await loadCities(iso))
  }

  const places = new Map<string, PhotoPlace>()
  for (const hit of found) {
    // Search every neighbouring country at once: a city's coordinates are exact
    // where the raster is only 19 km precise, so the closest city settles both
    // which city this is and which country it is in.
    let nearestKm = Infinity
    const reachable: { city: City; km: number; iso: string }[] = []
    for (const iso of hit.candidates) {
      for (const city of chunks.get(iso) ?? []) {
        const km = haversineKm(hit.lat, hit.lon, city.lat, city.lon)
        if (km > CITY_RADIUS_KM) continue
        reachable.push({ city, km, iso })
        if (km < nearestKm) nearestKm = km
      }
    }

    let chosen: { city: City; km: number; iso: string } | null = null
    for (const option of reachable) {
      if (option.km > Math.max(nearestKm + PREFER_BIGGER_KM, PREFER_BIGGER_KM)) continue
      if (!chosen || option.city.population > chosen.city.population) chosen = option
    }

    const iso = chosen?.iso ?? hit.candidates[0]
    const country = world.byIso.get(iso)
    if (!country) continue
    const key = chosen ? `city:${chosen.city.id}` : `country:${iso}`

    const existing = places.get(key)
    if (existing) {
      existing.photos++
      if (hit.date && (!existing.date || hit.date < existing.date)) existing.date = hit.date
      continue
    }
    places.set(key, {
      key,
      countryIso: iso,
      city: chosen?.city ?? null,
      distanceKm: chosen ? Math.round(chosen.km) : null,
      label: chosen ? `${country.ko} · ${cityLabel(chosen.city)}` : country.ko,
      photos: 1,
      date: hit.date,
    })
  }

  return {
    places: [...places.values()].sort((a, b) => b.photos - a.photos || a.label.localeCompare(b.label, 'ko')),
    noLocation,
    unmatched,
  }
}
