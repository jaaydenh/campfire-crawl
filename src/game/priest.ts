// The Drowned Priest, mini-boss of the sunken temple. Where the Chief runs the hero down, the Priest keeps
// his distance and fights with the water: bolts, geysers, and a sanctum that floods further with every phase.
import type Phaser from 'phaser';
import { F } from '../art/manifest';
import { audio } from '../audio/audio';
import { TILE } from '../types';
import type { Mon } from './ents';
import { DEPTH, VORTEX, type GameScene } from './scene';

const tx = (px: number) => Math.floor(px / TILE);
const center = (t: number) => t * TILE + TILE / 2;

const DRIFT = { speed: 26, enraged: 34, near: 64, far: 112 }; // he glides to keep a spell's length away
const BOLT = { wind: 480, speed: 125, life: 2400, cd: 2400 }; // a fan of water bolts
const GEYSER = { wind: 880, r: 13, cd: 4800, spread: 56 }; // circles that burst: one under the hero, the rest around them
const SURGE = { wind: 1050, cd: 9000, spent: 1500 }; // every flooded tile of the sanctum strikes at once, and leaves him spent
const SINK = { near: 34, after: 1100, down: 480, up: 720, r: 24 }; // crowded for long enough, he sinks and rises somewhere else
const POOL = { wind: 800, lock: 300, cd: 9500 }; // tier 2: a whirlpool under the hero
const WAVE = { wind: 1150, cd: 13000, speed: 80, gap: 3, step: 9 }; // tier 3: a wall of water with one gap, `gap` tiles wide

/** Fresh cooldowns after a phase breaks. */
export function priestBreak(s: GameScene, m: Mon): void {
  const b = m.boss!;
  b.cd = { bolt: 1500, geyser: 2600, surge: 4200, pool: 4000, wave: 6000 };
  b.marks = [];
  b.near = 0;
  s.vortices = [];
  m.spr.setAlpha(1).setScale(1);
  s.applyTiles(s.world.floodArena(b.phase)); // the water comes up
}

/** The flooded tiles of the sanctum, as pixel rectangles. */
function floodedTiles(s: GameScene): number[] {
  return (s.def.boss.flood ?? []).slice(0, s.world.flooded).flat();
}

