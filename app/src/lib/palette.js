// Stable colour per prototype. Assigned in fixed order so the legend and the
// graph agree, and the same prototype keeps its colour across renders.
const HUES = [
  '#4bd6c4', // teal
  '#f4a259', // orange
  '#7aa2f7', // blue
  '#e06c9f', // pink
  '#b48ead', // violet
  '#a3be8c', // green
  '#ebcb8b', // yellow
  '#ff6b6b', // red
  '#56c2e6', // cyan
  '#c0a3e0', // lavender
  '#88c0a0', // sage
  '#d79a6a', // tan
]

export function paletteFor(prototypeNames) {
  const map = new Map()
  prototypeNames.forEach((name, i) => map.set(name, HUES[i % HUES.length]))
  return map
}

export const NEUTRAL = '#7c92a8'
