import type { Badge } from '../state/badges'
import type { Glyph } from '../map/continentGlyphs'
import './BadgeCard.css'

/** Biggest dot block we draw; past this the number carries the truth, not the dots. */
const MAX_DOTS = 50

type Props = { badge: Badge; glyph?: Glyph; visited: Set<string> }

export default function BadgeCard({ badge, glyph, visited }: Props) {
  const { now, total, unlocked } = badge

  return (
    <article className="badge" data-unlocked={unlocked || undefined}>
      <div className="badge__figure">
        {glyph ? (
          <ContinentFigure glyph={glyph} visited={visited} />
        ) : (
          <DotBlock now={now} total={total} />
        )}
      </div>
      <h3 className="badge__title">{badge.title}</h3>
      {/* A one-step badge is fully told by its dot and its note. */}
      {total > 1 && (
        <p className="badge__meta">
          <b>{now}</b>/{total}
        </p>
      )}
      <p className="badge__note">
        {unlocked && badge.unlockedAt ? formatDate(badge.unlockedAt) : badge.hint}
      </p>
    </article>
  )
}

/** The continent as it really looks, cut from the world raster. */
function ContinentFigure({ glyph, visited }: { glyph: Glyph; visited: Set<string> }) {
  return (
    <svg viewBox={`0 0 ${glyph.cols} ${glyph.rows}`} className="badge__glyph" aria-hidden>
      {glyph.cells.map((cell, i) => (
        <circle
          key={i}
          cx={cell.c + 0.5}
          cy={cell.r + 0.5}
          r={0.38}
          className={visited.has(cell.iso) ? 'on' : undefined}
        />
      ))}
    </svg>
  )
}

function DotBlock({ now, total }: { now: number; total: number }) {
  const shown = Math.min(total, MAX_DOTS)
  const lit = total <= MAX_DOTS ? now : Math.round((now / total) * shown)
  const cols = Math.ceil(Math.sqrt(shown))
  // One- and two-step badges have nothing else in the figure, so their dots
  // carry it at a larger size.
  const dot = shown <= 2 ? 20 : 12
  return (
    <div
      className="badge__dots"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        maxWidth: `${cols * dot + (cols - 1) * 4}px`,
      }}
      aria-hidden
    >
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} data-on={i < lit || undefined} />
      ))}
    </div>
  )
}

function formatDate(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