export function updatePriest(s: GameScene, m: Mon, dt: number, dist: number, toHero: number, los: boolean): void {
  const b = m.boss!;
  const h = s.hero!;
  const w = s.world;
  const ar = s.def.boss.arena;
  const enraged = b.phase >= 2;
  const fast = enraged ? 0.78 : 1;
  const moves = s.tier.bossMoves.priest ?? [];
  b.t -= dt;
  if (b.mode !== 'idle' && b.mode !== 'break') for (const k of Object.keys(b.cd)) b.cd[k] -= dt;
  const splash = (x: number, y: number, r: number) => {
    const ring = s.add.circle(x, y, r, 0x9fe8ff, 0.35).setStrokeStyle(2, 0xe4f8ff).setDepth(DEPTH.fx).setScale(0.3);
    s.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 280, onComplete: () => ring.destroy() });
    s.fx(F.Splash, x, y - 4, 380);
  };

  switch (b.mode) {
    case 'idle':
      break;
    case 'break':
    case 'recover':
    case 'stun':
      if (b.t <= 0) b.mode = 'walk';
      break;
    case 'walk': {
      if (h.dead) break;
      const step = ((enraged ? DRIFT.enraged : DRIFT.speed) * (m.slowT > 0 ? 0.6 : 1) * dt) / 1000;
      const c = Math.cos(toHero);
      const sn = Math.sin(toHero);
      const turn = Math.sin(s.clock / 2600) > 0 ? 1 : -1;
      const [ax, ay] = dist < DRIFT.near ? [-c, -sn] : dist > DRIFT.far ? [c, sn] : [-sn * turn, c * turn];
      s.moveBody(m, ax * step, ay * step, 8, false);
      b.near = dist < SINK.near ? b.near + dt : Math.max(0, b.near - dt * 2);
      if (b.near > SINK.after) {
        b.mode = 'sink';
        b.t = SINK.down;
        audio.sfx('splash');
      } else if (b.phase >= 1 && w.flooded > 0 && b.cd.surge <= 0) {
        b.mode = 'surgeWind';
        b.t = SURGE.wind * fast;
        audio.sfx('bossRoar');
      } else if (moves.includes('wave') && b.cd.wave <= 0) {
        b.mode = 'waveWind';
        b.t = WAVE.wind * fast;
        const side = Math.floor(Math.random() * 4);
        const span = side < 2 ? ar.y1 - ar.y0 : ar.x1 - ar.x0;
        b.wave = { side, gap: 1 + Math.floor(Math.random() * (span - WAVE.gap - 1)) };
        audio.sfx('bossRoar');
      } else if (moves.includes('pool') && b.cd.pool <= 0 && dist < 150) {
        b.mode = 'poolWind';
        b.t = POOL.wind * fast;
        b.tx = h.x;
        b.ty = h.y;
      } else if (b.cd.geyser <= 0 && los) {
        b.mode = 'geyserWind';
        b.t = GEYSER.wind * fast;
        b.marks = [{ x: h.x, y: h.y, r: GEYSER.r }];
        for (let tries = 0; tries < 30 && b.marks.length < 3 + b.phase; tries++) {
          const a = Math.random() * Math.PI * 2;
          const d = 22 + Math.random() * (GEYSER.spread - 22);
          const x = h.x + Math.cos(a) * d;
          const y = h.y + Math.sin(a) * d;
          if (w.walkable(tx(x), tx(y)) && b.marks.every((k) => Math.hypot(k.x - x, k.y - y) > GEYSER.r * 1.5)) b.marks.push({ x, y, r: GEYSER.r });
        }
      } else if (b.cd.bolt <= 0 && los && dist > 30) {
        b.mode = 'boltWind';
        b.t = BOLT.wind * fast;
        b.ang = toHero;
      }
      break;
    }
    case 'boltWind':
      if (b.t > 160) b.ang = toHero;
      if (b.t <= 0) {
        const n = enraged ? 5 : 3;
        const spread = enraged ? 0.52 : 0.3;
        for (let i = 0; i < n; i++) {
          const a = b.ang + (i / (n - 1) - 0.5) * 2 * spread;
          s.addProj(m.x + Math.cos(a) * 10, m.y - 6 + Math.sin(a) * 10, Math.cos(a) * BOLT.speed, Math.sin(a) * BOLT.speed, { frame: F.WaterBolt, dmg: Math.max(1, Math.round(m.def.dmg * 0.7)), life: BOLT.life, fromHero: false, r: 4 });
        }
        audio.sfx('shoot');
        b.cd.bolt = BOLT.cd * fast;
        b.mode = 'recover';
        b.t = 350;
      }
      break;
    case 'geyserWind':
      if (b.t <= 0) {
        audio.sfx('splash');
        for (const k of b.marks) {
          splash(k.x, k.y, k.r + 3);
          if (Math.hypot(h.x - k.x, h.y - k.y) < k.r + 3) s.hurtHero(m.def.dmg, k.x, k.y, { knock: 200 });
        }
        s.cameras.main.shake(160, 0.004);
        b.marks = [];
        b.cd.geyser = GEYSER.cd * fast;
        b.mode = 'recover';
        b.t = 900 * fast;
      }
      break;
    case 'surgeWind':
      if (b.t <= 0) {
        // everything standing in the flood is struck; dry ground is safe
        const tiles = floodedTiles(s);
        audio.sfx('splash');
        audio.sfx('explode');
        s.cameras.main.shake(300, 0.007);
        for (let n = 0; n < 14 && tiles.length; n++) {
          const i = tiles[Math.floor(Math.random() * tiles.length)];
          s.time.delayedCall(n * 20, () => s.fx(F.Splash, center(i % w.w), center(Math.floor(i / w.w)), 360));
        }
        if (w.bog(tx(h.x), tx(h.y)) && tiles.includes(w.idx(tx(h.x), tx(h.y)))) s.hurtHero(m.def.dmg + 1, h.x, h.y + 4, { knock: 0 });
        b.cd.surge = SURGE.cd * fast;
        b.mode = 'stun'; // spent: he takes more for a moment
        b.t = SURGE.spent;
      }
      break;
    case 'poolWind':
      if (b.t > POOL.lock && !h.dead) {
        b.tx = h.x;
        b.ty = h.y;
      }
      if (b.t <= 0) {
        s.vortices.push({ x: b.tx, y: b.ty, t: VORTEX.ms, tick: 0, dmg: Math.max(1, Math.round(m.def.dmg * 0.5)) });
        audio.sfx('splash');
        b.cd.pool = POOL.cd * fast;
        b.mode = 'recover';
        b.t = 500;
      }
      break;
    case 'waveWind':
      if (b.t <= 0) {
        // a wall of bolts crosses the sanctum from one side; the gap is the only way through that is not a pillar
        const { side, gap } = b.wave;
        const along = side < 2; // the wall moves along x
        const from = along ? ar.y0 * TILE : ar.x0 * TILE;
        const to = along ? (ar.y1 + 1) * TILE : (ar.x1 + 1) * TILE;
        const g0 = from + gap * TILE;
        const g1 = g0 + WAVE.gap * TILE;
        const start = side === 0 ? ar.x0 * TILE + 4 : side === 1 ? (ar.x1 + 1) * TILE - 4 : side === 2 ? ar.y0 * TILE + 4 : (ar.y1 + 1) * TILE - 4;
        const dir = side === 0 || side === 2 ? 1 : -1;
        const life = (((along ? ar.x1 - ar.x0 : ar.y1 - ar.y0) + 1) * TILE * 1000) / WAVE.speed;
        for (let p = from + 4; p < to; p += WAVE.step) {
          if (p > g0 && p < g1) continue;
          const [x, y] = along ? [start, p] : [p, start];
          if (w.solid(tx(x), tx(y))) continue;
          s.addProj(x, y, along ? dir * WAVE.speed : 0, along ? 0 : dir * WAVE.speed, { frame: F.WaterBolt, dmg: Math.max(1, Math.round(m.def.dmg * 0.7)), life, fromHero: false, r: 4 });
        }
        audio.sfx('splash');
        b.cd.wave = WAVE.cd * fast;
        b.mode = 'recover';
        b.t = 700;
      }
      break;
    case 'sink':
      if (b.t <= 0) {
        // up again at whichever of his places is furthest from the hero
        const spots = (s.def.boss.anchors ?? [{ x: s.def.boss.x, y: s.def.boss.y }]).map((a) => ({ x: center(a.x), y: center(a.y) }));
        spots.sort((p, q) => Math.hypot(q.x - h.x, q.y - h.y) - Math.hypot(p.x - h.x, p.y - h.y));
        const spot = spots[Math.random() < 0.7 || spots.length < 2 ? 0 : 1];
        m.x = spot.x;
        m.y = spot.y;
        m.kx = m.ky = 0;
        b.mode = 'rise';
        b.t = SINK.up * fast;
        b.near = 0;
      }
      break;
    case 'rise':
      if (b.t <= 0) {
        splash(m.x, m.y, SINK.r);
        audio.sfx('splash');
        if (Math.hypot(h.x - m.x, h.y - m.y) < SINK.r + 3) s.hurtHero(Math.max(1, m.def.dmg - 1), m.x, m.y, { knock: 260 });
        b.mode = 'recover';
        b.t = 450;
      }
      break;
  }

  const cast = b.mode === 'boltWind' || b.mode === 'geyserWind' || b.mode === 'surgeWind' || b.mode === 'poolWind' || b.mode === 'waveWind';
  const base = enraged ? 3 : 0;
  m.spr.setFrame(cast ? base + 2 : base + (Math.floor(m.anim / 260) % 2));
  // under the floor he cannot be seen or hurt
  const under = b.mode === 'sink' ? Math.max(0, b.t / SINK.down) : b.mode === 'rise' ? 1 - Math.max(0, b.t / (SINK.up * fast)) : 1;
  m.spr.setScale(1, Math.max(0.08, under)).setAlpha(b.mode === 'sink' || b.mode === 'rise' ? 0.35 + under * 0.4 : 1);
  if (Math.abs(h.x - m.x) > 3) m.face = h.x < m.x ? -1 : 1;
}

