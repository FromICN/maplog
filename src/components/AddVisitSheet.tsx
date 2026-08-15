import { useEffect, useMemo, useState } from 'react'
import { buildCountryTree, type Country, type World } from '../data/countries'
import { toggleCountryVisit, toggleWish } from '../db/db'
import { useVisits } from '../state/useVisits'
import { CheckIcon, CloseIcon, HeartIcon, SearchIcon } from './Icons'
import FlagMark from './FlagMark'
import './AddVisitSheet.css'

type Filter = 'all' | 'visited' | 'wish'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'visited', label: '다녀온 곳' },
  { id: 'wish', label: '가고 싶은 곳' },
]

type Props = { world: World; onClose: () => void }

export default function AddVisitSheet({ world, onClose }: Props) {
  const visits = useVisits()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tree = useMemo(() => buildCountryTree(world.countries), [world.countries])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (c: Country) => {
      if (filter === 'visited' && !visits.visited.has(c.iso2)) return false
      if (filter === 'wish' && !visits.wishes.has(c.iso2)) return false
      if (!q) return true
      return (
        c.ko.toLowerCase().includes(q) ||
        c.en.toLowerCase().includes(q) ||
        c.iso2.toLowerCase() === q ||
        c.iso3.toLowerCase() === q
      )
    }
  }, [query, filter, visits])

  // Searching flattens the tree: a territory should surface on its own name.
  const searching = query.trim().length > 0 || filter !== 'all'
  const groups = useMemo(() => {
    if (searching) {
      return world.countries
        .filter(matches)
        .sort((a, b) => a.ko.localeCompare(b.ko, 'ko'))
        .map((c) => ({ parent: c, children: [] as Country[], flat: true }))
    }
    return tree.sovereign.map((c) => ({
      parent: c,
      children: tree.children.get(c.iso2) ?? [],
      flat: false,
    }))
  }, [searching, matches, tree, world.countries])

  const total = groups.reduce((n, g) => n + 1 + g.children.length, 0)

  const stats = useMemo(() => {
    let count = 0
    let all = 0
    for (const c of world.countries) {
      if (!c.un) continue
      all++
      if (visits.visited.has(c.iso2)) count++
    }
    return { count, all }
  }, [world.countries, visits.visited])

  const row = (c: Country, nested: boolean) => (
    <li className="pick" key={c.iso2} data-nested={nested || undefined}>
      <FlagMark flag={c.flag} iso2={c.iso2} />
      <span className="pick__name">
        {c.ko}
        {searching && c.parent && (
          <span className="pick__parent">{world.byIso.get(c.parent)?.ko}</span>
        )}
      </span>
      <button
        className="pick__toggle pick__toggle--visit"
        aria-pressed={visits.visited.has(c.iso2)}
        aria-label={`${c.ko} 다녀온 곳으로 표시`}
        onClick={() => void toggleCountryVisit(c.iso2)}
      >
        <CheckIcon size={17} />
      </button>
      <button
        className="pick__toggle pick__toggle--wish"
        aria-pressed={visits.wishes.has(c.iso2)}
        aria-label={`${c.ko} 가고 싶은 곳으로 표시`}
        onClick={() => void toggleWish('country', c.iso2)}
      >
        <HeartIcon size={17} filled={visits.wishes.has(c.iso2)} />
      </button>
    </li>
  )

  return (
    <div className="addvisit" role="dialog" aria-modal="true" aria-label="방문 추가">
      <header className="addvisit__head">
        <div>
          <h2 className="addvisit__title">방문 추가</h2>
          <p className="addvisit__progress">
            <b>{stats.count}</b>/{stats.all} 개국
          </p>
        </div>
        <button className="addvisit__close" aria-label="닫기" onClick={onClose}>
          <CloseIcon size={22} />
        </button>
      </header>

      <div className="addvisit__filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className="chip"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="addvisit__list">
        {total === 0 ? (
          <p className="addvisit__empty">
            {filter === 'visited'
              ? '아직 다녀온 곳이 없습니다.'
              : filter === 'wish'
                ? '아직 담아 둔 곳이 없습니다.'
                : `"${query.trim()}"와 맞는 나라가 없습니다.`}
          </p>
        ) : (
          <ul className="addvisit__ul">
            {groups.map((g) => (
              <li key={g.parent.iso2}>
                <ul className="addvisit__ul">
                  {row(g.parent, false)}
                  {g.children.length > 0 && (
                    <li>
                      <ul className="addvisit__ul addvisit__branch">
                        {g.children.map((c) => row(c, true))}
                      </ul>
                    </li>
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="addvisit__search">
        <SearchIcon size={18} />
        <input
          type="search"
          value={query}
          placeholder="나라 이름이나 코드로 검색"
          aria-label="나라 검색"
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="addvisit__clear" aria-label="검색어 지우기" onClick={() => setQuery('')}>
            <CloseIcon size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
