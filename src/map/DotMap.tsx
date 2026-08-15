import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { World } from '../data/countries'
import './DotMap.css'

/**
 * The world as a field of dots.
 *
 * One raster of country indices is sampled with a stride that doubles as you
 * zoom out, so the dot count on screen stays roughly constant — a world view
 * and a street-level view cost the same to draw. Dots grow with the stride, so
 * zooming in reads as the field subdividing rather than as dots drifting apart.
 */

/** Palette slots: 0 unlit, 1–4 lit, 5 wish, 6 selected, 7 background. */
const SELECTED_BUCKET = 6
const INK_SLOT = 7

/** Smallest gap between dot centres, in CSS pixels. */
const MIN_PITCH = 3.4
const MAX_STRIDE = 32
const MAX_SCALE = 14

type View = { scale: number; tx: number; ty: number }

type Props = {
  world: World
  /** Grid index -> paint level (0 off, 1–4 lit, 5 wish). */
  paint: Uint8Array
  selectedIndex: number
  /** Logged cities as flat grid x/y pairs; shown once you zoom past the world view. */
  cities?: Float32Array
  onSelect: (iso: string | null) => void
  /** Screen edges reserved for chrome; the world view is framed inside what is left. */
  inset?: { top: number; bottom: number }
  /** Fires when the user leaves (or returns to) the whole-world view. */
  onZoomChange?: (zoomedIn: boolean) => void
}

function strideFor(scale: number) {
  const wanted = MIN_PITCH / scale
  if (wanted <= 1) return 1
  return Math.min(MAX_STRIDE, 2 ** Math.ceil(Math.log2(wanted)))
}

