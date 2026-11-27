// The live state of a map during a run: what is open, solved, explored and visible.
// No rendering here, so the rules can be reasoned about (and tested) on their own.
import { T } from '../art/manifest';
import { tierDef } from '../data/tiers';
import { hasFlag, pedestalItem, prizeTaken } from '../run';
import { seeded } from '../rng';
import type { RunState, SaveFile } from '../types';
import { OPAQUE_TILES, PIT_TILES, SOLID_OBJECTS, SOLID_TILES, type MapDef, type MapObject } from '../world/mapdef';
import { unpackBits } from '../run';

export interface Obj {
  def: MapObject;
  x: number; // current tile (blocks move)
  y: number;
  open: boolean; // door/gate open, chest opened, pot broken, shrine used, pedestal taken
  item?: string; // pedestal: the item it holds in this run
  lit: boolean; // brazier
  on: boolean; // lever
  pressed: boolean; // plate
  exists: boolean; // traps may be absent in a given run
  up: boolean; // spikes
  timer: number; // trap clock, ms
}

export const FLOW_MAX = 30;

export class World {
  w: number;
  h: number;
  tiles: Uint8Array;
  blocked: Uint8Array; // solid objects
  explored: Uint8Array;
  visible: Uint8Array;
  flow: Int16Array; // walking distance to the hero, FLOW_MAX+ = unknown
  objs: Obj[] = [];
  /** Seconds left on timed gates, by puzzle. */
  timers: Record<string, number> = {};
  bossLocked = false;

  constructor(
    public def: MapDef,
    private run: RunState,
    private save: SaveFile,
  ) {
    this.w = def.w;
    this.h = def.h;
    this.tiles = def.tiles.slice();
    this.blocked = new Uint8Array(this.w * this.h);
    this.visible = new Uint8Array(this.w * this.h);
    this.flow = new Int16Array(this.w * this.h).fill(999);
    this.explored = unpackBits(run.explored, this.w * this.h);
    for (const f of run.flags) {
      if (f.startsWith('crack:')) {
        const [x, y] = f.slice(6).split(',').map(Number);
        this.tiles[y * this.w + x] = T.Rubble;
      }
    }
    for (const d of def.objects) {
      const o: Obj = { def: d, x: d.x, y: d.y, open: false, lit: false, on: false, pressed: false, exists: true, up: false, timer: 0 };
      if (d.type === 'chest' || d.type === 'pot' || d.type === 'door' || d.type === 'shrine' || d.type === 'pedestal') o.open = hasFlag(run, 'o:' + d.id);
      if (d.type === 'pedestal') o.item = pedestalItem(run, save, d);
      // a secret's prize is won once per save: in later runs its pedestal stands empty
      if (d.type === 'pedestal' && d.secret && prizeTaken(save, def.id, d.secret)) o.open = true;
      if (d.type === 'spikes' || d.type === 'arrowtrap') {
        // optional traps are there more often on higher tiers
        o.exists = d.chance === undefined || seeded(run.seed, d.id).next() < d.chance + tierDef(run.tier).trapChance;
        o.timer = (d.phase ?? 0) * (d.period ?? 2000);
      }
      this.objs.push(o);
    }
    this.resetPuzzlePieces();
    this.syncGates();
  }

  idx(tx: number, ty: number): number {
    return ty * this.w + tx;
  }
  inside(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.w && ty < this.h;
  }
  tile(tx: number, ty: number): T {
    return this.inside(tx, ty) ? this.tiles[ty * this.w + tx] : T.Void;
  }
  solid(tx: number, ty: number): boolean {
    if (!this.inside(tx, ty)) return true;
    const i = ty * this.w + tx;
    return SOLID_TILES.has(this.tiles[i]) || this.blocked[i] === 1;
  }
  pit(tx: number, ty: number): boolean {
    return PIT_TILES.has(this.tile(tx, ty));
  }
  walkable(tx: number, ty: number): boolean {
    return !this.solid(tx, ty) && !this.pit(tx, ty);
  }
  opaque(tx: number, ty: number): boolean {
    if (!this.inside(tx, ty)) return true;
    return OPAQUE_TILES.has(this.tiles[ty * this.w + tx]);
  }
  isCave(tx: number, ty: number): boolean {
    const t = this.tile(tx, ty);
    return t >= T.CaveFloor && t <= T.Planks;
  }

  solved(puzzle: string): boolean {
    return hasFlag(this.run, 'pz:' + puzzle) || !!this.save.knowledge[this.def.id]?.shortcuts.includes(puzzle);
  }

  ofPuzzle(puzzle: string, type: string): Obj[] {
    return this.objs.filter((o) => o.def.puzzle === puzzle && o.def.type === type);
  }

  objAt(tx: number, ty: number, type?: string): Obj | undefined {
    return this.objs.find((o) => o.x === tx && o.y === ty && (!type || o.def.type === type) && o.def.type !== 'secret');
  }

  /** Puts blocks, levers and braziers into the state their puzzle implies. Unsolved puzzles start over. */
  resetPuzzlePieces(): void {
    for (const o of this.objs) {
      const p = o.def.puzzle;
      if (!p) continue;
      const done = this.solved(p);
      if (o.def.type === 'lever') o.on = done;
      if (o.def.type === 'brazier') o.lit = done;
      if (o.def.type === 'block') {
        const plate = done ? this.ofPuzzle(p, 'plate')[0] : undefined;
        o.x = plate ? plate.x : o.def.x;
        o.y = plate ? plate.y : o.def.y;
      }
    }
    this.timers = {};
    this.updatePlates(-1, -1);
  }

