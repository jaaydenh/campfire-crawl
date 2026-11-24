// Tiny pixel-grid toolkit. An Img is a grid of palette keys ('.' = transparent).
// Pure data: no DOM, no canvas.

import { PALETTE } from './palette';
import type { SheetPixels } from './manifest';

export interface Img {
  w: number;
  h: number;
  px: string[];
}

/** Authoring problems (bad row lengths, unknown palette keys). Empty when the art is sound. */
export const artWarnings: string[] = [];

export function blank(w = 16, h = 16, fill = '.'): Img {
  return { w, h, px: new Array<string>(w * h).fill(fill) };
}

export function clone(img: Img): Img {
  return { w: img.w, h: img.h, px: img.px.slice() };
}

export function get(img: Img, x: number, y: number): string {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return '.';
  return img.px[y * img.w + x];
}

export function set(img: Img, x: number, y: number, c: string): void {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h) return;
  img.px[y * img.w + x] = c;
}

/** Set with wrap-around, for seamless terrain. */
export function setWrap(img: Img, x: number, y: number, c: string): void {
  const xx = ((x % img.w) + img.w) % img.w;
  const yy = ((y % img.h) + img.h) % img.h;
  img.px[yy * img.w + xx] = c;
}

/** Parse a sprite from a template string: one row per line, one palette key per pixel. */
export function spr(name: string, src: string, w = 16, h = 16): Img {
  const rows = src
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  if (rows.length !== h) artWarnings.push(`${name}: ${rows.length} rows, expected ${h}`);
  const img = blank(w, h);
  for (let y = 0; y < h; y++) {
    const row = rows[y] ?? '';
    if (y < rows.length && row.length !== w) {
      artWarnings.push(`${name}: row ${y} has ${row.length} chars, expected ${w}: "${row}"`);
    }
    for (let x = 0; x < w; x++) {
      let c = row[x] ?? '.';
      if (!(c in PALETTE)) {
        artWarnings.push(`${name}: unknown palette key "${c}" at ${x},${y}`);
        c = '.';
      }
      img.px[y * w + x] = c;
    }
  }
  return img;
}

/**
 * Build a sprite from runs: each row is a list of [startColumn, keys]. Later runs
 * overwrite earlier ones. Easier than counting characters on 32-wide sprites.
 */
export type Run = readonly [number, string];
export function runs(name: string, w: number, h: number, rows: ReadonlyArray<ReadonlyArray<Run>>, dy = 0): Img {
  const img = blank(w, h);
  stampRuns(name, img, rows, dy);
  return img;
}

export function stampRuns(name: string, img: Img, rows: ReadonlyArray<ReadonlyArray<Run>>, dy = 0, dx = 0): void {
  rows.forEach((row, y) => {
    for (const [x0, keys] of row) {
      for (let i = 0; i < keys.length; i++) {
        const c = keys[i];
        if (!(c in PALETTE)) {
          artWarnings.push(`${name}: unknown palette key "${c}" in row ${y}`);
          continue;
        }
        if (c === '.') continue;
        const x = x0 + i + dx;
        const yy = y + dy;
        if (x < 0 || x >= img.w || yy < 0 || yy >= img.h) {
          artWarnings.push(`${name}: run out of bounds at ${x},${yy}`);
          continue;
        }
        img.px[yy * img.w + x] = c;
      }
    }
  });
}

/** Horizontal mirror. */
export function mirror(img: Img): Img {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) out.px[y * img.w + (img.w - 1 - x)] = img.px[y * img.w + x];
  }
  return out;
}

/** Swap palette keys. */
export function recolour(img: Img, map: Record<string, string>): Img {
  return { w: img.w, h: img.h, px: img.px.map((c) => map[c] ?? c) };
}

/** Move the picture; pixels pushed off the edge are lost. */
export function shift(img: Img, dx: number, dy: number): Img {
  const out = blank(img.w, img.h);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      const c = img.px[y * img.w + x];
      if (c !== '.') set(out, x + dx, y + dy, c);
    }
  }
  return out;
}

/** Composite `top` over `base` (transparent pixels of `top` leave `base` alone). */
export function over(base: Img, top: Img, dx = 0, dy = 0): Img {
  const out = clone(base);
  for (let y = 0; y < top.h; y++) {
    for (let x = 0; x < top.w; x++) {
      const c = top.px[y * top.w + x];
      if (c !== '.') set(out, x + dx, y + dy, c);
    }
  }
  return out;
}

/** Add a 1px outline around every opaque pixel (4-neighbour, or 8-neighbour when `diag`). */
export function outline(img: Img, c = '0', diag = false): Img {
  const out = clone(img);
  for (let y = 0; y < img.h; y++) {
    for (let x = 0; x < img.w; x++) {
      if (get(img, x, y) !== '.') continue;
      let touch =
        get(img, x - 1, y) !== '.' || get(img, x + 1, y) !== '.' || get(img, x, y - 1) !== '.' || get(img, x, y + 1) !== '.';
      if (!touch && diag) {
        touch =
          get(img, x - 1, y - 1) !== '.' ||
          get(img, x + 1, y - 1) !== '.' ||
          get(img, x - 1, y + 1) !== '.' ||
          get(img, x + 1, y + 1) !== '.';
      }
      if (touch) out.px[y * img.w + x] = c;
    }
  }
  return out;
}

/** Outlined sprite from a template string (the common case). */
export function ol(name: string, src: string, c = '0'): Img {
  return outline(spr(name, src), c);
}

/** Bresenham line. */
export function line(img: Img, x0: number, y0: number, x1: number, y1: number, c: string): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    set(img, x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pack frames into one horizontal RGBA strip. */
export function toSheet(name: string, frames: Img[], w: number, h: number, count: number): SheetPixels {
  if (frames.length !== count) artWarnings.push(`sheet ${name}: ${frames.length} frames, expected ${count}`);
  const width = w * count;
  const data = new Uint8ClampedArray(width * h * 4);
  for (let f = 0; f < count; f++) {
    const img = frames[f];
    if (!img) continue;
    if (img.w !== w || img.h !== h) artWarnings.push(`sheet ${name}: frame ${f} is ${img.w}x${img.h}, expected ${w}x${h}`);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const rgba = PALETTE[get(img, x, y)] ?? PALETTE['.'];
        const i = (y * width + f * w + x) * 4;
        data[i] = rgba[0];
        data[i + 1] = rgba[1];
        data[i + 2] = rgba[2];
        data[i + 3] = rgba[3];
      }
    }
  }
  return { width, height: h, data };
}
