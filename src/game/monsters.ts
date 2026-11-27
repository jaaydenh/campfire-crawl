// Monster behaviour, including generators and the Bandit Chief.
import { F, O } from '../art/manifest';
import { audio } from '../audio/audio';
import { G, run } from '../core';
import { CHIEF_PHASES, GENERATOR_SPAWN, MONSTERS } from '../data/monsters';
import { scaleDmg, scaleHp, spawnOn, tierMonster } from '../data/tiers';
import { bowEquipped, hasFlag, setFlag } from '../run';
import { TILE } from '../types';
import { angDiff, type Mon } from './ents';
import { DEPTH, type GameScene } from './scene';

const tx = (px: number) => Math.floor(px / TILE);
const center = (t: number) => t * TILE + TILE / 2;
const BODY = 4;

// Attack reach, in pixels (a tile is 16).
const LUNGE_SPEED = 250; // px per second
const LUNGE_RANGE = 39; // ground a wolf covers in one lunge
const LUNGE_FROM = 28; // a wolf crouches to lunge once the hero is this close
const ARROW_SPEED = 155;
const ARROW_REACH = 195; // an archer's arrow fades after flying this far
const ARCHER_RANGE = 95; // an archer draws once the hero is this close
const ARCHER_STANDOFF = 73; // and walks closer while the hero is further than this
const WEB_SPEED = 125;
const WEB_REACH = 131; // a spider's web fades after flying this far
const SPIDER_RANGE = 64; // a spider spits once the hero is this close
const VOLLEY_SPREAD = 0.3; // radians between the arrows of a marksman's fan
const BRUTE = { from: 26, reach: 36, half: 1.3, windup: 620, recover: 800, knock: 260 }; // a heavy swing, against 20 / 27 / 1.1 / 430 / 600
const SLAM = { r: 50, wind: 800, cd: 6500, from: 42 }; // the Chief's shockwave: radius, wind-up, cooldown, and how close the hero must be
const LEAP = { r: 38, wind: 700, lock: 360, air: 380, cd: 7500, min: 60, max: 175 }; // his jump: landing radius, timings, and the range he jumps from
const BURN_EVERY = 600; // ms between ticks of burn damage
const BURN_DMG = 1; // per tick, before the hero's damage bonus

function makeMon(s: GameScene, type: string, x: number, y: number, spawnId: string | null, parent: Mon | null): Mon {
  const def = tierMonster(MONSTERS[type], s.tier); // this tier's health and damage
  const gen = def.ai === 'generator';
  const spr = gen ? s.add.image(x, y, 'objects', type === 'den' ? O.Den : O.Nest) : s.add.image(x, y, def.sheet, 0).setOrigin(0.5, def.ai === 'boss' ? 0.72 : 0.65);
  spr.setDepth(DEPTH.ent + y / 100).setVisible(false);
  if (def.scale) spr.setScale(def.scale);
  return {
    spawnId, def, x, y, kx: 0, ky: 0, hp: def.hp, maxHp: def.hp, r: def.radius,
    state: 'idle', t: gen ? 1500 : 0, cd: 400 + Math.random() * 600, hitCd: 0,
    alerted: false, lostT: 0, slowT: 0, stunT: 0, chain: 0, burnT: 0, burnTick: 0, flashT: 0, face: 1, dirX: 1, dirY: 0,
    homeX: x, homeY: y, wanderT: Math.random() * 3000, wx: x, wy: y, anim: Math.random() * 1000, seed: Math.random() * 100,
    parent, children: 0, dead: false, boss: null, spr, mark: null,
  };
}

export function spawnMonsters(s: GameScene): void {
  const r = run();
  for (const sp of s.def.spawns) {
    const type = r.dead.includes(sp.id) ? null : spawnOn(sp, r.seed, s.tier);
    if (!type) continue;
    s.mons.push(makeMon(s, type, center(sp.x), center(sp.y), sp.id, null));
  }
  if (!hasFlag(r, 'boss:dead')) {
    const b = s.def.boss;
    const m = makeMon(s, b.type, center(b.x), center(b.y), null, null);
    m.hp = m.maxHp = scaleHp(CHIEF_PHASES[r.bossPhase], s.tier);
    m.boss = { phase: r.bossPhase, mode: 'idle', t: 0, ang: 0, chargeCd: 3500, throwCd: 2500, whirlCd: 4000, chain: 0, slamCd: 4500, leapCd: 6000, sx: 0, sy: 0, tx: 0, ty: 0 };
    s.mons.push(m);
    s.boss = m;
  }
}

