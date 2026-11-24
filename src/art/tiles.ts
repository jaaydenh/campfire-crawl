// Terrain tiles (sheet 'tiles'), in enum T order. All fully opaque and seamless.

import { T } from './manifest';
import { type Img, blank, get, ol, outline, over, rng, set, setWrap, spr } from './draw';

function speckle(img: Img, rand: () => number, key: string, n: number): void {
  for (let i = 0; i < n; i++) set(img, Math.floor(rand() * img.w), Math.floor(rand() * img.h), key);
}

// ---------------------------------------------------------------- grass

function grassBase(seed: number): Img {
  const img = blank(16, 16, 'h');
  const r = rng(seed);
  speckle(img, r, 'j', 18);
  // a few two-pixel blades
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(r() * 16);
    const y = Math.floor(r() * 16);
    setWrap(img, x, y, 'j');
    setWrap(img, x, y + 1, 'j');
  }
  return img;
}

function grassTufts(): Img {
  const img = grassBase(202);
  const tuft = (x: number, y: number) => {
    setWrap(img, x, y, 'H');
    setWrap(img, x + 2, y, 'H');
    setWrap(img, x + 1, y + 1, 'H');
    setWrap(img, x, y + 1, 'j');
    setWrap(img, x + 2, y + 1, 'j');
    setWrap(img, x + 1, y + 2, 'G');
  };
  tuft(2, 3);
  tuft(10, 2);
  tuft(6, 9);
  tuft(12, 11);
  return img;
}

function grassFlowers(): Img {
  const img = grassBase(303);
  const flower = (x: number, y: number, petal: string) => {
    setWrap(img, x, y, petal);
    setWrap(img, x, y + 1, 'G');
  };
  flower(3, 4, '5');
  flower(11, 3, 'O');
  flower(7, 10, '5');
  flower(13, 12, 'O');
  flower(2, 12, 'Y');
  return img;
}

// ---------------------------------------------------------------- dirt

function dirtBase(seed: number): Img {
  const img = blank(16, 16, 'd');
  const r = rng(seed);
  speckle(img, r, 'e', 22);
  speckle(img, r, 'D', 5);
  // trodden streaks
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(r() * 16);
    const y = Math.floor(r() * 16);
    setWrap(img, x, y, 'e');
    setWrap(img, x + 1, y, 'e');
    setWrap(img, x + 2, y, 'e');
  }
  return img;
}

function dirtPebbles(): Img {
  const img = dirtBase(505);
  const pebble = (x: number, y: number, big: boolean) => {
    setWrap(img, x, y, '4');
    setWrap(img, x, y + 1, 'B');
    if (big) {
      setWrap(img, x + 1, y, '3');
      setWrap(img, x + 1, y + 1, 'B');
    }
  };
  pebble(3, 3, true);
  pebble(11, 5, false);
  pebble(7, 11, true);
  pebble(13, 12, false);
  pebble(2, 9, false);
  return img;
}

// ---------------------------------------------------------------- trees

/** Leafy canopy from above: a crown of overlapping leaf clumps lit from the top-left. */
function leafyTree(): Img {
  const img = blank(16, 16, 'g');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (Math.hypot(x - 7.5, y - 7.5) < 8.4) set(img, x, y, 'G');
    }
  }
  // drawn back-to-front: bottom-right clumps first, top-left last
  const clumps: Array<[number, number, number]> = [
    [11.5, 11.5, 3.1],
    [7.5, 12.5, 2.7],
    [12.5, 7.5, 2.7],
    [3.8, 11.2, 2.9],
    [11.2, 3.8, 2.9],
    [8.2, 8.2, 3.3],
    [3.2, 7.2, 2.7],
    [7.2, 3.2, 2.8],
    [3.9, 3.9, 2.7],
  ];
  for (const [cx, cy, rad] of clumps) {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        if (d > rad) continue;
        const n = (-dx - dy) / (rad * 1.414); // +1 top-left ... -1 bottom-right
        let c = 'G';
        if (n > 0.62) c = 'H';
        else if (n > 0.12) c = 'h';
        else if (n < -0.55 && d > rad - 1.1) c = 'g';
        set(img, x, y, c);
      }
    }
  }
  return img;
}

/** 0 in the notches of an n-pointed star, 1 at its points. */
function starWave(angle: number, n: number, rot: number): number {
  const t = ((((angle / (Math.PI * 2)) * n + rot) % 1) + 1) % 1;
  return 1 - Math.abs(t * 2 - 1);
}

