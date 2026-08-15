export type ProjectionSpec = {
  kind: 'equalEarth'
  scale: number
  translate: [number, number]
}

/**
 * Equal Earth, in closed form. The raster was baked with d3-geo using the same
 * fitted scale and translate, and the build asserts the two agree to 1e-6px —
 * so city pins land in the same space as the dots without shipping d3.
 */
const A1 = 1.340264
const A2 = -0.081106
const A3 = 0.000893
const A4 = 0.003796
const M = Math.sqrt(3) / 2

export function makeProjector({ scale, translate }: ProjectionSpec) {
  const [dx, dy] = translate
  return (lon: number, lat: number): [number, number] => {
    const l = (lon * Math.PI) / 180
    const p = (lat * Math.PI) / 180
    const t = Math.asin(M * Math.sin(p))
    const t2 = t * t
    const t6 = t2 * t2 * t2
    const x = (l * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)))
    const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))
    return [scale * x + dx, dy - scale * y]
  }
}
