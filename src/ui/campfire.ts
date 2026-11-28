// The campfire on the title screen: pixel art that is simulated rather than drawn frame by frame.
// Heat rises through a small grid and is painted in the game's fire colours at the game's pixel
// size; sparks, a bed of coals, a dithered halo and a soft wash of firelight sit around it.
import { type Img, blank, outline, over, set } from '../art/draw';
import { PALETTE } from '../art/palette';
import { audio } from '../audio/audio';

/** Screen pixels per game pixel, the same as the rest of the art. */
const SCALE = 3;
/** Canvas size in game pixels. It is far larger than the fire so the halo and the sparks have room. */
const W = 128;
const H = 112;
/** Where the fire stands on the canvas: its centre column, and the row the stones rest on. */
const FX = 64;
const GY = 84;

/** The logs and stones, in game pixels. */
const BW = 32;
const BH = 14;
/** The grid the heat rises through. Its bottom row sits where the logs cross. */
const FW = 30;
const FH = 44;
const F_LEFT = FX - FW / 2;
const F_TOP = GY - 6 - (FH - 1);
const F_MID = (FW - 1) / 2;

const TICK_MS = 66;
/** Heat lost per row on average: the tallest tongues reach about 1 / COOL rows. */
const COOL = 0.031;

const colour = (key: string, alpha = 255): number => {
  const [r, g, b] = PALETTE[key];
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
};

/** Coolest to hottest: the flame is banded like the game's other fire, not blended. */
const FLAME: ReadonlyArray<readonly [number, number]> = [
  [0.8, colour('Y')],
  [0.6, colour('O')],
  [0.4, colour('o')],
  [0.22, colour('R')],
  [0.1, colour('r')],
];
const COALS = [colour('r'), colour('R'), colour('o'), colour('O')];
const SPARK = [colour('R'), colour('o'), colour('O'), colour('Y')];

// ---------------------------------------------------------------- logs and stones

function buildBase(): Img {
  const stamp = (rows: string[], x0: number, y0: number): Img => {
    const img = blank(BW, BH);
    rows.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && set(img, x0 + x, y0 + y, c)));
    return outline(img);
  };
  // Two logs crossed in a low X, charred where the fire sits on them.
  const log = (rising: boolean): Img => {
    const img = blank(BW, BH);
    for (let i = 0; i < 20; i++) {
      const x = rising ? 6 + i : 25 - i;
      const y = 8 - Math.floor(i / 3);
      const burnt = Math.abs(i - 9.5) < 3;
      const sawn = i === 19;
      set(img, x, y, sawn ? 'D' : burnt ? 'B' : 'd');
      set(img, x, y + 1, sawn ? 'd' : burnt ? 'b' : 'B');
      set(img, x, y + 2, burnt ? '1' : 'b');
    }
    return outline(img);
  };
  // A ring of stones seen from the front: the near ones along the ground, one further back at each side.
  // Their tops and inner faces catch the firelight.
  const stones: Img[] = [
    stamp(['.D4.', 'D432', '.32.'], 1, 7),
    stamp(['.4D.', '34D3', '.23.'], 27, 7),
    stamp(['.4D4.', '44D32', '.332.'], 4, 10),
    stamp(['.4DD4.', '44D432', '.3322.'], 10, 10),
    stamp(['.4D4.', '34D43', '.233.'], 17, 10),
    stamp(['.D4.', '2344', '.23.'], 23, 10),
  ];
  let img = over(log(false), log(true));
  for (const s of stones) img = over(img, s);
  return img;
}

// ---------------------------------------------------------------- the fire itself

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  span: number;
}

/** One fire for the whole page: the title screen is redrawn often, and the flame should not start over each time. */
const fire = {
  base: null as Img | null,
  coals: [] as { i: number; phase: number; rate: number }[],
  heat: new Float32Array(FW * FH),
  tongue: new Float32Array(FW).fill(0.8),
  want: new Float32Array(FW).fill(0.8),
  sparks: [] as Spark[],
  time: 0,
  flare: 0,
  nextPop: 60,
  wind: 0,
  /** Brightness of the fire against its own average, about 0.8 to 1.2. */
  glow: 1,
  average: 0,
};
let mounted = 0;

