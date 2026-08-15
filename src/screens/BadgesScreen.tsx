import { useMemo } from 'react'
import { useWorld } from '../map/useWorld'
import { buildContinentGlyphs } from '../map/continentGlyphs'
import { useBadgeData } from '../state/useBadges'
import { useVisits } from '../state/useVisits'
import { GROUP_KO, GROUP_ORDER } from '../state/badges'
import BadgeCard from '../components/BadgeCard'
import './BadgesScreen.css'

export default function BadgesScreen() {
  const { world } = useWorld()
  const visits = useVisits()
  const { badges } = useBadgeData(world)

  const glyphs = useMemo(() => (world ? buildContinentGlyphs(world) : null), [world])

  const earned = badges.filter((b) => b.unlocked).length

  if (!world || !badges.length) {
    return (
      <div className="placeholder">
        <p className="placeholder__title">배지 준비 중</p>
      </div>
    )
  }

  return (
    <div className="badges">
      <div className="badges__scroll">
        <header className="badges__head">
          <p className="eyebrow">획득한 배지</p>
          <p className="badges__count">
            <span className="badges__now">{earned}</span>
            <span className="badges__total">/ {badges.length}</span>
          </p>
        </header>

        {GROUP_ORDER.map((group) => {
          const rows = badges.filter((b) => b.group === group)
          if (!rows.length) return null
          return (
            <section className="badges__group" key={group}>
              <h2 className="badges__h2">{GROUP_KO[group]}</h2>
              <div className="badges__grid">
                {rows.map((badge) => (
                  <BadgeCard
                    key={badge.id}
                    badge={badge}
                    glyph={badge.continent ? glyphs?.get(badge.continent) : undefined}
                    visited={visits.visited}
                  />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