  /** Recomputes plate states; returns puzzles that just became permanently solved. */
  updatePlates(heroTx: number, heroTy: number): string[] {
    const newlySolved: string[] = [];
    const byPuzzle = new Map<string, Obj[]>();
    for (const o of this.objs) {
      if (o.def.type !== 'plate') continue;
      const hasBlock = this.objs.some((b) => b.def.type === 'block' && b.x === o.x && b.y === o.y);
      o.pressed = hasBlock || (o.x === heroTx && o.y === heroTy);
      const list = byPuzzle.get(o.def.puzzle!) ?? [];
      list.push(o);
      byPuzzle.set(o.def.puzzle!, list);
      (o as Obj & { hasBlock?: boolean }).hasBlock = hasBlock;
    }
    for (const [p, plates] of byPuzzle) {
      if (!this.solved(p) && plates.every((pl) => (pl as Obj & { hasBlock?: boolean }).hasBlock)) newlySolved.push(p);
    }
    return newlySolved;
  }

  gateOpen(puzzle: string): boolean {
    if (puzzle === this.def.boss.gate) return !this.bossLocked;
    if (this.solved(puzzle) || (this.timers[puzzle] ?? 0) > 0) return true;
    const plates = this.ofPuzzle(puzzle, 'plate');
    return plates.length > 0 && plates.every((p) => p.pressed);
  }

  /** Applies puzzle state to gates and hidden walls, then rebuilds the collision grid. Returns gates that changed. */
  syncGates(keepShut?: (o: Obj) => boolean): Obj[] {
    const changed: Obj[] = [];
    for (const o of this.objs) {
      if (o.def.type !== 'gate' && o.def.type !== 'hidden') continue;
      let open = this.gateOpen(o.def.puzzle!);
      if (!open && o.open && keepShut && !keepShut(o)) open = true; // someone is standing in it: wait
      if (open !== o.open) {
        o.open = open;
        changed.push(o);
        if (o.def.type === 'hidden') this.tiles[this.idx(o.x, o.y)] = open ? T.CaveFloor : T.CaveWall;
      }
    }
    this.refreshBlocked();
    return changed;
  }

  refreshBlocked(): void {
    this.blocked.fill(0);
    for (const o of this.objs) {
      const t = o.def.type;
      let solid = SOLID_OBJECTS.has(t) || (t === 'decor' && !!o.def.solid);
      if ((t === 'door' || t === 'gate' || t === 'pot') && o.open) solid = false;
      if (solid) this.blocked[this.idx(o.x, o.y)] = 1;
    }
  }

  /** True when nothing opaque lies between two tiles. */
  los(x0: number, y0: number, x1: number, y1: number): boolean {
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (let guard = 0; guard < 200; guard++) {
      if (x === x1 && y === y1) return true;
      if ((x !== x0 || y !== y0) && this.opaque(x, y)) return false;
      const e2 = err * 2;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    return false;
  }

  /** Marks what the hero can see from a tile. Returns true if anything new was explored. */
  computeVisible(hx: number, hy: number, radius: number): boolean {
    this.visible.fill(0);
    let found = false;
    const r = Math.ceil(radius);
    for (let y = hy - r; y <= hy + r; y++)
      for (let x = hx - r; x <= hx + r; x++) {
        if (!this.inside(x, y)) continue;
        if ((x - hx) * (x - hx) + (y - hy) * (y - hy) > radius * radius) continue;
        if (!this.los(hx, hy, x, y)) continue;
        const i = this.idx(x, y);
        this.visible[i] = 1;
        if (!this.explored[i]) {
          this.explored[i] = 1;
          found = true;
        }
      }
    return found;
  }

  revealAround(hx: number, hy: number, radius: number): void {
    for (let y = hy - radius; y <= hy + radius; y++)
      for (let x = hx - radius; x <= hx + radius; x++) {
        if (this.inside(x, y) && (x - hx) ** 2 + (y - hy) ** 2 <= radius * radius) this.explored[this.idx(x, y)] = 1;
      }
  }

  /** Breadth-first walking distances from the hero, used by monsters to path around walls. */
  computeFlow(hx: number, hy: number): void {
    this.flow.fill(999);
    if (!this.inside(hx, hy)) return;
    const q: number[] = [this.idx(hx, hy)];
    this.flow[q[0]] = 0;
    for (let head = 0; head < q.length; head++) {
      const i = q[head];
      const d = this.flow[i];
      if (d >= FLOW_MAX) continue;
      const x = i % this.w;
      const y = (i - x) / this.w;
      for (let k = 0; k < 4; k++) {
        const nx = x + (k === 0 ? 1 : k === 1 ? -1 : 0);
        const ny = y + (k === 2 ? 1 : k === 3 ? -1 : 0);
        if (!this.walkable(nx, ny)) continue;
        const j = this.idx(nx, ny);
        if (this.flow[j] <= d + 1) continue;
        this.flow[j] = d + 1;
        q.push(j);
      }
    }
  }
}
