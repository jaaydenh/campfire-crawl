// Map data format and the small builder used to author maps in code.
// A map's layout comes from a fixed seed, so it is identical on every run.
import { O, T } from '../art/manifest';
import { Rng } from '../rng';

export type ObjType =
  | 'campfire'
  | 'chest'
  | 'pot'
  | 'sign'
  | 'npc'
  | 'door' // needs a key
  | 'gate' // opened by a puzzle
  | 'hidden' // wall that turns into floor when its puzzle is solved
  | 'plate'
  | 'block'
  | 'lever'
  | 'brazier'
  | 'spikes'
  | 'arrowtrap'
  | 'shrine'
  | 'pedestal'
  | 'sconce'
  | 'decor'
  | 'secret'; // invisible zone: entering it counts as finding the secret

export interface MapObject {
  id: string;
  type: ObjType;
  x: number; // tile
  y: number;
  section: number;
  index?: number; // campfire: checkpoint number
  merchant?: boolean; // campfire
  loot?: string; // chest: 'weapon' | 'common' | 'good' | 'rare' | 'key:<colour>'
  text?: string; // sign
  name?: string; // npc
  sprite?: number; // npc frame
  lines?: string[]; // npc
  key?: string; // door colour
  puzzle?: string; // gate, hidden, plate, block, lever, brazier, sconce
  meta?: boolean; // lever/gate: a shortcut that stays open in later runs
  timed?: number; // lever: seconds the gate stays open
  order?: number; // brazier: position in the correct sequence
  period?: number; // traps, ms
  phase?: number; // traps, 0..1
  chance?: number; // traps: probability the trap exists in a given run
  dir?: number; // arrowtrap: 0 down, 1 left, 2 up, 3 right
  item?: string; // pedestal
  secret?: string; // pedestal / secret zone
  w?: number; // secret zone size in tiles
  h?: number;
  frame?: O; // decor
  solid?: boolean; // decor
}

export interface MonsterSpawn {
  id: string;
  x: number;
  y: number;
  section: number;
  options: string[]; // one is chosen per run
}

export interface MapDef {
  id: string;
  number: number;
  name: string;
  w: number;
  h: number;
  tiles: Uint8Array;
  objects: MapObject[];
  spawns: MonsterSpawn[];
  /** Tile where a hero appears for each checkpoint; index 0 is the map start. */
  checkpoints: { x: number; y: number }[];
  sectionNames: string[];
  boss: { type: string; x: number; y: number; arena: { x0: number; y0: number; x1: number; y1: number }; gate: string };
  secrets: { id: string; name: string }[];
  /** Items added to the pool the first time the map is cleared. */
  clearUnlocks: string[];
}

export const SOLID_TILES = new Set<number>([T.Void, T.Tree, T.Tree2, T.Bush, T.Rock, T.Water, T.CaveWall, T.CaveWallFace, T.Cracked]);
export const OPAQUE_TILES = new Set<number>([T.Void, T.Tree, T.Tree2, T.CaveWall, T.CaveWallFace, T.Cracked]);
export const PIT_TILES = new Set<number>([T.Pit, T.PitEdge]);
export const CAVE_FLOORS = new Set<number>([T.CaveFloor, T.CaveFloor2, T.CaveFloor3, T.Rubble, T.Planks, T.Pit, T.PitEdge]);
/** Object types the hero cannot walk through. */
export const SOLID_OBJECTS = new Set<ObjType>(['campfire', 'chest', 'pot', 'sign', 'npc', 'door', 'gate', 'block', 'lever', 'brazier', 'shrine', 'pedestal']);

export type Zone = 'forest' | 'cave';

export class MapBuilder {
  tiles: Uint8Array;
  objects: MapObject[] = [];
  spawns: MonsterSpawn[] = [];
  checkpoints: { x: number; y: number }[] = [];
  private sec = 0;
  private n = 0;
  private rng: Rng;

