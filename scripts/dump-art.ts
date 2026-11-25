// Dumps every art sheet to scripts/out/*.png for eyeballing.
//   npx tsx scripts/dump-art.ts
//
//   <sheet>.png            the sheet strip, 8x nearest-neighbour
//   seams.png              every terrain tile as a 6x6 patch (2x)
//   seams_a.png / _b.png   the same patches, larger (4x)
//   scene.png              grass / trees / cave tiles mixed, with sprites on top
//   contact_<sheet>.png    frames wrapped onto rows, shown over grass and cave floor

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { artWarnings, buildArtPixels } from '../src/art/art';
import { F, O, SHEETS, T, type SheetKey, type SheetPixels } from '../src/art/manifest';
import { PALETTE_HEX } from '../src/art/palette';

// ---------------------------------------------------------------- minimal PNG encoder

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width: number, height: number, rgba: Uint8Array | Uint8ClampedArray): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    for (let i = 0; i < stride; i++) raw[y * (stride + 1) + 1 + i] = rgba[y * stride + i];
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

// ---------------------------------------------------------------- tiny RGBA surface

class Surface {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly width: number,
    readonly height: number,
    fill: [number, number, number, number] = [0, 0, 0, 0],
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) this.data.set(fill, i * 4);
  }

  /** Copy one frame of a sheet to (dx, dy); transparent source pixels are skipped. */
  frame(sheet: SheetPixels, fw: number, index: number, dx: number, dy: number): void {
    for (let y = 0; y < sheet.height; y++) {
      for (let x = 0; x < fw; x++) {
        const s = (y * sheet.width + index * fw + x) * 4;
        if (sheet.data[s + 3] === 0) continue;
        const tx = dx + x;
        const ty = dy + y;
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;
        const d = (ty * this.width + tx) * 4;
        this.data[d] = sheet.data[s];
        this.data[d + 1] = sheet.data[s + 1];
        this.data[d + 2] = sheet.data[s + 2];
        this.data[d + 3] = 255;
      }
    }
  }

  scaled(k: number): Surface {
    const out = new Surface(this.width * k, this.height * k);
    for (let y = 0; y < out.height; y++) {
      for (let x = 0; x < out.width; x++) {
        const s = (Math.floor(y / k) * this.width + Math.floor(x / k)) * 4;
        const d = (y * out.width + x) * 4;
        out.data[d] = this.data[s];
        out.data[d + 1] = this.data[s + 1];
        out.data[d + 2] = this.data[s + 2];
        out.data[d + 3] = this.data[s + 3];
      }
    }
    return out;
  }

  save(path: string, k = 1): void {
    const s = k === 1 ? this : this.scaled(k);
    writeFileSync(path, encodePng(s.width, s.height, s.data));
  }
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------- main

const outDir = join(dirname(fileURLToPath(import.meta.url)), 'out');
mkdirSync(outDir, { recursive: true });

const art = buildArtPixels();
const keys = Object.keys(SHEETS) as SheetKey[];
const BACKDROP: [number, number, number, number] = [24, 24, 28, 255];

// 1. raw strips, 8x
for (const key of keys) {
  const sheet = art[key];
  const s = new Surface(sheet.width, sheet.height);
  s.data.set(sheet.data);
  s.save(join(outDir, `${key}.png`), 8);
}

// 2. seams: each terrain tile as a 6x6 patch
function seams(tileIds: number[], perRow: number): Surface {
  const cell = 96 + 4;
  const rows = Math.ceil(tileIds.length / perRow);
  const s = new Surface(perRow * cell + 4, rows * cell + 4, BACKDROP);
  tileIds.forEach((id, i) => {
    const ox = 4 + (i % perRow) * cell;
    const oy = 4 + Math.floor(i / perRow) * cell;
    for (let ty = 0; ty < 6; ty++) for (let tx = 0; tx < 6; tx++) s.frame(art.tiles, 16, id, ox + tx * 16, oy + ty * 16);
  });
  return s;
}
const allTiles = Array.from({ length: T.COUNT }, (_, i) => i);
seams(allTiles, 7).save(join(outDir, 'seams.png'), 2);
seams(allTiles.slice(0, 12), 4).save(join(outDir, 'seams_a.png'), 4);
seams(allTiles.slice(12), 4).save(join(outDir, 'seams_b.png'), 4);