/** Pine from above: two stacked eight-pointed stars of needles, darker than the leafy tree. */
function pineTree(): Img {
  const img = blank(16, 16, 'g');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const d = Math.hypot(dx, dy);
      const a = Math.atan2(dy, dx);
      const w1 = starWave(a, 8, 0.5);
      const w2 = starWave(a, 8, 0);
      const lower = 3.8 + 5.4 * w1;
      const upper = 1.7 + 3.1 * w2;
      const lit = -dx - dy > 0.5;
      let c = 'g';
      if (d < 1.3) c = 'h';
      else if (d < upper) c = lit ? (w2 > 0.6 ? 'h' : 'j') : 'G';
      else if (d < upper + 1.1 && !lit) c = 'g';
      else if (d < lower) c = w1 > 0.7 && lit ? 'j' : 'G';
      set(img, x, y, c);
    }
  }
  return img;
}

// ---------------------------------------------------------------- outdoor solids

const BUSH = `
................
................
................
......GHHG......
....GHHGGHHG....
...GHHHGGHHGG...
..GHHGGGGGGHGG..
..GHGGRGGGGGGg..
..GGGGGGGRGGGg..
..GGGGGGGGGGgg..
...GGgGGGGggg...
....gggggggg....
................
................
................
................
`;

const BOULDER = `
................
................
................
......4444......
....44554443....
...4455444433...
..445444444332..
..444444443332..
..444443433322..
..344333333322..
..333333332222..
...3322222222...
....22222222....
................
................
................
`;

function onGrass(sprite: Img, seed: number): Img {
  const g = grassBase(seed);
  // soft contact shadow under the object
  for (let x = 3; x < 13; x++) {
    for (let y = 15; y >= 0; y--) {
      if (get(sprite, x, y) !== '.') {
        if (y + 1 < 16) set(g, x, y + 1, 'G');
        break;
      }
    }
  }
  return over(g, sprite);
}

// ---------------------------------------------------------------- water

const WATER = `
uuuuuuuuuuuuuuuu
uuUUUuuuuuuuuuuu
uuuuuuuuuunnuuuu
uuuuuuuuuuuuuuuu
uuuuuuuuUUUcuuuu
unnuuuuuuuuuuuuu
uuuuuuuuuuuuuuuu
uuuuUUuuuuuuuunn
uuuuuuuuuuuuuuuu
uuuuuuuuuuUUUuuu
uucUUuuuuuuuuuuu
uuuuuuunnuuuuuuu
uuuuuuuuuuuuuuuu
UuuuuuuuuuuuuUUU
uuuuunnuuuuuuuuu
uuuuuuuuuuuuuuuu
`;

// ---------------------------------------------------------------- cave

function caveFloorBase(seed: number): Img {
  const img = blank(16, 16, 'V');
  const r = rng(seed);
  speckle(img, r, 'v', 16);
  speckle(img, r, 'x', 9);
  return img;
}

function caveFloorCracks(): Img {
  const img = caveFloorBase(707);
  const pts: Array<[number, number]> = [
    [3, 2], [4, 3], [4, 4], [5, 5], [5, 6], [6, 7], [7, 7], [8, 8], [8, 9], [9, 10],
    [6, 8], [5, 9], [5, 10], [4, 11],
    [11, 3], [12, 4], [12, 5], [13, 6],
  ];
  for (const [x, y] of pts) set(img, x, y, '1');
  for (const [x, y] of pts) if (get(img, x + 1, y) !== '1') set(img, x + 1, y, 'x');
  return img;
}

function caveFloorPebbles(): Img {
  const img = caveFloorBase(808);
  const pebble = (x: number, y: number, big: boolean) => {
    setWrap(img, x, y, '3');
    setWrap(img, x, y + 1, '1');
    if (big) {
      setWrap(img, x + 1, y, '2');
      setWrap(img, x + 1, y + 1, '1');
    }
  };
  pebble(4, 3, true);
  pebble(12, 4, false);
  pebble(8, 10, true);
  pebble(2, 12, false);
  pebble(13, 12, false);
  return img;
}