function alert(s: GameScene, m: Mon): void {
  if (m.alerted) return;
  m.alerted = true;
  m.lostT = 0;
  if (m.state === 'idle') {
    m.state = m.def.ai === 'hopper' ? 'recover' : 'chase';
    m.t = 250;
  }
  if (m.def.ai === 'generator' || m.boss) return;
  m.mark?.destroy();
  const mark = s.add.image(m.x, m.y - 14, 'fx', F.Alert).setDepth(DEPTH.top);
  m.mark = mark;
  s.time.delayedCall(600, () => {
    mark.destroy();
    if (m.mark === mark) m.mark = null;
  });
}

/** True when a small body can travel the straight line without touching anything. */
function clearLine(s: GameScene, x0: number, y0: number, x1: number, y1: number, fly: boolean): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d > 170) return false;
  const n = Math.ceil(d / 6);
  for (let i = 1; i <= n; i++) {
    if (s.hits(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 3, fly)) return false;
  }
  return true;
}

/** Walks toward a point: straight if the way is clear, otherwise along the hero flow field. */
function steer(s: GameScene, m: Mon, tgx: number, tgy: number, speed: number, dt: number, fly: boolean, useFlow: boolean): void {
  let dx = tgx - m.x;
  let dy = tgy - m.y;
  if (Math.hypot(dx, dy) < 1.5) return;
  if (useFlow && !clearLine(s, m.x, m.y, tgx, tgy, fly)) {
    const w = s.world;
    const cx = tx(m.x);
    const cy = tx(m.y);
    let best = w.flow[w.idx(cx, cy)];
    let bx = cx;
    let by = cy;
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (!w.inside(cx + ox, cy + oy)) continue;
      const f = w.flow[w.idx(cx + ox, cy + oy)];
      if (f < best) {
        best = f;
        bx = cx + ox;
        by = cy + oy;
      }
    }
    if (best >= 999) return; // no known route: hold position
    if (bx !== cx || by !== cy) {
      dx = center(bx) - m.x;
      dy = center(by) - m.y;
    }
  }
  const d = Math.hypot(dx, dy) || 1;
  const step = (speed * dt) / 1000;
  s.moveBody(m, (dx / d) * step, (dy / d) * step, m.boss ? 8 : BODY, fly);
  if (Math.abs(dx) > 2) m.face = dx < 0 ? -1 : 1;
}

