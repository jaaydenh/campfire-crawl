// Map data format and the small builder used to author maps in code.
// A map's layout comes from a fixed seed, so it is identical on every run.
import { O, T } from '../art/manifest';
import type { MusicTrack } from '../audio/manifest';
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
  | 'valve' // sluice wheel: turning it raises or lowers the water of its channel
  | 'vent' // gas vent: puffs a poison cloud on a timer
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
  item?: string; // pedestal: the item it holds
  prize?: boolean; // pedestal without `item`: holds a rare or better item from the pool, picked per run
  secret?: string; // pedestal / secret zone
  w?: number; // secret zone size in tiles
  h?: number;
  frame?: O; // decor
  solid?: boolean; // decor
  channel?: string; // valve: the water channel it works
}

export interface MonsterSpawn {
  id: string;
  x: number;
  y: number;
  section: number;
  options: string[]; // one is chosen per run
  /** The lowest difficulty tier this monster appears on. Missing means every tier. */
  minTier?: number;
}

export interface MapDef {
  id: string;
  /** The difficulty tier this build of the map is for. */
  tier: number;
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
  boss: {
    type: string;
    x: number;
    y: number;
    arena: { x0: number; y0: number; x1: number; y1: number };
    gate: string;
    /** Arena tiles that flood to shallow water as each phase breaks: one list of tile indexes per break. */
    flood?: number[][];
    /** Tiles a boss that moves by sinking and rising may come up on. */
    anchors?: { x: number; y: number }[];
    /** The arena is lit while the fight is on: the hero sees all of it, not only their own light. */
    lit?: boolean;
  };
  /** This tier's secrets. Ids are unique across the tiers of a map, so what a save has found is recorded per tier. */
  secrets: { id: string; name: string }[];
  /** Items added to the pool the first time the map is cleared on this tier. */
  clearUnlocks: string[];
  /** 1 where a tile is indoors: no daylight, and the indoor music plays. */
  indoor: Uint8Array;
  /** How much tougher this map's monsters are than the monster table says, before the tier's own multipliers. */
  scale: { hp: number; dmg: number };
  music: { outdoor: MusicTrack; indoor: MusicTrack };
  /**
   * Water channels, by name. At high water a channel's `flood` tiles are deep water and its `float` tiles are
   * rafts to walk on; at low water the flood tiles are wet floor and the rafts lie at the bottom of their shafts.
   * Every channel starts each turn at high water unless `low` is set.
   */
  water: Record<string, WaterChannel>;
}

export interface WaterChannel {
  flood: number[];
  float: number[];
  low: boolean;
}

export const SOLID_TILES = new Set<number>([
  T.Void, T.Tree, T.Tree2, T.Bush, T.Rock, T.Water, T.CaveWall, T.CaveWallFace, T.Cracked,
  T.MireTree, T.MireTree2, T.Reeds, T.TempleWall, T.TempleWallFace, T.TempleCracked,
]);
export const OPAQUE_TILES = new Set<number>([T.Void, T.Tree, T.Tree2, T.CaveWall, T.CaveWallFace, T.Cracked, T.MireTree, T.MireTree2, T.TempleWall, T.TempleWallFace, T.TempleCracked]);
export const PIT_TILES = new Set<number>([T.Pit, T.PitEdge]);
/** Deep water: nothing walks through it or dashes over it, but shots and flyers cross. */
export const DEEP_TILES = new Set<number>([T.Murk, T.Flood]);
/** Shallow mire: walkable, slowly. */
export const BOG_TILES = new Set<number>([T.Bog, T.Bog2]);
/** Floors that give way a moment after the hero steps on them, and what they leave behind until they come back. */
export const CRUMBLE_TILES = new Map<number, T>([[T.Sinking, T.Murk], [T.Crumble, T.Pit]]);
/** True for a tile nothing on foot can stand on. */
export const blocksWalk = (t: number): boolean => SOLID_TILES.has(t) || PIT_TILES.has(t) || DEEP_TILES.has(t);

/** A kind of wall: its top, its face, the cracked face a bomb opens, and the floor it opens into. */
export interface WallKind {
  wall: T;
  face: T;
  cracked: T;
  rubble: T;
  floor: T;
}
export const ROCK: WallKind = { wall: T.CaveWall, face: T.CaveWallFace, cracked: T.Cracked, rubble: T.Rubble, floor: T.CaveFloor };
export const MASONRY: WallKind = { wall: T.TempleWall, face: T.TempleWallFace, cracked: T.TempleCracked, rubble: T.TempleRubble, floor: T.TempleFloor };
/** The kind of wall a tile belongs to, or null for a tile that is not a wall. */
export function wallKind(t: number): WallKind | null {
  for (const k of [ROCK, MASONRY]) if (t === k.wall || t === k.face || t === k.cracked) return k;
  return null;
}

/** Object types the hero cannot walk through. */
export const SOLID_OBJECTS = new Set<ObjType>(['campfire', 'chest', 'pot', 'sign', 'npc', 'door', 'gate', 'block', 'lever', 'brazier', 'shrine', 'pedestal', 'valve']);

export type Zone = 'forest' | 'cave' | 'swamp' | 'temple';
const INDOOR: Record<Zone, boolean> = { forest: false, swamp: false, cave: true, temple: true };