/** Dark top of solid rock: wrap-around Voronoi lumps with crevices and a faint top-left highlight. */
function caveWallTop(): Img {
  const img = blank(16, 16, '1');
  const r = rng(909);
  // scattered seeds, rejected when too close together (distance measured on the torus)
  const pts: Array<[number, number]> = [];
  const torus = (ax: number, ay: number, bx: number, by: number): number => {
    let dx = Math.abs(ax - bx);
    let dy = Math.abs(ay - by);
    if (dx > 8) dx = 16 - dx;
    if (dy > 8) dy = 16 - dy;
    return Math.hypot(dx, dy);
  };
  for (let tries = 0; tries < 400 && pts.length < 11; tries++) {
    const x = r() * 16;
    const y = r() * 16;
    if (pts.every(([px, py]) => torus(x, y, px, py) > 3.6)) pts.push([x, y]);
  }
  const crevice = (x: number, y: number): boolean => {
    const xx = ((x % 16) + 16) % 16;
    const yy = ((y % 16) + 16) % 16;
    let d1 = 99;
    let d2 = 99;
    for (const [px, py] of pts) {
      let dx = Math.abs(xx - px);
      let dy = Math.abs(yy - py);
      if (dx > 8) dx = 16 - dx;
      if (dy > 8) dy = 16 - dy;
      const d = Math.hypot(dx, dy);
      if (d < d1) {
        d2 = d1;
        d1 = d;
      } else if (d < d2) d2 = d;
    }
    return d2 - d1 < 0.95;
  };
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      if (crevice(x, y)) set(img, x, y, '0');
      else if (crevice(x - 1, y - 1) && !crevice(x + 1, y + 1)) set(img, x, y, '2');
    }
  }
  return img;
}

const WALL_FACE = `
4444344444443444
4333333343333333
3333323333333233
3323333333323333
3233333433233333
3233334333233332
3323333333323332
3332333333332333
3333233333333233
4333323334333323
3333332333333323
3323332333233332
2333323233333322
2232322223232232
2222222222222222
1111111111111111
`;

const CRACKS = `
................
.......0........
.......0........
......00....0...
......0....0....
...0..00..00....
....00.000......
.....0000.......
......0100......
.....00.00......
....00...0.0....
...00....000....
...0......0.....
..........00....
................
................
`;

const RUBBLE = `
................
................
.....33.........
....3442....43..
....3332...4432.
.43..22.....22..
.32.......3.....
......443.......
.....44332...3..
.....33322..342.
..3...222...22..
.342............
..22....43......
.......4332.....
........22......
................
`;

const PIT = `
0000000000000000
0000000000000000
0010000000000000
0010000000010000
0000000000010000
0000000000000000
0000001000000000
0000001000000000
0000000000000000
0000000000000100
0100000000000100
0100000000000000
0000000010000000
0000000010000000
0000000000000000
0000000000000000
`;

const PIT_EDGE = `
xxxVxxxxxxVxxxxx
3323333233333233
2232222322232223
2212222212221222
1121211112112112
0110100110100110
0100000010000100
0000000010000000
0000000000000000
0000000000000100
0100000000000100
0100000000000000
0000000010000000
0000000010000000
0000000000000000
0000000000000000
`;

const PLANKS = `
dddddddddddddddd
BBBBBBBBBbBBBBBB
BBBeBBBBBbBBBeBB
bbbbbbbbbbbbbbbb
dddddddddddddddd
BBBbBBBBBBBBBBBB
BBBbBBBBeBBBBBBB
bbbbbbbbbbbbbbbb
dddddddddddddddd
BBBBBBBBBBBBbBBB
BeBBBBBBBBBBbBBB
bbbbbbbbbbbbbbbb
dddddddddddddddd
BBBBBBbBBBBBBBBB
BBBBBBbBBBBeBBBB
bbbbbbbbbbbbbbbb
`;

export const wallFaceTile = (): Img => spr('WallFace', WALL_FACE);

export function buildTiles(): Img[] {
  const t: Img[] = [];
  t[T.Void] = blank(16, 16, 'K');
  t[T.Grass] = grassBase(101);
  t[T.Grass2] = grassTufts();
  t[T.Grass3] = grassFlowers();
  t[T.Dirt] = dirtBase(404);
  t[T.Dirt2] = dirtPebbles();
  t[T.Tree] = leafyTree();
  t[T.Tree2] = pineTree();
  t[T.Bush] = onGrass(ol('Bush', BUSH, 'g'), 111);
  t[T.Rock] = onGrass(ol('Boulder', BOULDER, '1'), 121);
  t[T.Water] = spr('Water', WATER);
  t[T.CaveFloor] = caveFloorBase(606);
  t[T.CaveFloor2] = caveFloorCracks();
  t[T.CaveFloor3] = caveFloorPebbles();
  t[T.CaveWall] = caveWallTop();
  t[T.CaveWallFace] = wallFaceTile();
  t[T.Cracked] = over(wallFaceTile(), spr('Cracks', CRACKS));
  t[T.Rubble] = over(caveFloorBase(616), outline(spr('Rubble', RUBBLE), '1'));
  t[T.Pit] = spr('Pit', PIT);
  t[T.PitEdge] = spr('PitEdge', PIT_EDGE);
  t[T.Planks] = spr('Planks', PLANKS);
  return t;
}
