// The single shared palette. Every sprite and tile is authored as a grid of
// these one-character keys, so nothing can drift off-palette.

export const PALETTE_HEX: Record<string, string> = {
  // neutrals
  K: '#000000', // true black (void only)
  '0': '#1b1424', // outline
  '1': '#2d2838', // darkest rock
  '2': '#45405a', // dark slate
  '3': '#6e6c84', // grey
  '4': '#a3a6b8', // light grey
  '5': '#e4e9ee', // near white
  w: '#ffffff', // pure white (glints, digits)
  // greens
  g: '#173d2a', // deepest green
  G: '#27643a', // dark green
  j: '#388539', // grass shade
  h: '#3f8f3e', // grass base
  H: '#6dbb48', // light green
  y: '#b4de5c', // yellow-green highlight
  // browns and skin
  b: '#3a2317', // dark brown
  B: '#6a4028', // brown
  e: '#8b5d36', // dirt shade
  d: '#9c6b3e', // dirt / wood
  D: '#cfa066', // light tan
  S: '#c9855f', // skin shadow / terracotta
  s: '#f2bd92', // skin
  // warm
  r: '#7c1d2e', // dark red
  R: '#cf3438', // red
  o: '#ec7a26', // orange
  a: '#c0862a', // amber (gold shadow)
  O: '#f8cb3a', // gold / yellow
  Y: '#fff3a8', // pale yellow
  // cool
  n: '#1d2a5e', // navy
  u: '#2f5fc0', // blue
  U: '#5fa9ec', // light blue
  c: '#b0e8f6', // ice
  p: '#46285f', // dark purple
  P: '#8a4cb4', // purple
  // cave floor
  v: '#413846', // cave floor shade
  V: '#4f4553', // cave floor base
  x: '#5d5261', // cave floor light
};

export type Rgba = readonly [number, number, number, number];

export const PALETTE: Record<string, Rgba> = (() => {
  const out: Record<string, Rgba> = { '.': [0, 0, 0, 0] };
  for (const [k, hex] of Object.entries(PALETTE_HEX)) {
    out[k] = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
      255,
    ];
  }
  return out;
})();
