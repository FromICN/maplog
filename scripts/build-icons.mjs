/**
 * Renders the app icon straight from the design tokens: a lit dot cluster on ink.
 * Hand-rolled PNG writer so the build has no image dependencies.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const INK = [0x0b, 0x0f, 0x14]
const RAMP = [
  [0x2b, 0x36, 0x41], // off
  [0x72, 0x53, 0x19],
  [0xa2, 0x73, 0x1b],
  [0xd3, 0x93, 0x1e],
  [0xff, 0xb0, 0x20],
]

function crc32(buf) {
  let c
  const table = crc32.table ?? (crc32.table = Array.from({ length: 256 }, (_, n) => {
    c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  }))
  let crc = 0xffffffff
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** pixels: Uint8Array of size*size*channels (3 = opaque, 4 = with alpha) */
function encodePng(size, pixels, channels = 3) {
  const stride = size * channels
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = channels === 4 ? 6 : 2 // truecolour, with alpha when asked
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/**
 * A 7x7 dot field. Lit dots trace a rising path across it — the shape of a
 * route drawn in the same material as the map.
 */
const GRID = 7
const FIELD = [
  '0000000',
  '0000034',
  '0000300',
  '0023000',
  '0300000',
  '0400000',
  '0000000',
].map((row) => row.split('').map(Number))

/**
 * `shape` picks what sits behind the dots:
 *   'square' — ink to the edges (home screen icons, favicons)
 *   'circle' — ink inside a circle, transparent outside (round launcher icons)
 *   'none'   — dots only on transparency (adaptive-icon foreground layer)
 */
function render(size, inset, shape = 'square') {
  const alpha = shape !== 'square'
  const ch = alpha ? 4 : 3
  const px = new Uint8Array(size * size * ch)
  const mid = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * ch
      px[i] = INK[0]
      px[i + 1] = INK[1]
      px[i + 2] = INK[2]
      if (!alpha) continue
      if (shape === 'none') px[i + 3] = 0
      else {
        // Feathered circle so the edge is not stair-stepped.
        const d = Math.hypot(x + 0.5 - mid, y + 0.5 - mid)
        px[i + 3] = Math.round(255 * Math.max(0, Math.min(1, mid - d + 0.5)))
      }
    }
  }

  const area = size * (1 - inset * 2)
  const pitch = area / GRID
  const radius = pitch * 0.3

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const level = FIELD[r][c]
      const color = RAMP[level]
      const cx = size * inset + pitch * (c + 0.5)
      const cy = size * inset + pitch * (r + 0.5)
      const rad = level === 0 ? radius * 0.62 : radius
      const x0 = Math.max(0, Math.floor(cx - rad - 1))
      const x1 = Math.min(size - 1, Math.ceil(cx + rad + 1))
      const y0 = Math.max(0, Math.floor(cy - rad - 1))
      const y1 = Math.min(size - 1, Math.ceil(cy + rad + 1))
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
          // 1px feather keeps small sizes from looking chewed up.
          const a = Math.max(0, Math.min(1, rad - d + 0.5))
          if (a <= 0) continue
          const i = (y * size + x) * ch
          for (let k = 0; k < 3; k++) px[i + k] = Math.round(px[i + k] * (1 - a) + color[k] * a)
          if (alpha) px[i + 3] = Math.max(px[i + 3], Math.round(255 * a))
        }
      }
    }
  }
  return encodePng(size, px, ch)
}

mkdirSync(OUT, { recursive: true })
writeFileSync(resolve(OUT, 'icon-192.png'), render(192, 0.1))
writeFileSync(resolve(OUT, 'icon-512.png'), render(512, 0.1))
// Maskable icons lose ~20% to the platform's safe-area crop.
writeFileSync(resolve(OUT, 'icon-maskable-512.png'), render(512, 0.22))

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}">
<rect width="${GRID}" height="${GRID}" fill="#0B0F14"/>
${FIELD.flatMap((row, r) =>
  row.map((level, c) => {
    const fill = `#${RAMP[level].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    return `<circle cx="${c + 0.5}" cy="${r + 0.5}" r="${level === 0 ? 0.19 : 0.3}" fill="${fill}"/>`
  }),
).join('\n')}
</svg>`
writeFileSync(resolve(OUT, 'favicon.svg'), svg)

console.log('icons written to public/')

// ---------------------------------------------------------- android launcher

/**
 * Overwrites the launcher icons Capacitor scaffolds, so the installed app wears
 * the same dot field as the web one instead of the framework's stock logo.
 * Skipped when the android project has not been generated.
 */
const ANDROID_RES = resolve(OUT, '..', 'android', 'app', 'src', 'main', 'res')
if (existsSync(ANDROID_RES)) {
  // Legacy launcher sizes, then the adaptive foreground at 108dp equivalents.
  const DENSITIES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 }
  for (const [density, size] of Object.entries(DENSITIES)) {
    const dir = resolve(ANDROID_RES, `mipmap-${density}`)
    if (!existsSync(dir)) continue
    writeFileSync(resolve(dir, 'ic_launcher.png'), render(size, 0.1))
    writeFileSync(resolve(dir, 'ic_launcher_round.png'), render(size, 0.14, 'circle'))
    // The adaptive foreground is cropped to the middle ~66%, so the field sits
    // well inside the canvas and the launcher can mask it to any shape.
    writeFileSync(
      resolve(dir, 'ic_launcher_foreground.png'),
      render(Math.round(size * 1.5), 0.3, 'none'),
    )
  }

  writeFileSync(
    resolve(ANDROID_RES, 'values', 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0B0F14</color>
</resources>
`,
  )

  // Capacitor's template points the foreground at a vector; ours is a bitmap.
  const vector = resolve(ANDROID_RES, 'drawable-v24', 'ic_launcher_foreground.xml')
  if (existsSync(vector)) rmSync(vector)

  console.log('android launcher icons written')
}
