import { CONTINENT_KO, CONTINENT_ORDER, type ContinentCode, type Country } from '../data/countries'
import type { City } from '../data/cities'

/**
 * Badges are derived, never stored. Everything here reads the same visit records
 * the map and passport read, so a badge can never disagree with the map.
 */

export type BadgeGroup = 'continent' | 'milestone' | 'geography'

export type BadgeContext = {
  countries: Country[]
  visited: Set<string>
  /** Cities logged, with coordinates — only for countries whose chunk is loaded. */
  cities: City[]
  cityTotal: number
}

export type BadgeDef = {
  id: string
  group: BadgeGroup
  title: string
  /** What it takes, shown while the badge is still locked. */
  hint: string
  /** Continent badges draw the real continent; the rest draw a block of dots. */
  continent?: ContinentCode
  measure: (ctx: BadgeContext) => { now: number; total: number }
}

export type Badge = BadgeDef & {
  now: number
  total: number
  unlocked: boolean
  unlockedAt?: number
}

/** Sovereign island states — no land border with anyone. */
const ISLAND_STATES = new Set([
  'AG','BS','BB','CV','KM','CU','CY','DM','FJ','GD','IS','ID','IE','JM','JP','KI','MG','MV','MH',
  'MT','MU','FM','NR','NZ','PW','PG','PH','WS','ST','SC','SG','SB','LK','TO','TT','TV','VU','GB',
  'KN','LC','VC',
])

/** The six smallest states in Europe — a set you can only complete on purpose. */
const MICROSTATES = ['MC', 'VA', 'SM', 'LI', 'AD', 'MT']

const ARCTIC_CIRCLE = 66.5

function unCountries(ctx: BadgeContext) {
  return ctx.countries.filter((c) => c.un)
}

function visitedUn(ctx: BadgeContext) {
  return unCountries(ctx).filter((c) => ctx.visited.has(c.iso2)).length
}

function countryMilestone(target: number, title: string): BadgeDef {
  return {
    id: `countries-${target}`,
    group: 'milestone',
    title,
    hint: `${target}개국 방문`,
    measure: (ctx) => ({ now: Math.min(visitedUn(ctx), target), total: target }),
  }
}

function cityMilestone(target: number): BadgeDef {
  return {
    id: `cities-${target}`,
    group: 'milestone',
    title: `도시 ${target}곳`,
    hint: `도시 ${target}곳 기록`,
    measure: (ctx) => ({ now: Math.min(ctx.cityTotal, target), total: target }),
  }
}

export const BADGES: BadgeDef[] = [
  ...CONTINENT_ORDER.filter((code) => code !== 'AN').map<BadgeDef>((code) => ({
    id: `continent-${code}`,
    group: 'continent',
    title: CONTINENT_KO[code],
    hint: `${CONTINENT_KO[code]} 전체 방문`,
    continent: code,
    measure: (ctx) => {
      const members = unCountries(ctx).filter((c) => c.continent === code)
      return {
        now: members.filter((c) => ctx.visited.has(c.iso2)).length,
        total: members.length,
      }
    },
  })),

  countryMilestone(1, '첫 발자국'),
  countryMilestone(5, '5개국'),
  countryMilestone(10, '10개국'),
  countryMilestone(25, '25개국'),
  countryMilestone(50, '50개국'),
  countryMilestone(100, '100개국'),
  countryMilestone(195, '195개국'),
  cityMilestone(10),
  cityMilestone(50),
  cityMilestone(100),
  cityMilestone(250),

  {
    id: 'geo-equator',
    group: 'geography',
    title: '적도 양쪽',
    hint: '북반구와 남반구 모두에 도시 기록',
    measure: (ctx) => {
      let north = 0
      let south = 0
      for (const c of ctx.cities) {
        if (c.lat >= 0) north = 1
        else south = 1
      }
      return { now: north + south, total: 2 }
    },
  },
  {
    id: 'geo-arctic',
    group: 'geography',
    title: '북극권',
    hint: '북위 66.5도 위쪽 도시 기록',
    measure: (ctx) => ({
      now: ctx.cities.some((c) => c.lat >= ARCTIC_CIRCLE) ? 1 : 0,
      total: 1,
    }),
  },
  {
    id: 'geo-deep-south',
    group: 'geography',
    title: '남위 40도',
    hint: '남위 40도 아래쪽 도시 기록',
    measure: (ctx) => ({
      now: ctx.cities.some((c) => c.lat <= -40) ? 1 : 0,
      total: 1,
    }),
  },
  {
    id: 'geo-microstates',
    group: 'geography',
    title: '소국 순례',
    hint: '모나코·바티칸·산마리노·리히텐슈타인·안도라·몰타',
    measure: (ctx) => ({
      now: MICROSTATES.filter((iso) => ctx.visited.has(iso)).length,
      total: MICROSTATES.length,
    }),
  },
  {
    id: 'geo-islands',
    group: 'geography',
    title: '섬나라 10곳',
    hint: '육지 국경이 없는 나라 10곳',
    measure: (ctx) => {
      let n = 0
      for (const iso of ctx.visited) if (ISLAND_STATES.has(iso)) n++
      return { now: Math.min(n, 10), total: 10 }
    },
  },
  {
    // Counted in hours rather than degrees: one dot is one hour of time
    // difference, which is a thing a traveller actually feels.
    id: 'geo-longitude',
    group: 'geography',
    title: '시차 12시간',
    hint: '기록한 도시의 동서 폭이 12시간 이상',
    measure: (ctx) => {
      if (ctx.cities.length < 2) return { now: 0, total: 12 }
      let min = 180
      let max = -180
      for (const c of ctx.cities) {
        if (c.lon < min) min = c.lon
        if (c.lon > max) max = c.lon
      }
      return { now: Math.min(Math.floor((max - min) / 15), 12), total: 12 }
    },
  },
]

export const GROUP_KO: Record<BadgeGroup, string> = {
  continent: '대륙',
  milestone: '누적',
  geography: '지리',
}

export const GROUP_ORDER: BadgeGroup[] = ['continent', 'milestone', 'geography']

export function evaluateBadges(ctx: BadgeContext): Badge[] {
  return BADGES.map((def) => {
    const { now, total } = def.measure(ctx)
    return { ...def, now, total, unlocked: total > 0 && now >= total }
  })
}