function summon(s: GameScene, type: string, x: number, y: number, parent: Mon | null): Mon | null {
  // find a free tile at or next to the wanted spot
  for (const [ox, oy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const cx = tx(x) + ox;
    const cy = tx(y) + oy;
    if (!s.world.walkable(cx, cy)) continue;
    const m = makeMon(s, type, center(cx), center(cy), null, parent);
    m.alerted = true;
    m.state = 'chase';
    s.mons.push(m);
    s.fx(F.Poof0, m.x, m.y, 300);
    return m;
  }
  return null;
}

/** Hurts a monster and shoves it. `stun` is how long, in ms, the hit leaves it unable to act. */
export function damageMon(s: GameScene, m: Mon, dmg: number, kx: number, ky: number, stun = 0): void {
  if (m.dead) return;
  if (m.boss) {
    if (m.boss.mode === 'break' || m.boss.mode === 'idle') {
      s.fx(F.Spark, m.x, m.y - 8, 150);
      return;
    }
    if (m.boss.mode === 'stun') dmg *= 1.5;
    kx *= 0.12;
    ky *= 0.12;
  }
  if (m.def.ai === 'generator') kx = ky = 0;
  if (m.def.heavy) {
    // a brute barely budges and shakes a stun off fast
    kx *= 0.3;
    ky *= 0.3;
    stun *= 0.4;
  }
  if (m.boss || m.def.ai === 'generator') dmg *= s.stats.bigMult; // Giant Slayer
  else if (!m.alerted) dmg *= s.stats.ambushMult; // Opening Strike
  m.hp -= dmg;
  m.flashT = 90;
  m.kx += kx;
  m.ky += ky;
  alert(s, m);
  // the Chief and generators shrug stuns off, as they do knockback
  if (stun > 0 && !m.boss && m.def.ai !== 'generator') {
    m.stunT = Math.max(m.stunT, stun);
    if (m.state === 'attack') {
      // knocked out of a lunge: it does not carry on once the stun ends
      m.state = 'recover';
      m.t = 780;
      m.cd = 1100;
      m.chain = 0;
    }
  }
  s.number(m.x, m.y - 12, dmg, 0xffffff);
  if (m.hp > 0) return;
  if (m.boss && m.boss.phase < CHIEF_PHASES.length - 1) bossBreak(s, m);
  else kill(s, m);
}

function kill(s: GameScene, m: Mon): void {
  const r = run();
  m.dead = true;
  m.spr.setVisible(false);
  m.mark?.destroy();
  m.mark = null;
  s.fx(F.Poof0, m.x, m.y - 2, 350);
  audio.sfx('monsterDie');
  r.kills++;
  if (!G.save!.bestiary.includes(m.def.id)) G.save!.bestiary.push(m.def.id);
  if (m.parent) m.parent.children--;
  // a brood slime bursts into two of its young
  if (m.def.split) for (const side of [-1, 1]) summon(s, m.def.split, m.x + side * 7, m.y, null);
  const h = s.hero;
  const hurt = h ? run().heroes[run().active].hp < s.stats.maxHp * 0.4 : false;
  if (m.spawnId) {
    s.attemptKills.push(m.spawnId);
    const [a, b] = m.def.gold;
    s.dropCoin(m.x, m.y, a + Math.floor(Math.random() * (b - a + 1)));
  }
  if (Math.random() < (hurt ? 0.25 : 0.12) * s.tier.hearts) s.dropHeart(m.x, m.y);
  if (bowEquipped(run().heroes[run().active]) && Math.random() < s.stats.arrowDrop) s.dropArrows(m.x, m.y);
  if (m.boss) {
    setFlag(r, 'boss:dead');
    s.boss = null;
    s.world.bossLocked = false;
    for (const other of s.mons) if (!other.dead && other !== m && !other.spawnId) kill(s, other);
    for (const p of s.projs) if (!p.fromHero) p.life = 0;
    for (let i = 0; i < 6; i++) s.time.delayedCall(i * 160, () => s.fx(F.Explosion0, m.x + (Math.random() - 0.5) * 30, m.y + (Math.random() - 0.5) * 30, 300));
    s.cameras.main.shake(900, 0.008);
    for (let i = 0; i < 8; i++) s.dropCoin(m.x, m.y, 5);
    s.time.delayedCall(2200, () => G.hooks.onBossDefeated());
  }
}

function bossBreak(s: GameScene, m: Mon): void {
  const b = m.boss!;
  b.phase++;
  run().bossPhase = b.phase;
  m.hp = m.maxHp = scaleHp(CHIEF_PHASES[b.phase], s.tier);
  b.mode = 'break';
  b.t = 1700;
  b.chargeCd = 3000;
  b.throwCd = 1500;
  b.whirlCd = 2500;
  b.slamCd = 3500;
  b.leapCd = 4500;
  for (const p of s.projs) if (!p.fromHero) p.life = 0;
  const h = s.hero!;
  const a = Math.atan2(h.y - m.y, h.x - m.x);
  h.kx = Math.cos(a) * 260;
  h.ky = Math.sin(a) * 260;
  s.cameras.main.shake(500, 0.008);
  s.cameras.main.flash(200, 255, 240, 200);
  s.dropHeart(m.x + 12, m.y);
  s.dropHeart(m.x - 12, m.y);
  // his men arrive in the corners of the hall, the far side first
  const ar = s.def.boss.arena;
  const corners = [[ar.x0 + 2, ar.y0 + 2], [ar.x0 + 2, ar.y1 - 2], [ar.x1 - 2, ar.y0 + 2], [ar.x1 - 2, ar.y1 - 2]];
  (s.tier.bossHelp[b.phase - 1] ?? []).forEach((type, i) => summon(s, type, center(corners[i % 4][0]), center(corners[i % 4][1]), null));
  G.hooks.onBossPhase(b.phase);
}

function updateBoss(s: GameScene, m: Mon, dt: number, dist: number, toHero: number, los: boolean): void {
  const b = m.boss!;
  const h = s.hero!;
  const enraged = b.phase >= 2;
  const fast = enraged ? 0.75 : 1;
  const speed = (enraged ? 58 : 42) * (m.slowT > 0 ? 0.6 : 1);
  b.t -= dt;
  if (b.mode !== 'idle' && b.mode !== 'break') {
    b.chargeCd -= dt;
    b.throwCd -= dt;
    b.whirlCd -= dt;
    b.slamCd -= dt;
    b.leapCd -= dt;
  }
  const moves = s.tier.bossMoves;
  // a shockwave around the Chief: it bursts where he stands, or where he lands
  const shock = (radius: number, dmg: number) => {
    const ring = s.add.circle(m.x, m.y, radius, 0xffb060, 0.3).setStrokeStyle(2, 0xffe0a0).setDepth(DEPTH.fx).setScale(0.25);
    s.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    s.cameras.main.shake(260, 0.008);
    audio.sfx('explode');
    if (Math.hypot(h.x - m.x, h.y - m.y) < radius + 4) s.hurtHero(dmg, m.x, m.y, { knock: 300 });
  };
  const throwAxes = (n: number, spread: number, base: number) => {
    for (let i = 0; i < n; i++) {
      const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * 2 * spread);
      s.addProj(m.x + Math.cos(a) * 10, m.y - 6 + Math.sin(a) * 10, Math.cos(a) * 118, Math.sin(a) * 118, { frame: F.Axe, dmg: scaleDmg(4, s.tier), life: 2600, fromHero: false, spin: 12, r: 4 });
    }
    audio.sfx('swing');
  };
  switch (b.mode) {
    case 'idle':
      break;
    case 'break':
    case 'recover':
    case 'stun':
      if (b.t <= 0) b.mode = 'walk';
      break;
    case 'walk':
      if (h.dead) break;
      steer(s, m, h.x, h.y, speed, dt, false, true);
      if (moves.includes('slam') && b.slamCd <= 0 && dist < SLAM.from) {
        b.mode = 'slamWind';
        b.t = SLAM.wind * fast;
        audio.sfx('bossRoar');
      } else if (moves.includes('leap') && b.leapCd <= 0 && dist > LEAP.min && dist < LEAP.max && los) {
        b.mode = 'leapWind';
        b.t = LEAP.wind * fast;
        b.tx = h.x;
        b.ty = h.y;
        audio.sfx('bossRoar');
      } else if (dist < 28) {
        b.mode = 'cleaveWind';
        b.t = 520 * fast;
        b.ang = toHero;
      } else if (b.chargeCd <= 0 && dist > 52 && los) {
        b.mode = 'chargeWind';
        b.t = 680 * fast;
        b.ang = toHero;
        b.chain = 0;
        audio.sfx('bossRoar');
      } else if (b.phase >= 1 && b.throwCd <= 0 && dist > 40 && los) {
        b.mode = 'throwWind';
        b.t = 460 * fast;
        b.ang = toHero;
      } else if (enraged && b.whirlCd <= 0) {
        b.mode = 'whirlWind';
        b.t = 620;
      }
      break;
    case 'cleaveWind':
      if (b.t > 250) b.ang = toHero;
      if (b.t <= 0) {
        audio.sfx('swing');
        const spr = s.add.image(m.x + Math.cos(b.ang) * 18, m.y - 6 + Math.sin(b.ang) * 18, 'fx', F.Slash0).setRotation(b.ang).setScale(2.2).setTint(0xffb0a0).setDepth(DEPTH.fx);
        s.tweens.add({ targets: spr, alpha: 0, duration: 180, onComplete: () => spr.destroy() });
        if (dist < 38 && angDiff(toHero, b.ang) < 1.2) s.hurtHero(m.def.dmg, m.x, m.y, { knock: 240 });
        b.mode = 'recover';
        b.t = 700 * fast;
      }
      break;
    case 'chargeWind':
      if (b.t > 180) b.ang = toHero;
      if (b.t <= 0) {
        b.mode = 'charge';
        b.t = 850;
        audio.sfx('dash');
      }
      break;
    case 'charge': {
      const step = (235 * dt) / 1000;
      const free = s.moveBody(m, Math.cos(b.ang) * step, Math.sin(b.ang) * step, 8, false);
      m.face = Math.cos(b.ang) < 0 ? -1 : 1;
      b.chargeCd = 5200 * fast;
      if (!free) {
        b.mode = 'stun';
        b.t = 1500;
        s.cameras.main.shake(250, 0.007);
        audio.sfx('explode');
        s.fx(F.Spark, m.x + Math.cos(b.ang) * 10, m.y - 6 + Math.sin(b.ang) * 10, 300);
      } else if (dist < 17 && s.hurtHero(m.def.dmg + 1, m.x, m.y, { knock: 280 })) {
        b.mode = 'recover';
        b.t = 500;
      } else if (b.t <= 0) {
        if (enraged && b.chain < 1) {
          b.chain++;
          b.mode = 'chargeWind';
          b.t = 420;
          b.ang = toHero;
        } else {
          b.mode = 'recover';
          b.t = 450;
        }
      }
      break;
    }
    case 'slamWind':
      if (b.t <= 0) {
        shock(SLAM.r, m.def.dmg);
        b.slamCd = SLAM.cd * fast;
        b.mode = 'recover';
        b.t = 800 * fast;
      }
      break;
    case 'leapWind':
      // the landing spot follows the hero until just before he jumps
      if (b.t > LEAP.lock && !h.dead) {
        b.tx = h.x;
        b.ty = h.y;
      }
      if (b.t <= 0) {
        // land on open ground: the spot itself, or the nearest clear one around it
        const spots = [[0, 0], ...[6, 12, 18].flatMap((d) => [[d, 0], [-d, 0], [0, d], [0, -d], [d, d], [-d, d], [d, -d], [-d, -d]])];
        const spot = spots.find(([ox, oy]) => !s.hits(b.tx + ox, b.ty + oy, 8, false));
        if (!spot) {
          b.mode = 'walk';
          b.leapCd = 2000;
          break;
        }
        b.tx += spot[0];
        b.ty += spot[1];
        b.sx = m.x;
        b.sy = m.y;
        b.mode = 'leap';
        b.t = LEAP.air;
        audio.sfx('dash');
      }
      break;
    case 'leap': {
      const k = 1 - Math.max(0, b.t) / LEAP.air;
      m.x = b.sx + (b.tx - b.sx) * k;
      m.y = b.sy + (b.ty - b.sy) * k;
      m.kx = m.ky = 0;
      m.face = b.tx < b.sx ? -1 : 1;
      if (b.t <= 0) {
        shock(LEAP.r, m.def.dmg + 1);
        b.leapCd = LEAP.cd * fast;
        b.mode = 'recover';
        b.t = 750 * fast;
      }
      break;
    }
    case 'throwWind':
      b.ang = toHero;
      if (b.t <= 0) {
        throwAxes(enraged ? 5 : 3, enraged ? 0.55 : 0.32, b.ang);
        b.throwCd = 3400 * fast;
        b.mode = 'recover';
        b.t = 380;
      }
      break;
    case 'whirlWind':
      if (b.t <= 0) {
        throwAxes(10, Math.PI * 0.9, toHero);
        b.whirlCd = 5200;
        b.mode = 'recover';
        b.t = 550;
      }
      break;
  }
  const wind = b.mode === 'cleaveWind' || b.mode === 'chargeWind' || b.mode === 'throwWind' || b.mode === 'whirlWind' || b.mode === 'charge' || b.mode === 'slamWind' || b.mode === 'leapWind' || b.mode === 'leap';
  const base = enraged ? 3 : 0;
  m.spr.setFrame(wind ? base + 2 : base + (b.mode === 'walk' ? Math.floor(m.anim / 220) % 2 : 0));
  if (b.mode !== 'charge' && b.mode !== 'leap' && Math.abs(h.x - m.x) > 3) m.face = h.x < m.x ? -1 : 1;
}