// 3. scene: forest on the left, cave on the right
{
  const W = 22;
  const H = 12;
  const r = rng(4242);
  const map: number[][] = [];
  const grass = () => {
    const v = r();
    return v < 0.6 ? T.Grass : v < 0.85 ? T.Grass2 : T.Grass3;
  };
  const floor = () => {
    const v = r();
    return v < 0.65 ? T.CaveFloor : v < 0.83 ? T.CaveFloor2 : T.CaveFloor3;
  };
  for (let y = 0; y < H; y++) {
    map.push([]);
    for (let x = 0; x < W; x++) map[y].push(x < 11 ? grass() : T.CaveWall);
  }
  // forest edge: a solid mass of trees, plus a few loners
  for (let x = 0; x < 11; x++) {
    map[0][x] = r() < 0.6 ? T.Tree : T.Tree2;
    map[1][x] = r() < 0.6 ? T.Tree : T.Tree2;
    if (x < 5) map[2][x] = r() < 0.5 ? T.Tree : T.Tree2;
  }
  for (let y = 0; y < H; y++) map[y][0] = r() < 0.7 ? T.Tree : T.Tree2;
  map[5][4] = T.Tree;
  map[9][7] = T.Tree2;
  map[10][2] = T.Tree;
  map[4][8] = T.Bush;
  map[9][4] = T.Bush;
  map[5][2] = T.Rock;
  map[10][9] = T.Rock;
  for (let y = 3; y <= 4; y++) for (let x = 5; x <= 7; x++) map[y][x] = T.Water;
  for (let x = 1; x < 11; x++) map[7][x] = r() < 0.7 ? T.Dirt : T.Dirt2;
  // cave room
  for (let y = 3; y <= 10; y++) for (let x = 12; x <= 20; x++) map[y][x] = floor();
  map[7][11] = T.CaveFloor;
  for (let y = 5; y <= 6; y++) for (let x = 15; x <= 16; x++) map[y][x] = T.CaveWall; // pillar
  for (let x = 18; x <= 20; x++) {
    map[8][x] = T.PitEdge;
    map[9][x] = T.Pit;
    map[10][x] = T.Pit;
  }
  map[9][19] = T.Planks;
  map[8][19] = T.Planks;
  map[10][19] = T.Planks;
  map[4][20] = T.Rubble;
  // wall faces wherever floor lies directly below a wall
  for (let y = 0; y < H - 1; y++) {
    for (let x = 11; x < W; x++) {
      const below = map[y + 1][x];
      const isFloor = below === T.CaveFloor || below === T.CaveFloor2 || below === T.CaveFloor3 || below === T.Rubble;
      if (map[y][x] === T.CaveWall && isFloor) map[y][x] = T.CaveWallFace;
    }
  }
  map[2][14] = T.Cracked;

  const s = new Surface(W * 16, H * 16, [0, 0, 0, 255]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) s.frame(art.tiles, 16, map[y][x], x * 16, y * 16);

  const put = (key: SheetKey, index: number, tx: number, ty: number) => {
    const def = SHEETS[key];
    s.frame(art[key], def.w, index, Math.round(tx * 16), Math.round(ty * 16));
  };
  // forest
  put('hero0', 0, 3, 7);
  put('hero1', 4, 4, 7);
  put('hero2', 2, 5, 7);
  put('hero3', 1, 6, 7);
  put('hero4', 0, 4, 8);
  put('hero4', 4, 5, 8);
  put('slime', 0, 8, 6);
  put('slime', 1, 9, 5);
  put('wolf', 0, 6, 9);
  put('wolf', 1, 8, 10);
  put('objects', O.Den, 9, 9);
  put('objects', O.Sign, 2, 6);
  put('objects', O.Stump, 3, 9);
  put('objects', O.CampfireOn0, 6, 6);
  put('objects', O.Tent, 9, 3);
  put('objects', O.Crate, 10, 4);
  put('objects', O.Barrel, 10, 5);
  put('npc', 0, 2, 4);
  put('npc', 1, 3, 4);
  put('fx', F.Heart, 5, 8);
  put('fx', F.Coin0, 6, 8);
  put('fx', F.KeyRed, 7, 8);
  put('fx', F.Arrow, 8, 8);
  put('fx', F.Slash0, 4.6, 7);
  // cave
  put('objects', O.Sconce, 13, 2);
  put('objects', O.SconceOdd, 17, 2);
  put('objects', O.DoorRed, 11, 7);
  put('objects', O.ChestClosed, 12, 3);
  put('objects', O.ChestOpen, 13, 3);
  put('objects', O.Pot, 14, 3);
  put('objects', O.PotBroken, 15, 3);
  put('objects', O.BrazierOn0, 16, 3);
  put('objects', O.Shrine, 17, 3);
  put('objects', O.Pedestal, 18, 3);
  put('objects', O.Block, 12, 5);
  put('objects', O.PlateUp, 13, 5);
  put('objects', O.LeverOff, 14, 5);
  put('objects', O.SpikesUp, 17, 5);
  put('objects', O.SpikesDown, 18, 5);
  put('objects', O.ArrowTrap, 19, 5);
  put('objects', O.Gate, 20, 6);
  put('objects', O.Nest, 12, 9);
  put('objects', O.Mushroom, 13, 10);
  put('objects', O.Bones, 14, 10);
  put('bandit', 0, 12, 7);
  put('archer', 0, 13, 7);
  put('bat', 0, 14, 8);
  put('bat', 1, 15, 8);
  put('spider', 0, 13, 9);
  put('spider', 1, 14, 9);
  put('chief', 0, 15.5, 8.6);
  put('hero0', 4, 17, 7);
  put('fx', F.Firebolt0, 18, 7);
  put('fx', F.Bomb1, 16, 7);
  put('fx', F.Explosion1, 19, 6);
  put('fx', F.KeyBlue, 20, 7);
  s.save(join(outDir, 'scene.png'), 4);
}

