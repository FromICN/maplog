import './FlagMark.css'

/**
 * Windows ships no flag emoji at all — Chrome there draws 🇬🇭 as the letters
 * "GH". Rather than fight it, detect once and fall back to the country's code
 * set in the data face, which is what the rest of the app uses for codes anyway.
 */
let cached: boolean | null = null

function supportsFlagEmoji(): boolean {
  if (cached !== null) return cached
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 16
    canvas.height = 16
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return (cached = false)
    ctx.textBaseline = 'top'
    ctx.font = '14px sans-serif'
    ctx.fillStyle = '#000'
    ctx.fillText('\u{1F1E8}\u{1F1E6}', 0, 0) // Canada: red and white, if it renders at all
    const { data } = ctx.getImageData(0, 0, 16, 16)
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue
      // Letter fallback is drawn in the fill colour; a real flag brings its own.
      if (data[i] > 60 || data[i + 1] > 60 || data[i + 2] > 60) return (cached = true)
    }
    return (cached = false)
  } catch {
    return (cached = false)
  }
}

type Props = { flag: string; iso2: string; size?: 'sm' | 'lg' }

export default function FlagMark({ flag, iso2, size = 'sm' }: Props) {
  return supportsFlagEmoji() ? (
    <span className="flagmark" data-size={size} aria-hidden>
      {flag}
    </span>
  ) : (
    <span className="flagmark flagmark--code" data-size={size} aria-hidden>
      {iso2}
    </span>
  )
}