export function updateMonsters(s: GameScene, dt: number): void {
  const h = s.hero!;
  const w = s.world;
  const sec = dt / 1000;
  for (const m of s.mons) {
    if (m.dead) continue;
    const dx = h.x - m.x;
    const dy = h.y - m.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 24 * TILE && !m.alerted) continue; // far away and asleep
    m.hitCd -= dt;
    m.slowT -= dt;
    m.stunT -= dt;
    m.flashT -= dt;
    if (m.burnT > 0) {
      // set alight by a burning blade: a little damage every tick until it burns out
      m.burnT -= dt;
      m.burnTick -= dt;
      if (m.burnTick <= 0) {
        m.burnTick = BURN_EVERY;
        damageMon(s, m, BURN_DMG * s.stats.dmgMult, 0, 0);
        if (m.spr.visible) s.fx(F.Firebolt1, m.x + (Math.random() - 0.5) * 6, m.y - 8, 260);
        if (m.dead) continue;
      }
    }
    const stunned = m.stunT > 0;
    if (!stunned) {
      m.cd -= dt; // the attack cooldown waits out a stun, as the state timer does
      m.anim += dt;
    }
    const ai = m.def.ai;
    const fly = ai === 'flyer';
    if (Math.abs(m.kx) + Math.abs(m.ky) > 2) {
      s.moveBody(m, m.kx * sec, m.ky * sec, m.boss ? 8 : BODY, fly);
      const damp = Math.min(1, dt * 0.012);
      m.kx -= m.kx * damp;
      m.ky -= m.ky * damp;
    }
    const toHero = Math.atan2(dy, dx);
    const los = dist < 15 * TILE && w.los(tx(m.x), tx(m.y), tx(h.x), tx(h.y));
    if (!m.alerted && !h.dead && !m.boss && dist < m.def.aggro * TILE && los) alert(s, m);
    if (m.alerted && !m.boss) {
      if (dist > 15 * TILE || h.dead) {
        m.lostT += dt;
        if (m.lostT > 3000 || h.dead) {
          m.alerted = false;
          m.state = 'idle';
        }
      } else m.lostT = 0;
    }
    const slow = m.slowT > 0 ? 0.3 : 1;
    const speed = m.def.speed * slow;
    const touch = dist < m.r + 5;
    let windup = false;

    if (stunned) {
      // does nothing: its state timer waits too, so a wind-up picks up where it stopped
    } else if (m.boss) {
      updateBoss(s, m, dt, dist, toHero, los);
    } else if (ai === 'generator') {
      if (m.alerted) {
        m.t -= dt;
        if (m.t <= 0 && m.children < s.tier.hatchMax) {
          if (summon(s, GENERATOR_SPAWN[m.def.id], m.x, m.y + TILE, m)) m.children++;
          m.t = s.tier.hatchEvery;
        }
      }
    } else if (!m.alerted) {
      // idle: drift around home
      m.wanderT -= dt;
      if (m.wanderT <= 0) {
        m.wanderT = 1500 + Math.random() * 2500;
        m.wx = m.homeX + (Math.random() - 0.5) * 40;
        m.wy = m.homeY + (Math.random() - 0.5) * 40;
      }
      steer(s, m, m.wx, m.wy, m.def.speed * 0.3, dt, fly, false);
    } else {
      m.t -= dt;
      switch (ai) {
        case 'hopper':
          if (m.state === 'chase') {
            steer(s, m, h.x, h.y, speed * 2.2, dt, false, true);
            if (m.t <= 0) {
              m.state = 'recover';
              m.t = 480;
            }
          } else if (m.t <= 0) {
            m.state = 'chase';
            m.t = 360;
          }
          if (touch && m.hitCd <= 0 && s.hurtHero(m.def.dmg, m.x, m.y)) m.hitCd = 800;
          break;
        case 'lunger':
          if (m.state === 'chase') {
            steer(s, m, h.x, h.y, speed, dt, false, true);
            if (dist < LUNGE_FROM && m.cd <= 0 && los) {
              m.state = 'windup';
              m.t = 300;
            }
          } else if (m.state === 'windup') {
            windup = true;
            m.dirX = Math.cos(toHero);
            m.dirY = Math.sin(toHero);
            m.face = dx < 0 ? -1 : 1;
            if (m.t <= 0) {
              m.state = 'attack';
              m.t = (LUNGE_RANGE / LUNGE_SPEED) * 1000;
            }
          } else if (m.state === 'attack') {
            const step = LUNGE_SPEED * slow * sec;
            s.moveBody(m, m.dirX * step, m.dirY * step, BODY, false);
            if (touch && m.hitCd <= 0 && s.hurtHero(m.def.dmg, m.x, m.y)) m.hitCd = 600;
            if (m.t <= 0) {
              if (m.chain + 1 < (m.def.lunges ?? 1)) {
                // a dire wolf gathers itself and lunges again at once
                m.chain++;
                m.state = 'windup';
                m.t = 240;
              } else {
                m.chain = 0;
                m.state = 'recover';
                m.t = 780;
                m.cd = 1100;
              }
            }
          } else if (m.t <= 0) m.state = 'chase';
          break;
        case 'melee':
          if (m.state === 'chase') {
            steer(s, m, h.x, h.y, speed, dt, false, true);
            if (dist < (m.def.heavy ? BRUTE.from : 20)) {
              m.state = 'windup';
              m.t = m.def.heavy ? BRUTE.windup : 430;
              m.dirX = Math.cos(toHero);
              m.dirY = Math.sin(toHero);
            }
          } else if (m.state === 'windup') {
            windup = true;
            if (m.t <= 0) {
              const a = Math.atan2(m.dirY, m.dirX);
              audio.sfx('swing');
              const heavy = !!m.def.heavy;
              const spr = s.add.image(m.x + m.dirX * (heavy ? 17 : 12), m.y - 3 + m.dirY * (heavy ? 17 : 12), 'fx', F.Slash0).setRotation(a).setScale(heavy ? 1.5 : 1).setTint(0xffb0a0).setDepth(DEPTH.fx);
              s.tweens.add({ targets: spr, alpha: 0, duration: 150, onComplete: () => spr.destroy() });
              if (dist < (heavy ? BRUTE.reach : 27) && angDiff(toHero, a) < (heavy ? BRUTE.half : 1.1)) s.hurtHero(m.def.dmg, m.x, m.y, heavy ? { knock: BRUTE.knock } : {});
              m.state = 'recover';
              m.t = heavy ? BRUTE.recover : 600;
            }
          } else if (m.t <= 0) m.state = 'chase';
          break;
        case 'ranged':
          if (m.state === 'windup') {
            windup = true;
            m.face = dx < 0 ? -1 : 1;
            if (m.t <= 0) {
              const n = m.def.volley ?? 1;
              for (let i = 0; i < n; i++) {
                const a = toHero + (i - (n - 1) / 2) * VOLLEY_SPREAD;
                s.addProj(m.x + Math.cos(a) * 8, m.y - 3 + Math.sin(a) * 8, Math.cos(a) * ARROW_SPEED, Math.sin(a) * ARROW_SPEED, { frame: F.EnemyArrow, dmg: m.def.dmg, life: (ARROW_REACH / ARROW_SPEED) * 1000, fromHero: false });
              }
              audio.sfx('shoot');
              m.cd = 1900;
              m.state = 'chase';
            }
          } else {
            if (dist < 56) steer(s, m, m.x - dx, m.y - dy, speed, dt, false, false);
            else if (dist > ARCHER_STANDOFF || !los) steer(s, m, h.x, h.y, speed, dt, false, true);
            if (m.cd <= 0 && los && dist < ARCHER_RANGE) {
              m.state = 'windup';
              m.t = 520;
            }
          }
          break;
        case 'flyer':
          if (m.state === 'flee') {
            steer(s, m, m.x - dx, m.y - dy, speed, dt, true, false);
            if (m.t <= 0) m.state = 'chase';
          } else {
            const off = Math.sin(s.clock / 280 + m.seed) * Math.min(26, dist * 0.6);
            steer(s, m, h.x - Math.sin(toHero) * off, h.y + Math.cos(toHero) * off, speed, dt, true, true);
            if (dist < 9 && m.hitCd <= 0 && s.hurtHero(m.def.dmg, m.x, m.y, { knock: 80 })) {
              m.hitCd = 500;
              m.state = 'flee';
              m.t = 750;
            }
          }
          break;
        case 'spitter':
          if (m.state === 'windup') {
            windup = true;
            if (m.t <= 0) {
              s.addProj(m.x, m.y - 2, Math.cos(toHero) * WEB_SPEED, Math.sin(toHero) * WEB_SPEED, { frame: F.Web, dmg: 1, life: (WEB_REACH / WEB_SPEED) * 1000, fromHero: false, web: true, spin: 6 });
              audio.sfx('shoot');
              m.cd = 2600;
              m.state = 'chase';
            }
          } else {
            steer(s, m, h.x, h.y, speed, dt, false, true);
            if (m.cd <= 0 && dist < SPIDER_RANGE && dist > 26 && los) {
              m.state = 'windup';
              m.t = 420;
            }
          }
          if (touch && m.hitCd <= 0 && s.hurtHero(m.def.dmg, m.x, m.y)) m.hitCd = 900;
          break;
      }
    }

    // sprite
    const spr = m.spr;
    spr.setPosition(Math.round(m.x), Math.round(m.y)).setDepth(DEPTH.ent + m.y / 100);
    if (ai !== 'generator') {
      if (!m.boss) spr.setFrame(Math.floor(m.anim / (ai === 'flyer' ? 110 : 230)) % 2);
      spr.setFlipX(m.face < 0);
    }
    if (m.boss?.mode === 'leap') spr.y -= Math.sin((1 - Math.max(0, m.boss.t) / LEAP.air) * Math.PI) * 22; // in the air
    if (m.flashT > 0) spr.setTintFill(0xffffff);
    else if (stunned || m.boss?.mode === 'stun') spr.setTint(0x9a9aa8);
    else if (m.boss?.mode === 'break') spr.setTint(Math.floor(s.clock / 90) % 2 ? 0xffe08a : 0xffffff);
    else if (m.burnT > 0) spr.setTint(0xffa860);
    else if (m.slowT > 0) spr.setTint(0x8fc8ff);
    else if (windup) spr.setTint(Math.floor(s.clock / 80) % 2 ? 0xff8a7a : 0xffffff);
    else spr.clearTint();
    m.mark?.setPosition(m.x, m.y - 15);
  }

  // keep alerted monsters from stacking on one spot
  const live = s.mons.filter((m) => !m.dead && m.alerted && m.def.ai !== 'generator');
  for (let i = 0; i < live.length; i++)
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const min = a.r + b.r;
      if (d >= min || d < 0.01) continue;
      const push = (min - d) / 2;
      if (!a.boss) s.moveBody(a, (-dx / d) * push, (-dy / d) * push, BODY, a.def.ai === 'flyer');
      if (!b.boss) s.moveBody(b, (dx / d) * push, (dy / d) * push, BODY, b.def.ai === 'flyer');
    }

  if (s.mons.some((m) => m.dead)) {
    for (const m of s.mons) if (m.dead) m.spr.destroy();
    s.mons = s.mons.filter((m) => !m.dead);
  }
}

