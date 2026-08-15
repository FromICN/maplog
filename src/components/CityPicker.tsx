import { useEffect, useMemo, useState } from 'react'
import type { Country } from '../data/countries'
import { cityLabel, loadCities, type City } from '../data/cities'
import { toggleCityVisit } from '../db/db'
import { useVisits } from '../state/useVisits'
import { CheckIcon, CloseIcon, SearchIcon } from './Icons'
import './CityPicker.css'

/** Long lists stay responsive by rendering a slice; search narrows the rest. */
const PAGE = 120

type Props = { country: Country; onClose: () => void }

export default function CityPicker({ country, onClose }: Props) {
  const visits = useVisits()
  const [all, setAll] = useState<City[] | null>(null)
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    let alive = true
    loadCities(country.iso2).then((list) => alive && setAll(list))
    return () => {
      alive = false
    }
  }, [country.iso2])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const matched = useMemo(() => {
    if (!all) return []
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all.filter(
      (c) =>
        c.ko.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.admin?.toLowerCase().includes(q) ?? false),
    )
  }, [all, query])

  // Logged cities float to the top so the list doubles as a record.
  const ordered = useMemo(() => {
    const been: City[] = []
    const rest: City[] = []
    for (const c of matched) (visits.cities.has(String(c.id)) ? been : rest).push(c)
    return [...been, ...rest]
  }, [matched, visits.cities])

  const chosen = ordered.filter((c) => visits.cities.has(String(c.id))).length

  return (
    <div className="cities" role="dialog" aria-modal="true" aria-label={`${country.ko} 도시`}>
      <header className="cities__head">
        <div>
          <h2 className="cities__title">{country.ko}</h2>
          <p className="cities__progress">
            도시 <b>{visits.cityCount.get(country.iso2) ?? 0}</b>곳 기록
          </p>
        </div>
        <button className="cities__close" aria-label="닫기" onClick={onClose}>
          <CloseIcon size={22} />
        </button>
      </header>

      <div className="cities__list">
        {all === null ? (
          <p className="cities__note">도시 목록을 불러오는 중입니다.</p>
        ) : all.length === 0 ? (
          <p className="cities__note">{country.ko}에는 등록된 도시가 없습니다.</p>
        ) : ordered.length === 0 ? (
          <p className="cities__note">"{query.trim()}"와 맞는 도시가 없습니다.</p>
        ) : (
          <>
            <ul className="cities__ul">
              {ordered.slice(0, limit).map((c) => {
                const on = visits.cities.has(String(c.id))
                return (
                  <li className="city" key={c.id}>
                    <span className="city__text">
                      <span className="city__name">{cityLabel(c)}</span>
                      <span className="city__meta">
                        {c.ko && c.ko !== c.name && <span>{c.name}</span>}
                        {/* Metropolitan cities are their own province; saying so twice helps nobody. */}
                        {c.admin && c.admin !== c.name && <span>{c.admin}</span>}
                        {c.population > 0 && (
                          <span className="city__pop">{formatPopulation(c.population)}</span>
                        )}
                      </span>
                    </span>
                    <button
                      className="city__toggle"
                      aria-pressed={on}
                      aria-label={`${cityLabel(c)} 다녀온 곳으로 표시`}
                      onClick={() => void toggleCityVisit(c.id, country.iso2)}
                    >
                      <CheckIcon size={17} />
                    </button>
                  </li>
                )
              })}
            </ul>
            {ordered.length > limit && (
              <button className="cities__more" onClick={() => setLimit((n) => n + PAGE)}>
                {ordered.length - limit}곳 더 보기
              </button>
            )}
          </>
        )}
      </div>

      <div className="cities__search">
        <SearchIcon size={18} />
        <input
          type="search"
          value={query}
          placeholder={all ? `${all.length}곳에서 검색` : '도시 검색'}
          aria-label="도시 검색"
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(PAGE)
          }}
        />
        {query && (
          <button className="cities__clear" aria-label="검색어 지우기" onClick={() => setQuery('')}>
            <CloseIcon size={16} />
          </button>
        )}
      </div>
      <p className="cities__hint" aria-live="polite">
        {chosen > 0 ? `이 목록에서 ${chosen}곳 선택됨` : '인구 많은 순으로 보여 줍니다.'}
      </p>
    </div>
  )
}

function formatPopulation(n: number) {
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString('ko-KR')}만`
  return n.toLocaleString('ko-KR')
}
