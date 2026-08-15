import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import DotMap from '../map/DotMap'
import { useWorld } from '../map/useWorld'
import { useCityPins } from '../map/useCityPins'
import { useCityCoords } from '../state/useCityCoords'
import { useVisits, litLevel } from '../state/useVisits'
import { useAppStore } from '../store/useAppStore'
import CountrySheet from '../components/CountrySheet'
import ContinentMeters from '../components/ContinentMeters'
import { PhotoIcon, PlusIcon } from '../components/Icons'
import './MapScreen.css'

/** Breathing room between the world band and the panel below it. */
const GUTTER = 24
const HEADER_SPACE = 92

export default function MapScreen() {
  const { world, error } = useWorld()
  const visits = useVisits()
  const selectedIso = useAppStore((s) => s.selectedIso)
  const selectCountry = useAppStore((s) => s.selectCountry)
  const openAddVisit = useAppStore((s) => s.openAddVisit)
  const openPhotoImport = useAppStore((s) => s.openPhotoImport)
  const [zoomedIn, setZoomedIn] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [inset, setInset] = useState({ top: HEADER_SPACE, bottom: 400 })

  // The panel's height depends on the viewport, so the map asks it directly
  // rather than guessing where the free space ends.
  useLayoutEffect(() => {
    const node = bottomRef.current
    if (!node) return
    const measure = () => setInset({ top: HEADER_SPACE, bottom: node.offsetHeight + GUTTER })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(node)
    return () => ro.disconnect()
  }, [world])

  const paint = useMemo(() => {
    const table = new Uint8Array(256)
    if (!world) return table
    for (const c of world.countries) {
      if (visits.visited.has(c.iso2)) table[c.i] = litLevel(visits.cityCount.get(c.iso2) ?? 0)
      else if (visits.wishes.has(c.iso2)) table[c.i] = 5
    }
    return table
  }, [world, visits])

  const stats = useMemo(() => {
    if (!world) return { count: 0, total: 195, percent: 0 }
    let count = 0
    let total = 0
    for (const c of world.countries) {
      if (!c.un) continue
      total++
      if (visits.visited.has(c.iso2)) count++
    }
    return { count, total, percent: Math.round((count / total) * 100) }
  }, [world, visits.visited])

  const cityCountries = useMemo(() => new Set(visits.cityCount.keys()), [visits.cityCount])
  const { coords: cityCoords } = useCityCoords(cityCountries)
  const cityPins = useCityPins(world, visits.cities, cityCoords)

  const selected = selectedIso ? world?.byIso.get(selectedIso) : undefined
  const handleSelect = useCallback((iso: string | null) => selectCountry(iso), [selectCountry])

  if (error) {
    return (
      <div className="placeholder">
        <p className="placeholder__title">지도를 불러오지 못했습니다</p>
        <p>{error}</p>
      </div>
    )
  }

  if (!world) {
    return (
      <div className="placeholder">
        <p className="placeholder__title">지도 준비 중</p>
      </div>
    )
  }

  return (
    <div className="mapscreen">
      <DotMap
        world={world}
        paint={paint}
        selectedIndex={selected?.i ?? -1}
        cities={cityPins}
        onSelect={handleSelect}
        inset={inset}
        onZoomChange={setZoomedIn}
      />

      <header className="mapscreen__stat">
        <p className="eyebrow">다녀온 나라</p>
        <p className="mapscreen__count">
          <span className="mapscreen__now">{stats.count}</span>
          <span className="mapscreen__total">/ {stats.total}</span>
          <span className="mapscreen__pct">{stats.percent}%</span>
        </p>
      </header>

      <div className="mapscreen__bottom" ref={bottomRef} data-hidden={zoomedIn || undefined}>
        <div className="mapscreen__action">
          {visits.ready && stats.count === 0 && (
            <p className="mapscreen__hint">지도를 눌러도, 목록에서 골라도 됩니다.</p>
          )}
          <div className="mapscreen__buttons">
            <button className="mapscreen__add" onClick={openAddVisit}>
              <PlusIcon size={18} />
              방문 추가
            </button>
            <button className="mapscreen__photos" onClick={openPhotoImport}>
              <PhotoIcon size={18} />
              사진에서
            </button>
          </div>
        </div>
        <div className="mapscreen__summary">
          <ContinentMeters
            countries={world.countries}
            visited={visits.visited}
            cityCount={visits.cityCount}
          />
        </div>
      </div>

      {selected && (
        <CountrySheet
          country={selected}
          visited={visits.visited.has(selected.iso2)}
          wished={visits.wishes.has(selected.iso2)}
          cities={visits.cityCount.get(selected.iso2) ?? 0}
          onClose={() => selectCountry(null)}
        />
      )}
    </div>
  )
}