/** Red warnings for what the Priest is about to do. */
export function drawPriest(s: GameScene, g: Phaser.GameObjects.Graphics, m: Mon): void {
  const b = m.boss!;
  const ar = s.def.boss.arena;
  const w = s.world;
  const flash = Math.floor(s.clock / 110) % 2 ? 0.3 : 0.18;
  const ring = (x: number, y: number, r: number, fill = 0.24) => {
    g.fillStyle(0xff3020, fill);
    g.fillCircle(x, y, r);
    g.lineStyle(1, 0xff3020, 0.5);
    g.strokeCircle(x, y, r);
  };
  if (b.mode === 'boltWind') {
    const n = b.phase >= 2 ? 5 : 3;
    const spread = b.phase >= 2 ? 0.52 : 0.3;
    g.lineStyle(2, 0xff3020, 0.3);
    for (let i = 0; i < n; i++) {
      const a = b.ang + (i / (n - 1) - 0.5) * 2 * spread;
      g.lineBetween(m.x, m.y - 6, m.x + Math.cos(a) * 130, m.y - 6 + Math.sin(a) * 130);
    }
  } else if (b.mode === 'geyserWind') {
    for (const k of b.marks) ring(k.x, k.y, k.r + 3);
  } else if (b.mode === 'surgeWind') {
    g.fillStyle(0xff3020, flash);
    for (const i of floodedTiles(s)) g.fillRect((i % w.w) * TILE, Math.floor(i / w.w) * TILE, TILE, TILE);
  } else if (b.mode === 'poolWind') {
    ring(b.tx, b.ty, VORTEX.r, 0.2);
  } else if (b.mode === 'rise') {
    ring(m.x, m.y, SINK.r);
  } else if (b.mode === 'waveWind') {
    const { side, gap } = b.wave;
    const along = side < 2;
    const from = along ? ar.y0 : ar.x0;
    const to = along ? ar.y1 : ar.x1;
    const edge = side === 0 ? ar.x0 : side === 1 ? ar.x1 : side === 2 ? ar.y0 : ar.y1;
    for (let p = from; p <= to; p++) {
      const open = p >= from + gap && p < from + gap + WAVE.gap;
      const [x, y] = along ? [edge, p] : [p, edge];
      g.fillStyle(open ? 0x60ff80 : 0xff3020, open ? 0.3 : flash + 0.1);
      g.fillRect(x * TILE, y * TILE, TILE, TILE);
    }
    // the whole hall is in its path but for one lane: shown all the way across, since the edge may be out of view
    const lane = (from + gap) * TILE;
    const [x0, y0, w, h] = [ar.x0 * TILE, ar.y0 * TILE, (ar.x1 - ar.x0 + 1) * TILE, (ar.y1 - ar.y0 + 1) * TILE];
    g.fillStyle(0xff3020, 0.09);
    g.fillRect(x0, y0, w, h);
    g.fillStyle(0x60ff80, 0.2);
    if (along) g.fillRect(x0, lane, w, WAVE.gap * TILE);
    else g.fillRect(lane, y0, WAVE.gap * TILE, h);
  }
}