// 4. contact sheets: each frame over grass and over cave floor
for (const key of keys) {
  const def = SHEETS[key];
  const sheet = art[key];
  const isTiles = key === 'tiles';
  const perRow = def.w >= 32 ? 3 : 8;
  const scale = def.w >= 32 ? 6 : key === 'digits' ? 12 : 8;
  const cellW = def.w + 2;
  const cellH = def.h + 2;
  const rows = Math.ceil(def.frames / perRow);
  const bands = isTiles ? 1 : 2;
  const s = new Surface(perRow * cellW + 2, rows * bands * cellH + 2, BACKDROP);
  for (let i = 0; i < def.frames; i++) {
    const cx = 2 + (i % perRow) * cellW;
    const row = Math.floor(i / perRow);
    for (let b = 0; b < bands; b++) {
      const cy = 2 + (row * bands + b) * cellH;
      if (!isTiles) {
        const bg = b === 0 ? T.Grass : T.CaveFloor;
        for (let ty = 0; ty < def.h; ty += 16) {
          for (let tx = 0; tx < def.w; tx += 16) {
            // clip the backdrop tile to the cell
            for (let y = 0; y < 16 && ty + y < def.h; y++) {
              for (let x = 0; x < 16 && tx + x < def.w; x++) {
                const si = (y * art.tiles.width + bg * 16 + x) * 4;
                const di = ((cy + ty + y) * s.width + cx + tx + x) * 4;
                s.data[di] = art.tiles.data[si];
                s.data[di + 1] = art.tiles.data[si + 1];
                s.data[di + 2] = art.tiles.data[si + 2];
                s.data[di + 3] = 255;
              }
            }
          }
        }
      }
      s.frame(sheet, def.w, i, cx, cy);
    }
  }
  s.save(join(outDir, `contact_${key}.png`), scale);
}

// 5. report
const used = new Set<string>();
for (const key of keys) {
  const d = art[key].data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    used.add('#' + [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join(''));
  }
}
const unused = Object.entries(PALETTE_HEX).filter(([, hex]) => !used.has(hex));
console.log(`sheets: ${keys.length}, palette: ${Object.keys(PALETTE_HEX).length} colours, ${used.size} used`);
if (unused.length) console.log('unused palette keys:', unused.map(([k]) => k).join(' '));
for (const key of keys) {
  const def = SHEETS[key];
  const ok = art[key].width === def.w * def.frames && art[key].height === def.h;
  if (!ok) console.log(`SIZE MISMATCH ${key}: ${art[key].width}x${art[key].height}`);
}
if (artWarnings.length) {
  console.log(`${artWarnings.length} art warnings:`);
  for (const w of artWarnings) console.log('  ' + w);
  process.exitCode = 1;
} else {
  console.log('no art warnings');
}
console.log(`wrote PNGs to ${outDir}`);
