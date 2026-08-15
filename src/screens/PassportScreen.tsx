import { useMemo, useState } from 'react'
import { CONTINENT_KO, type Country } from '../data/countries'
import { useWorld } from '../map/useWorld'
import { useVisits, type PaintLevel } from '../state/useVisits'
import { continentRows } from '../state/continentStats'
import { useAppStore } from '../store/useAppStore'
import CountrySheet from '../components/CountrySheet'
import DotMeter from '../components/DotMeter'
import FlagMark from '../components/FlagMark'
import { PlusIcon } from '../components/Icons'
import './PassportScreen.css'

export default function PassportScreen() {
  const { world } = useWorld()
  const visits = useVisits()
  const openAddVisit = useAppStore((s) => s.openAddVisit)
  const [selected, setSelected] = useState<Country | null>(null)

  const rows = useMemo(
    () => (world ? continentRows(world.countries, visits.visited, visits.cityCount) : []),
    [world, visits.visited, visits.cityCount],
  )

  /** The whole world as one bar: every continent's lit dots pooled, brightest first. */
  const totals = useMemo(() => {
    const levels: PaintLevel[] = []
    let total = 0
    for (const row of rows) {
      total += row.members.length
      levels.push(...row.levels)
    }
    levels.sort((a, b) => b - a)
    return { total, levels }
  }, [rows])

  const total = totals.total
  const been = rows.reduce((n, r) => n + r.visited.length, 0)
  const percent = total ? Math.round((been / total) * 100) : 0
  const cityTotal = [...visits.cityCount.values()].reduce((a, b) => a + b, 0)

  if (!world) {
    return (
      <div className="placeholder">
        <p className="placeholder__title">여권 준비 중</p>
      </div>
    )
  }

  return (
    <div className="passport">
      <div className="passport__scroll">
        <section className="card passport__total">
          <p className="eyebrow">다녀온 나라</p>
          <p className="passport__figure">
            <span className="passport__now">{been}</span>
            <span className="passport__of">/ {total}</span>
            <span className="passport__pct">{percent}%</span>
          </p>

          <div className="passport__bar">
            <DotMeter
              total={total}
              levels={totals.levels}
              wrap
              label={`유엔 ${total}개국 가운데 ${been}개국 방문`}
            />
          </div>
          <p className="passport__caption">
            점 하나가 나라 하나입니다. 유엔 {total}개국 기준.
          </p>
        </section>

        {been === 0 ? (
          <div className="passport__empty">
            <p>기록을 남기면 다녀온 나라가 대륙별로 쌓입니다.</p>
            <button className="passport__add" onClick={openAddVisit}>
              <PlusIcon size={18} />
              방문 추가
            </button>
          </div>
        ) : (
          <section className="passport__section">
            <div className="passport__sectionhead">
              <h2 className="passport__h2">내 국가</h2>
              <p className="passport__sub">
                도시 <span className="passport__num">{cityTotal}</span>곳 기록
              </p>
            </div>

            {rows.map(({ code, members, visited: been, levels }) => (
              <div className="conti" key={code}>
                <div className="conti__head">
                  <span className="conti__name">{CONTINENT_KO[code]}</span>
                  <span className="conti__count">
                    <b>{been.length}</b>/{members.length}
                  </span>
                </div>
                <DotMeter
                  total={members.length}
                  levels={levels}
                  label={`${CONTINENT_KO[code]} ${members.length}개국 중 ${been.length}개국 방문`}
                />
                {been.length > 0 && (
                  <ul className="conti__list">
                    {been.map((c) => {
                      const cities = visits.cityCount.get(c.iso2) ?? 0
                      return (
                        <li key={c.iso2}>
                          <button className="visited" onClick={() => setSelected(c)}>
                            <FlagMark flag={c.flag} iso2={c.iso2} />
                            <span className="visited__name">{c.ko}</span>
                            {cities > 0 && <span className="visited__cities">{cities}</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ))}
          </section>
        )}
      </div>

      {selected && (
        <CountrySheet
          country={selected}
          visited={visits.visited.has(selected.iso2)}
          wished={visits.wishes.has(selected.iso2)}
          cities={visits.cityCount.get(selected.iso2) ?? 0}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
