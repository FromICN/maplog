/**
 * Renders the app icon straight from the design tokens: a lit dot cluster on ink.
 * Hand-rolled PNG writer so the build has no image dependencies.
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
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

/** rgb: Uint8Array of size*size*3 */
function encodePng(size, rgb) {
  const stride = size * 3
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    Buffer.from(rgb.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
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

function render(size, inset) {
  const rgb = new Uint8Array(size * size * 3)
  for (let i = 0; i < size * size; i++) {
    rgb[i * 3] = INK[0]
    rgb[i * 3 + 1] = INK[1]
    rgb[i * 3 + 2] = INK[2]
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
          const i = (y * size + x) * 3
          for (let k = 0; k < 3; k++) rgb[i + k] = Math.round(rgb[i + k] * (1 - a) + color[k] * a)
        }
      }
    }
  }
  return encodePng(size, rgb)
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
