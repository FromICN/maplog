import type { ProjectionSpec } from '../map/projection'

export type ContinentCode = 'AS' | 'EU' | 'AF' | 'NA' | 'SA' | 'OC' | 'AN'

export type Country = {
  /** Index used inside the world grid raster. */
  i: number
  iso2: string
  iso3: string
  ko: string
  en: string
  flag: string
  continent: ContinentCode
  /** Counts toward the 195. */
  un: boolean
  /** Sovereign state this territory belongs to. */
  parent: string | null
  /** Grid cell that always represents this country, even at low zoom. */
  anchor: [number, number] | null
  cells: number
}

export type World = {
  width: number
  height: number
  landOther: number
  projection: ProjectionSpec
  grid: Uint8Array
  countries: Country[]
  byIso: Map<string, Country>
  byIndex: (Country | undefined)[]
}

export const CONTINENT_KO: Record<ContinentCode, string> = {
  EU: '유럽',
  AS: '아시아',
  AF: '아프리카',
  NA: '북아메리카',
  SA: '남아메리카',
  OC: '오세아니아',
  AN: '남극',
}

export const CONTINENT_ORDER: ContinentCode[] = ['EU', 'AS', 'AF', 'NA', 'SA', 'OC', 'AN']

type Registry = {
  width: number
  height: number
  landOther: number
  projection: ProjectionSpec
  countries: Country[]
}

let pending: Promise<World> | null = null

/** Loads the raster and the registry once, then hands the same object to every caller. */
export function loadWorld(): Promise<World> {
  if (pending) return pending
  pending = (async () => {
    const [registry, buffer] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/countries.json`).then(
        (r) => r.json() as Promise<Registry>,
      ),
      fetch(`${import.meta.env.BASE_URL}data/world-grid.bin`).then((r) => r.arrayBuffer()),
    ])

    const head = new DataView(buffer)
    const magic = String.fromCharCode(head.getUint8(0), head.getUint8(1), head.getUint8(2), head.getUint8(3))
    if (magic !== 'MLG1') throw new Error(`world-grid.bin: unexpected header "${magic}"`)
    const width = head.getUint16(4, true)
    const height = head.getUint16(6, true)
    if (width !== registry.width || height !== registry.height) {
      throw new Error('world-grid.bin and countries.json disagree on grid size')
    }

    const byIndex: (Country | undefined)[] = []
    const byIso = new Map<string, Country>()
    for (const c of registry.countries) {
      byIndex[c.i] = c
      byIso.set(c.iso2, c)
    }

    return {
      width,
      height,
      landOther: registry.landOther,
      projection: registry.projection,
      grid: new Uint8Array(buffer, 8, width * height),
      countries: registry.countries,
      byIso,
      byIndex,
    }
  })()
  return pending
}

/** Sovereign states first, each followed by its territories — the add-visit ordering. */
export function buildCountryTree(countries: Country[]) {
  const sovereign = countries
    .filter((c) => !c.parent)
    .sort((a, b) => a.ko.localeCompare(b.ko, 'ko'))
  const children = new Map<string, Country[]>()
  for (const c of countries) {
    if (!c.parent) continue
    const list = children.get(c.parent) ?? []
    list.push(c)
    children.set(c.parent, list)
  }
  for (const list of children.values()) list.sort((a, b) => a.ko.localeCompare(b.ko, 'ko'))
  return { sovereign, children }
}
