import type Phaser from 'phaser';
import type { MonsterDef } from '../data/monsters';

type Img = Phaser.GameObjects.Image;

export interface Hero {
  x: number;
  y: number;
  kx: number; // knockback velocity
  ky: number;
  aim: number; // radians: where abilities go. Toward the cursor, or the facing with aim assist applied
  face: number; // radians: the way the hero faces. Follows the cursor, or the last movement when facing controls are on
  faceX: number; // movement keys the facing was last taken from
  faceY: number;
  faceT: number; // ms a diagonal has been held on only one of its keys
  aimHold: number; // ms the aim stays on an assisted target before it returns to the facing
  cd: number[]; // ms left per active slot
  cdMax: number[];
  iframes: number;
  slowT: number;
  blocking: boolean;
  dash: { x0: number; y0: number; x1: number; y1: number; t: number; dur: number } | null;
  moving: boolean;
  walkT: number;
  dead: boolean;
  spr: Img;
  shield: Img;
}

export interface BossState {
  phase: number;
  mode: 'idle' | 'walk' | 'cleaveWind' | 'chargeWind' | 'charge' | 'stun' | 'throwWind' | 'whirlWind' | 'recover' | 'break';
  t: number;
  ang: number;
  chargeCd: number;
  throwCd: number;
  whirlCd: number;
  chain: number;
}

export interface Mon {
  spawnId: string | null; // null for hatched and summoned monsters
  def: MonsterDef;
  x: number;
  y: number;
  kx: number;
  ky: number;
  hp: number;
  maxHp: number;
  r: number;
  state: 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'flee';
  t: number; // state timer, ms
  cd: number; // attack cooldown, ms
  hitCd: number; // contact damage cooldown, ms
  alerted: boolean;
  lostT: number;
  slowT: number;
  flashT: number;
  face: number; // 1 right, -1 left
  dirX: number;
  dirY: number;
  homeX: number;
  homeY: number;
  wanderT: number;
  wx: number;
  wy: number;
  anim: number;
  seed: number; // per-monster phase offset
  parent: Mon | null;
  children: number;
  dead: boolean;
  boss: BossState | null;
  spr: Img;
  mark: Img | null; // "!" shown briefly when it notices the hero
}

export interface Proj {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  fromHero: boolean;
  life: number; // ms
  pierce: boolean;
  fire: boolean; // bursts and lights braziers
  web: boolean; // slows the hero
  spin: number; // radians per second
  hit: Set<Mon>;
  spr: Img;
}

export interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'coin' | 'heart' | 'arrows';
  value: number;
  age: number;
  spr: Img;
}

export interface Bomb {
  x: number;
  y: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number; // ms since thrown
  spr: Img;
}

export const angDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
};
