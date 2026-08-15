import { CONTINENT_ORDER, type ContinentCode, type Country } from '../data/countries'
import { litLevel, type PaintLevel } from './useVisits'

export type ContinentRow = {
  code: ContinentCode
  /** UN countries on this continent, sorted by Korean name. */
  members: Country[]
  visited: Country[]
  /** Lit levels, brightest first — what the dot meter fills in with. */
  levels: PaintLevel[]
}

/** One pass over the registry, shared by the map summary and the passport. */
export function continentRows(
  countries: Country[],
  visited: Set<string>,
  cityCount: Map<string, number>,
): ContinentRow[] {
  const byCode = new Map<ContinentCode, Country[]>()
  for (const c of countries) {
    if (!c.un) continue
    const list = byCode.get(c.continent)
    if (list) list.push(c)
    else byCode.set(c.continent, [c])
  }

  const rows: ContinentRow[] = []
  for (const code of CONTINENT_ORDER) {
    const members = byCode.get(code)
    if (!members?.length) continue
    members.sort((a, b) => a.ko.localeCompare(b.ko, 'ko'))
    const been = members.filter((c) => visited.has(c.iso2))
    rows.push({
      code,
      members,
      visited: been,
      levels: been.map((c) => litLevel(cityCount.get(c.iso2) ?? 0)).sort((a, b) => b - a),
    })
  }
  return rows
}
