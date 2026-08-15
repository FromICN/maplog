import type { PaintLevel } from '../state/useVisits'
import './DotMeter.css'

/**
 * A bar made of the map's own dots: one per country, lit ones first. Row length
 * is the total, so two continents can be compared by eye and either can be counted.
 * `wrap` lets the same bar carry all 195 without changing the dot size.
 */
type Props = { total: number; levels: PaintLevel[]; label: string; wrap?: boolean }

export default function DotMeter({ total, levels, label, wrap }: Props) {
  return (
    <div className="dotmeter" data-wrap={wrap || undefined} role="img" aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="dotmeter__dot" data-level={levels[i] ?? 0} />
      ))}
    </div>
  )
}