export default function DotMap({
  world,
  paint,
  selectedIndex,
  cities,
  onSelect,
  inset,
  onZoomChange,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<View>({ scale: 0, tx: 0, ty: 0 })
  const sizeRef = useRef({ w: 0, h: 0 })
  const minScaleRef = useRef(0)
  const frameRef = useRef(0)
  const paletteRef = useRef<string[]>([])
  const zoomedRef = useRef(false)
  /** Until the reader zooms for themselves, the map re-fits on every resize. */
  const userZoomedRef = useRef(false)

  const paintRef = useRef(paint)
  paintRef.current = paint
  const selectedRef = useRef(selectedIndex)
  selectedRef.current = selectedIndex
  const citiesRef = useRef(cities)
  citiesRef.current = cities
  const insetRef = useRef(inset)
  insetRef.current = inset
  const zoomChangeRef = useRef(onZoomChange)
  zoomChangeRef.current = onZoomChange

  const clamp = useCallback(() => {
    const v = viewRef.current
    const { w, h } = sizeRef.current
    const top = insetRef.current?.top ?? 0
    const bottom = insetRef.current?.bottom ?? 0
    const mapW = world.width * v.scale
    const mapH = world.height * v.scale
    v.tx = mapW <= w ? (w - mapW) / 2 : Math.min(0, Math.max(w - mapW, v.tx))
    // At the world view the band is framed inside the free space between the
    // chrome; once you zoom past it the map is free to use the whole screen.
    v.ty =
      mapH <= h - top - bottom
        ? top + (h - top - bottom - mapH) / 2
        : Math.min(0, Math.max(h - mapH, v.ty))

    const zoomed = v.scale > minScaleRef.current * 1.08
    if (zoomed !== zoomedRef.current) {
      zoomedRef.current = zoomed
      zoomChangeRef.current?.(zoomed)
    }
  }, [world.width, world.height])

  const draw = useCallback(() => {
    frameRef.current = 0
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { w, h } = sizeRef.current
    const { scale, tx, ty } = viewRef.current
    const dpr = Math.min(window.devicePixelRatio || 1, 3)

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    const stride = strideFor(scale)
    const pitch = scale * stride
    const radius = Math.max(0.55, pitch * 0.33)
    // Below ~1.2px a square and a circle are the same handful of pixels, and
    // rects are much cheaper when there are thousands of them.
    const square = radius < 1.2

    const gx0 = Math.max(0, Math.floor(-tx / scale / stride) * stride)
    const gy0 = Math.max(0, Math.floor(-ty / scale / stride) * stride)
    const gx1 = Math.min(world.width - 1, Math.ceil((w - tx) / scale))
    const gy1 = Math.min(world.height - 1, Math.ceil((h - ty) / scale))

    const palette = paletteRef.current
    // Buckets 0–5 are paint levels; 6 marks the country under the open sheet.
    const buckets: number[][] = Array.from({ length: SELECTED_BUCKET + 1 }, () => [])
    const grid = world.grid
    const p = paintRef.current
    const selected = selectedRef.current

    for (let gy = gy0; gy <= gy1; gy += stride) {
      const row = gy * world.width
      const sy = gy * scale + ty
      for (let gx = gx0; gx <= gx1; gx += stride) {
        const index = grid[row + gx]
        if (index === 0) continue
        const bucket = index === selected ? SELECTED_BUCKET : p[index]
        const list = buckets[bucket]
        list.push(gx * scale + tx, sy)
      }
    }

    // The anchor pass keeps every lit country on screen even when the stride
    // skips straight over a country only a few cells wide.
    if (stride > 1) {
      for (const c of world.countries) {
        if (!c.anchor) continue
        const bucket = c.i === selected ? SELECTED_BUCKET : p[c.i]
        if (bucket === 0) continue
        const [ax, ay] = c.anchor
        if (ax < gx0 || ax > gx1 || ay < gy0 || ay > gy1) continue
        buckets[bucket].push(ax * scale + tx, ay * scale + ty)
      }
    }

    for (let b = 0; b < buckets.length; b++) {
      const pts = buckets[b]
      if (!pts.length) continue
      ctx.fillStyle = palette[b]
      ctx.beginPath()
      if (square) {
        const size = radius * 2
        for (let i = 0; i < pts.length; i += 2) ctx.rect(pts[i] - radius, pts[i + 1] - radius, size, size)
      } else {
        for (let i = 0; i < pts.length; i += 2) {
          ctx.moveTo(pts[i] + radius, pts[i + 1])
          ctx.arc(pts[i], pts[i + 1], radius, 0, Math.PI * 2)
        }
      }
      ctx.fill()
    }

    // Cities are points, not cells — they only earn their space once the map is
    // zoomed past the world view, where a pin means somewhere rather than everywhere.
    const pins = citiesRef.current
    if (pins?.length && scale > minScaleRef.current * 2) {
      const r = Math.max(1.8, pitch * 0.4)
      ctx.beginPath()
      for (let i = 0; i < pins.length; i += 2) {
        const px = pins[i] * scale + tx
        const py = pins[i + 1] * scale + ty
        if (px < -r || py < -r || px > w + r || py > h + r) continue
        ctx.moveTo(px + r, py)
        ctx.arc(px, py, r, 0, Math.PI * 2)
      }
      ctx.fillStyle = palette[SELECTED_BUCKET]
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = palette[INK_SLOT]
      ctx.stroke()
    }
  }, [world])

  const schedule = useCallback(() => {
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(draw)
  }, [draw])

  // ---- sizing -------------------------------------------------------------

  /** Re-measures the canvas and re-frames the world view. */
  const reflow = useCallback(
    (resizeCanvas: boolean) => {
      const host = hostRef.current
      const canvas = canvasRef.current
      if (!host || !canvas) return
      const rect = host.getBoundingClientRect()

      if (resizeCanvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 3)
        sizeRef.current = { w: rect.width, h: rect.height }
        canvas.width = Math.round(rect.width * dpr)
        canvas.height = Math.round(rect.height * dpr)
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
      }

      const free = rect.height - (insetRef.current?.top ?? 0) - (insetRef.current?.bottom ?? 0)
      const fit = Math.min(rect.width / world.width, Math.max(free, 80) / world.height)
      minScaleRef.current = fit
      viewRef.current.scale = userZoomedRef.current
        ? Math.min(MAX_SCALE, Math.max(fit, viewRef.current.scale))
        : fit
      clamp()
      draw()
    },
    [world, clamp, draw],
  )

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    const style = getComputedStyle(host)
    const token = (name: string) => style.getPropertyValue(name).trim()
    paletteRef.current = [
      token('--dot-off'),
      token('--lit-1'),
      token('--lit-2'),
      token('--lit-3'),
      token('--lit-4'),
      token('--wish'),
      token('--text'),
      token('--ink'),
    ]

    const onResize = () => reflow(true)
    onResize()
    const ro = new ResizeObserver(onResize)
    ro.observe(host)
    return () => ro.disconnect()
  }, [reflow])

  // The chrome measures itself after mounting, so the framing has to catch up.
  useEffect(() => {
    reflow(false)
  }, [inset?.top, inset?.bottom, reflow])

  useEffect(() => {
    schedule()
  }, [paint, selectedIndex, cities, schedule])

  // ---- interaction --------------------------------------------------------

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = viewRef.current
      const next = Math.max(minScaleRef.current, Math.min(MAX_SCALE, v.scale * factor))
      userZoomedRef.current = next > minScaleRef.current * 1.001
      if (next === v.scale) return
      const k = next / v.scale
      v.tx = cx - (cx - v.tx) * k
      v.ty = cy - (cy - v.ty) * k
      v.scale = next
      clamp()
      schedule()
    },
    [clamp, schedule],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const pointers = new Map<number, { x: number; y: number }>()
    let pinchDist = 0
    let moved = 0
    let downAt = 0

    const local = (e: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const onDown = (e: PointerEvent) => {
      host.setPointerCapture(e.pointerId)
      pointers.set(e.pointerId, local(e))
      if (pointers.size === 1) {
        moved = 0
        downAt = performance.now()
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }

    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      const now = local(e)
      pointers.set(e.pointerId, now)

      if (pointers.size === 1) {
        const v = viewRef.current
        v.tx += now.x - prev.x
        v.ty += now.y - prev.y
        moved += Math.abs(now.x - prev.x) + Math.abs(now.y - prev.y)
        clamp()
        schedule()
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinchDist > 0) zoomAt(dist / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2)
        pinchDist = dist
        moved += 10
      }
    }

    const onUp = (e: PointerEvent) => {
      const point = pointers.get(e.pointerId)
      const wasSingle = pointers.size === 1
      pointers.delete(e.pointerId)
      if (pointers.size < 2) pinchDist = 0
      if (!point || !wasSingle) return
      if (moved > 6 || performance.now() - downAt > 500) return

      const v = viewRef.current
      const gx = Math.floor((point.x - v.tx) / v.scale)
      const gy = Math.floor((point.y - v.ty) / v.scale)
      onSelect(hitTest(world, gx, gy, Math.min(40, Math.ceil(16 / v.scale))))
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = host.getBoundingClientRect()
      zoomAt(Math.exp(-e.deltaY * 0.0016), e.clientX - rect.left, e.clientY - rect.top)
    }

    host.addEventListener('pointerdown', onDown)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerup', onUp)
    host.addEventListener('pointercancel', onUp)
    host.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointercancel', onUp)
      host.removeEventListener('wheel', onWheel)
    }
  }, [world, clamp, schedule, zoomAt, onSelect])

  return (
    <div className="dotmap" ref={hostRef}>
      <canvas className="dotmap__canvas" ref={canvasRef} />
    </div>
  )
}

/** Nearest real country to a tapped cell, so small nations stay tappable. */
function hitTest(world: World, gx: number, gy: number, radius: number): string | null {
  const { width, height, grid, byIndex, landOther } = world
  const pick = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return null
    const index = grid[y * width + x]
    if (!index || index === landOther) return null
    return byIndex[index]?.iso2 ?? null
  }

  const direct = pick(gx, gy)
  if (direct) return direct

  for (let r = 1; r <= radius; r++) {
    for (let d = -r; d <= r; d++) {
      const hit =
        pick(gx + d, gy - r) ?? pick(gx + d, gy + r) ?? pick(gx - r, gy + d) ?? pick(gx + r, gy + d)
      if (hit) return hit
    }
  }
  return null
}
