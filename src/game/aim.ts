// Aim assist for the facing control style: decides what a swing or a shot should turn toward.
import { angDiff } from './ents';

export interface AimTarget {
  x: number;
  y: number;
  r: number;
}

/** How far to either side of the facing a melee swing will turn, in radians. */
export const MELEE_CONE = 1.4;
/** The same for shots and throws. Facing has eight directions 0.79 apart, so anything wider than 0.4 leaves no blind gap. */
export const RANGED_CONE = 0.65;
/** A swing also turns toward a monster this many pixels beyond its reach, so it is already aimed as the monster steps in. */
export const MELEE_SLACK = 8;

/**
 * The best target in front of (x, y): inside the reach and inside the cone around the facing.
 * Being in line with the facing counts for more than being close. `ok` is asked only about targets that would win.
 */
export function pickTarget<T extends AimTarget>(cands: Iterable<T>, x: number, y: number, face: number, reach: number, cone: number, ok?: (t: T) => boolean): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const t of cands) {
    const d = Math.hypot(t.x - x, t.y - y);
    const edge = Math.max(0, d - t.r);
    if (edge > reach) continue;
    const off = d < 1 ? 0 : angDiff(Math.atan2(t.y - y, t.x - x), face);
    if (off > cone) continue;
    const score = off / cone + (edge / reach) * 0.6;
    if (score >= bestScore || (ok && !ok(t))) continue;
    best = t;
    bestScore = score;
  }
  return best;
}

/** The angle at which a shot of the given speed meets a target (dx, dy) away that moves at (vx, vy) pixels per second. */
export function leadAngle(dx: number, dy: number, vx: number, vy: number, speed: number): number {
  const t = Math.min(0.5, Math.hypot(dx, dy) / speed);
  return Math.atan2(dy + vy * t, dx + vx * t);
}