function spit(n: number, hard: boolean): void {
  for (let i = 0; i < n; i++) {
    const span = 10 + Math.random() * (hard ? 26 : 16);
    fire.sparks.push({
      x: FX - 0.5 + (Math.random() - 0.5) * 9,
      y: GY - 12 - Math.random() * 10,
      vx: (Math.random() - 0.5) * (hard ? 1.5 : 0.6),
      vy: -(0.5 + Math.random() * (hard ? 1.5 : 0.7)),
      life: span,
      span,
    });
  }
}

function step(live: boolean): void {
  const f = fire;
  f.time++;
  f.wind = Math.sin(f.time * 0.07) * 0.5 + Math.sin(f.time * 0.19 + 1.3) * 0.3;

  // Every few seconds a log pops: the fire flares and spits a handful of sparks.
  if (f.time >= f.nextPop) {
    f.nextPop = f.time + 35 + Math.random() * 75;
    f.flare = 1;
    spit(4 + Math.floor(Math.random() * 5), true);
    if (live) audio.sfx('pop');
  }
  f.flare *= 0.75;
  if (Math.random() < 0.1) spit(1, false);

  // Heat climbs a row a tick, cooling as it goes and faster toward the sides, which gives the flame its point.
  // Now and then it comes from the cell beside the one below: that is what makes the tongues lean and lick.
  const heat = f.heat;
  let sum = 0;
  for (let y = 0; y < FH - 1; y++) {
    const lean = f.wind * (1 - y / FH) * 0.14;
    for (let x = 0; x < FW; x++) {
      const r = Math.random();
      const sx = x + (r < 0.22 - lean ? 1 : r > 0.78 - lean ? -1 : 0);
      const below = sx < 0 || sx >= FW ? 0 : heat[(y + 1) * FW + sx];
      const dx = (x - F_MID) / 10;
      const v = below - COOL * (0.35 + Math.random() * 1.3) * (1 + 2 * dx * dx);
      heat[y * FW + x] = v > 0 ? v : 0;
      sum += heat[y * FW + x];
    }
  }

  // The fuel: a shallow bowl of heat where the logs cross, each column burning at its own changing strength.
  const breath = 0.92 + 0.07 * Math.sin(f.time * 0.11) + 0.3 * f.flare;
  for (let x = 0; x < FW; x++) {
    if (Math.random() < 0.3) f.want[x] = 0.5 + Math.random() * 0.5;
    f.tongue[x] += (f.want[x] - f.tongue[x]) * 0.5;
    for (let k = 0; k < 3; k++) {
      const dx = (x - F_MID) / [5, 7, 8.5][k];
      const v = f.tongue[x] * breath * (1 - dx * dx);
      const i = (FH - 1 - k) * FW + x;
      if (v > heat[i]) heat[i] = v;
    }
  }

  for (let i = f.sparks.length - 1; i >= 0; i--) {
    const s = f.sparks[i];
    s.vx += (Math.random() - 0.5) * 0.16 + f.wind * 0.015;
    s.vy *= 0.97;
    s.x += s.vx;
    s.y += s.vy;
    if (--s.life <= 0 || s.y < 0) f.sparks.splice(i, 1);
  }

  f.average = f.average ? f.average + (sum - f.average) * 0.02 : sum;
  const now = f.average ? sum / f.average : 1;
  f.glow += (Math.min(1.25, Math.max(0.75, now)) - f.glow) * 0.4;
}

function paint(ctx: CanvasRenderingContext2D, image: ImageData, px: Uint32Array): void {
  const f = fire;
  const base = f.base!;
  const bx = FX - BW / 2;
  const by = GY - (BH - 1);
  px.fill(0);

  // coals glowing under the crossed logs, each on its own slow pulse
  for (const c of f.coals) {
    const v = 0.5 + 0.5 * Math.sin(f.time * c.rate + c.phase) + f.flare * 0.5;
    px[c.i] = COALS[Math.min(COALS.length - 1, Math.floor(v * COALS.length))];
  }
  for (let y = 0; y < BH; y++) {
    for (let x = 0; x < BW; x++) {
      const key = base.px[y * BW + x];
      if (key !== '.') px[(by + y) * W + bx + x] = colour(key);
    }
  }
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const v = f.heat[y * FW + x];
      if (v < 0.1) continue;
      for (const [min, c] of FLAME) {
        if (v >= min) {
          px[(F_TOP + y) * W + F_LEFT + x] = c;
          break;
        }
      }
    }
  }
  for (const s of f.sparks) {
    const x = Math.round(s.x);
    const y = Math.round(s.y);
    if (x < 0 || x >= W || y < 0 || y >= H) continue;
    px[y * W + x] = SPARK[Math.min(SPARK.length - 1, Math.floor((s.life / s.span) * SPARK.length))];
  }
  ctx.putImageData(image, 0, 0);
}

