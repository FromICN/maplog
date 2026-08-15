/**
 * Cuts Pretendard down to the glyphs this app can actually display.
 *
 * The full variable font is 2 MB and a PWA pays that on install, but almost all
 * of it is the 11,172 Hangul syllables — and this app's Korean is fixed at build
 * time: country and city names come from the generated data files, and the rest
 * is UI copy in the source. So the set is scanned rather than guessed.
 *
 * Runs as part of `npm run build`; the output is deterministic, so an unchanged
 * app produces an identical file and the service worker leaves it alone.
 *
 * Anything outside the scan — a syllable typed into the search box, say — falls
 * back to the system Korean face rather than rendering as tofu.
 *
 * Usage: node scripts/build-fonts.mjs
 */
import subsetFont from 'subset-font'
import { readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(
  ROOT,
  'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2',
)
/**
 * Emitted into src/, not public/, so Vite fingerprints them and rewrites the
 * URLs for whatever base path the site is deployed under — GitHub Pages project
 * sites live at /<repo>/, where an absolute /fonts/… would 404.
 */
const OUT = resolve(ROOT, 'src', 'assets', 'fonts')

/** Latin, punctuation and symbols are cheap, so they are kept wholesale. */
const RANGES = [
  [0x0020, 0x007e], // Basic Latin
  [0x00a0, 0x00ff], // Latin-1: accents in city names, the · separator
  [0x0100, 0x017f], // Latin Extended-A: Tromsø, Kraków, Malmö
  [0x2010, 0x2027], // dashes, quotes, ellipsis
  [0x2030, 0x205e], // per-mille, primes, bullets
  [0x20a0, 0x20bf], // currency
  [0x3000, 0x303f], // CJK punctuation
]

const HANGUL_START = 0xac00
const HANGUL_END = 0xd7a3

const hangul = new Set()
function scan(text) {
  for (const ch of text) {
    const cp = ch.codePointAt(0)
    if (cp !== undefined && cp >= HANGUL_START && cp <= HANGUL_END) hangul.add(ch)
  }
}

function scanTree(dir, pattern) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      scanTree(path, pattern)
    } else if (pattern.test(entry.name)) {
      scan(readFileSync(path, 'utf8'))
    }
  }
}

// The generated data files are scanned before the fonts are cut, so the subset
// always covers every country and city name the app can show.
scanTree(resolve(ROOT, 'public', 'data'), /\.json$/)
scanTree(resolve(ROOT, 'src'), /\.(ts|tsx|css)$/)
scanTree(resolve(ROOT, 'scripts'), /\.mjs$/)
scan(readFileSync(resolve(ROOT, 'index.html'), 'utf8'))
scan(readFileSync(resolve(ROOT, 'vite.config.ts'), 'utf8'))

let text = [...hangul].sort().join('')
for (const [from, to] of RANGES) {
  for (let cp = from; cp <= to; cp++) text += String.fromCodePoint(cp)
}

const source = readFileSync(SOURCE)
const subset = await subsetFont(source, text, { targetFormat: 'woff2' })

mkdirSync(OUT, { recursive: true })
const target = resolve(OUT, 'pretendard-subset.woff2')
writeFileSync(target, subset)

const before = statSync(SOURCE).size / 1024
const after = subset.length / 1024
console.log(`hangul in use: ${hangul.size.toLocaleString()} of 11,172 syllables`)
console.log(
  `pretendard ${before.toFixed(0)} KB -> ${after.toFixed(0)} KB (${(100 - (after / before) * 100).toFixed(0)}% smaller)`,
)

/**
 * IBM Plex Mono only ever sets digits and ISO codes, so basic Latin covers it.
 * Copied here rather than imported from @fontsource, whose stylesheet also
 * pulls in .woff duplicates and a latin-ext range nothing uses.
 */
let monoBytes = 0
for (const weight of [400, 500, 600]) {
  const name = `ibm-plex-mono-latin-${weight}-normal.woff2`
  const file = readFileSync(resolve(ROOT, 'node_modules/@fontsource/ibm-plex-mono/files', name))
  writeFileSync(resolve(OUT, name), file)
  monoBytes += file.length
}
console.log(`ibm plex mono: 3 weights, ${(monoBytes / 1024).toFixed(0)} KB`)