export class MapBuilder {
  tiles: Uint8Array;
  objects: MapObject[] = [];
  spawns: MonsterSpawn[] = [];
  checkpoints: { x: number; y: number }[] = [];
  water: Record<string, WaterChannel> = {};
  private sec = 0;
  private n = 0;
  private extras = 0;
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
      for (let x = 0; x < w; x++) {
        const z = this.zone(x, y);
        const alt = this.rng.chance(0.3);
        this.tiles[y * w + x] = z === 'cave' ? T.CaveWall : z === 'temple' ? T.TempleWall : z === 'swamp' ? (alt ? T.MireTree2 : T.MireTree) : alt ? T.Tree2 : T.Tree;
      }
  }

  section(n: number): void {
    this.sec = n;
  }

  private floorTile(x: number, y: number): T {
    const r = this.rng.next();
    const z = this.zone(x, y);
    if (z === 'cave') return r < 0.7 ? T.CaveFloor : r < 0.85 ? T.CaveFloor2 : T.CaveFloor3;
    if (z === 'temple') return r < 0.86 ? T.TempleFloor : r < 0.92 ? T.TempleFloor2 : T.TempleFloor3;
    if (z === 'swamp') return r < 0.74 ? T.Mud : r < 0.9 ? T.Mud2 : T.Mud3;
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

  /** An organic clearing: an ellipse with a wobbly edge. With `t` it is filled with that tile instead of ground. */
  blob(cx: number, cy: number, rx: number, ry: number, t?: T | (() => T)): void {
    const wob = Array.from({ length: 12 }, () => this.rng.range(0.86, 1.12));
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++)
      for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const a = ((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * 12;
        const i = Math.floor(a) % 12;
        const f = a - Math.floor(a);
        const m = wob[i] * (1 - f) + wob[(i + 1) % 12] * f;
        if (Math.sqrt(dx * dx + dy * dy) < m) this.set(x, y, typeof t === 'function' ? t() : t);
      }
  }

  /** Fills a rectangle with the wall of its zone: solid rock, masonry or trees. Used to seal what a tier does not have. */
  seal(x0: number, y0: number, x1: number, y1: number): void {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const z = this.zone(x, y);
        this.set(x, y, z === 'cave' ? T.CaveWall : z === 'temple' ? T.TempleWall : z === 'swamp' ? T.MireTree : T.Tree);
      }
  }

  /** A pool of shallow mire, with the odd lily pad. */
  bog(cx: number, cy: number, rx: number, ry: number): void {
    this.blob(cx, cy, rx, ry, () => (this.rng.chance(0.18) ? T.Bog2 : T.Bog));
  }

  /** A rectangle of shallow mire. */
  bogRect(x0: number, y0: number, x1: number, y1: number): void {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, this.rng.chance(0.18) ? T.Bog2 : T.Bog);
  }

  /**
   * Makes a rectangle part of a water channel. 'flood' tiles are deep at high water and floor at low water;
   * 'float' tiles are rafts at high water and an empty shaft at low water.
   */
  channel(ch: string, kind: 'flood' | 'float', x0: number, y0: number, x1: number, y1: number): void {
    const c = (this.water[ch] ??= { flood: [], float: [], low: false });
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * this.w + x;
        for (const other of Object.values(this.water)) for (const list of [other.flood, other.float]) if (list.includes(i)) list.splice(list.indexOf(i), 1);
        c[kind].push(i);
        this.set(x, y, kind === 'flood' ? T.Flood : T.Raft);
      }
  }

  /** A channel that stands at low water when a turn begins. */
  startLow(ch: string): void {
    (this.water[ch] ??= { flood: [], float: [], low: false }).low = true;
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
            const z = this.zone(x, y);
            if ((z === 'forest' || z === 'swamp') && d < 0.8) this.set(x, y, this.rng.chance(0.25) ? T.Dirt2 : T.Dirt);
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
    this.spawns.push({ id: `m${this.spawns.length - this.extras}`, x, y, section: this.sec, options });
  }

  /**
   * A monster that is only there from a difficulty tier upward. It has its own id series, so adding one
   * never renumbers the monsters every tier shares.
   */
  extra(minTier: number, x: number, y: number, ...options: string[]): void {
    this.spawns.push({ id: `x${this.extras++}`, x, y, section: this.sec, options, minTier });
  }

  /** Places a campfire and records where heroes appear beside it. */
  campfire(index: number, x: number, y: number, merchant = false): void {
    this.obj('campfire', x, y, { index, merchant });
    this.checkpoints[index] = { x, y: y + 1 };
  }

  /** 1 for every tile that lies indoors. */
  indoorMask(): Uint8Array {
    const out = new Uint8Array(this.w * this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out[y * this.w + x] = INDOOR[this.zone(x, y)] ? 1 : 0;
    return out;
  }

  /** Derives wall faces and pit lips from the finished layout, and sets channels that start at low water. */
  finalize(): void {
    const { w, h, tiles } = this;
    for (const c of Object.values(this.water)) {
      c.flood = c.flood.filter((i) => tiles[i] === T.Flood);
      c.float = c.float.filter((i) => tiles[i] === T.Raft);
      if (!c.low) continue;
      for (const i of c.flood) tiles[i] = T.Drained;
      for (const i of c.float) tiles[i] = T.Pit;
    }
    for (let y = 0; y < h - 1; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const below = tiles[i + w];
        if (SOLID_TILES.has(below) || PIT_TILES.has(below)) continue;
        if (tiles[i] === T.CaveWall) tiles[i] = T.CaveWallFace;
        if (tiles[i] === T.TempleWall) tiles[i] = T.TempleWallFace;
      }
    for (let y = 1; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (tiles[i] === T.Pit && !PIT_TILES.has(tiles[i - w])) tiles[i] = T.PitEdge;
      }
  }
}