// ---------------------------------------------------------------- the light around it

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The halo in the air and the lit ground under the fire. Painted once: only its brightness flickers. */
function paintGlow(ctx: CanvasRenderingContext2D): void {
  const image = ctx.createImageData(W, H);
  const px = new Uint32Array(image.data.buffer);
  const ground = [colour('b'), colour('B'), colour('e')];
  const air = ['r', 'R', 'R', 'o', 'o', 'o', 'o'];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const th = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      // ordered dither: a level between two bands becomes a pattern of both
      const band = (v: number): number => Math.floor(v) + (v - Math.floor(v) > th ? 1 : 0);

      const gx = (x - FX + 0.5) / 34;
      const gy = (y - (GY - 2)) / 7.5;
      const lit = band((1 - Math.sqrt(gx * gx + gy * gy)) * 3.3);
      if (lit > 0) {
        px[y * W + x] = ground[Math.min(ground.length, lit) - 1];
        continue;
      }
      const hx = (x - FX + 0.5) / 60;
      const hy = (y - (GY - 22)) / 54;
      const d = Math.sqrt(hx * hx + hy * hy);
      if (d >= 1) continue;
      const level = Math.min(air.length, band((1 - d) ** 1.8 * air.length));
      if (level > 0) px[y * W + x] = colour(air[level - 1], Math.round((level / air.length) * 150));
    }
  }
  ctx.putImageData(image, 0, 0);
}

function makeCanvas(cls: string): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  cv.className = cls;
  cv.setAttribute('aria-hidden', 'true');
  // the fire stands at the middle of the bottom edge of its holder
  cv.style.cssText = `width:${W * SCALE}px;height:${H * SCALE}px;left:50%;margin-left:${-FX * SCALE}px;bottom:${-(H - GY) * SCALE}px`;
  return [cv, cv.getContext('2d')!];
}

/** Lights the fire inside `host`. It burns until the host leaves the page or a new fire is lit. */
export function mountCampfire(host: HTMLElement): void {
  const f = fire;
  if (!f.base) {
    f.base = buildBase();
    // the coal bed fills the gap under the crossed logs
    for (let y = 8; y <= 9; y++) {
      for (let x = 16 - (y - 6) * 2; x < 16 + (y - 6) * 2; x++) {
        if (f.base.px[y * BW + x] === '.') f.coals.push({ i: (GY - (BH - 1) + y) * W + FX - BW / 2 + x, phase: Math.random() * 6.3, rate: 0.12 + Math.random() * 0.3 });
      }
    }
    for (let i = 0; i < 90; i++) step(false); // already burning when first seen
  }

  const [glowCv, glowCtx] = makeCanvas('fireglow');
  const [fireCv, ctx] = makeCanvas('firepix');
  const light = document.createElement('div');
  light.className = 'firelight';
  host.append(glowCv, fireCv, light);
  paintGlow(glowCtx);
  const image = ctx.createImageData(W, H);
  const px = new Uint32Array(image.data.buffer);
  paint(ctx, image, px);

  const still = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tick = still ? 220 : TICK_MS;
  const row = host.parentElement;
  const run = ++mounted;
  let last = performance.now();
  let owed = 0;
  const frame = (now: number): void => {
    if (run !== mounted || !host.isConnected) return;
    owed = Math.min(owed + now - last, tick * 3);
    last = now;
    if (owed >= tick) {
      while (owed >= tick) {
        step(true);
        owed -= tick;
      }
      paint(ctx, image, px);
      if (!still) {
        // 0 at the dimmest flicker, 1 at the brightest
        const g = Math.min(1, Math.max(0, (f.glow - 0.8) / 0.4));
        glowCv.style.opacity = (0.72 + 0.28 * g).toFixed(3);
        light.style.opacity = (0.78 + 0.22 * g).toFixed(3);
        row?.style.setProperty('--fire', g.toFixed(3));
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