/** Red warning shapes for attacks that are about to land, and the stars over a stunned monster. */
export function drawTelegraphs(s: GameScene): void {
  const g = s.tele;
  g.clear();
  const h = s.hero;
  if (!h) return;
  for (const m of s.mons) {
    if (m.dead || !m.spr.visible) continue;
    if (m.boss) {
      const b = m.boss;
      if (b.mode === 'cleaveWind') {
        g.fillStyle(0xff3020, 0.3);
        g.slice(m.x, m.y - 4, 38, b.ang - 1.2, b.ang + 1.2, false);
        g.fillPath();
      } else if (b.mode === 'chargeWind') {
        g.lineStyle(14, 0xff3020, 0.22);
        g.lineBetween(m.x, m.y, m.x + Math.cos(b.ang) * 200, m.y + Math.sin(b.ang) * 200);
      } else if (b.mode === 'whirlWind') {
        g.fillStyle(0xff3020, 0.25);
        g.fillCircle(m.x, m.y - 4, 30);
      } else if (b.mode === 'slamWind') {
        g.fillStyle(0xff3020, 0.25);
        g.fillCircle(m.x, m.y, SLAM.r);
        g.lineStyle(1, 0xff3020, 0.5);
        g.strokeCircle(m.x, m.y, SLAM.r);
      } else if (b.mode === 'leapWind' || b.mode === 'leap') {
        g.fillStyle(0xff3020, b.mode === 'leap' ? 0.35 : 0.22);
        g.fillCircle(b.tx, b.ty, LEAP.r);
        g.lineStyle(1, 0xff3020, 0.5);
        g.strokeCircle(b.tx, b.ty, LEAP.r);
      } else if (b.mode === 'throwWind') {
        g.lineStyle(2, 0xff3020, 0.35);
        g.lineBetween(m.x, m.y - 6, m.x + Math.cos(b.ang) * 120, m.y - 6 + Math.sin(b.ang) * 120);
      }
      continue;
    }
    if (m.stunT > 0) {
      g.fillStyle(0xffe08a, 1);
      for (const k of [0, Math.PI]) {
        const a = s.clock / 110 + k;
        g.fillRect(Math.round(m.x + Math.cos(a) * 5) - 1, Math.round(m.y - 13 + Math.sin(a) * 2) - 1, 2, 2);
      }
    }
    if (m.state !== 'windup') continue;
    if (m.def.ai === 'melee') {
      const a = Math.atan2(m.dirY, m.dirX);
      g.fillStyle(0xff3020, 0.28);
      g.slice(m.x, m.y - 2, m.def.heavy ? BRUTE.reach : 27, a - (m.def.heavy ? BRUTE.half : 1.1), a + (m.def.heavy ? BRUTE.half : 1.1), false);
      g.fillPath();
    } else if (m.def.ai === 'lunger') {
      g.lineStyle(6, 0xff3020, 0.22);
      g.lineBetween(m.x, m.y, m.x + m.dirX * LUNGE_RANGE, m.y + m.dirY * LUNGE_RANGE);
    } else if (m.def.ai === 'ranged') {
      g.lineStyle(1, 0xff3020, 0.4);
      g.lineBetween(m.x, m.y - 3, h.x, h.y - 3);
    }
  }
}