  constructor(
    public w: number,
    public h: number,
    private zone: (x: number, y: number) => Zone,
    seed: number,
  ) {
    this.rng = new Rng(seed);
    this.tiles = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) this.tiles[y * w + x] = this.zone(x, y) === 'cave' ? T.CaveWall : this.rng.chance(0.3) ? T.Tree2 : T.Tree;
  }

  section(n: number): void {
    this.sec = n;
  }

  private floorTile(x: number, y: number): T {
    const r = this.rng.next();
    if (this.zone(x, y) === 'cave') return r < 0.7 ? T.CaveFloor : r < 0.85 ? T.CaveFloor2 : T.CaveFloor3;
    return r < 0.7 ? T.Grass : r < 0.9 ? T.Grass2 : T.Grass3;
  }

  set(x: number, y: number, t?: T): void {
    if (x < 2 || y < 2 || x >= this.w - 2 || y >= this.h - 2) return;
    this.tiles[y * this.w + x] = t ?? this.floorTile(x, y);
  }

  get(x: number, y: number): T {
    return this.tiles[y * this.w + x];
  }

  /** Inclusive rectangle. */
  rect(x0: number, y0: number, x1: number, y1: number, t?: T): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, t);
  }

  /** An organic clearing: an ellipse with a wobbly edge. */
  blob(cx: number, cy: number, rx: number, ry: number): void {
    const wob = Array.from({ length: 12 }, () => this.rng.range(0.86, 1.12));
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++)
      for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const a = ((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 12;
        const i = Math.floor(a) % 12;
        const f = a - Math.floor(a);
        const m = wob[i] * (1 - f) + wob[(i + 1) % 12] * f;
        if (Math.sqrt(dx * dx + dy * dy) < m) this.set(x, y);
      }
  }

  /** A trail through the points. Outdoors the middle is trodden dirt. */
  path(pts: [number, number][], width: number): void {
    const r = width / 2;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const steps = Math.ceil(Math.hypot(bx - ax, by - ay) * 2);
      for (let s = 0; s <= steps; s++) {
        const px = ax + ((bx - ax) * s) / steps;
        const py = ay + ((by - ay) * s) / steps;
        for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++)
          for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
            const d = Math.hypot(x - px, y - py);
            if (d > r + 0.2) continue;
            const cur = this.get(x, y);
            if (this.zone(x, y) === 'forest' && d < 0.8) this.set(x, y, this.rng.chance(0.25) ? T.Dirt2 : T.Dirt);
            else if (SOLID_TILES.has(cur)) this.set(x, y);
          }
      }
    }
  }

  obj(type: ObjType, x: number, y: number, props: Partial<MapObject> = {}): MapObject {
    const o: MapObject = { id: `${type}${this.n++}`, type, x, y, section: this.sec, ...props };
    this.objects.push(o);
    return o;
  }

  decor(frame: O, x: number, y: number, solid = false): void {
    this.obj('decor', x, y, { frame, solid });
  }

  spawn(x: number, y: number, ...options: string[]): void {
    this.spawns.push({ id: `m${this.spawns.length}`, x, y, section: this.sec, options });
  }

  /** Places a campfire and records where heroes appear beside it. */
  campfire(index: number, x: number, y: number, merchant = false): void {
    this.obj('campfire', x, y, { index, merchant });
    this.checkpoints[index] = { x, y: y + 1 };
  }

  /** Derives wall faces and pit lips from the finished layout. */
  finalize(): void {
    const { w, h, tiles } = this;
    for (let y = 0; y < h - 1; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const below = tiles[i + w];
        if (tiles[i] === T.CaveWall && !SOLID_TILES.has(below) && !PIT_TILES.has(below)) tiles[i] = T.CaveWallFace;
      }
    for (let y = 1; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (tiles[i] === T.Pit && !PIT_TILES.has(tiles[i - w])) tiles[i] = T.PitEdge;
      }
  }
}
