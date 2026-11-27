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
  poisonT: number; // ms left poisoned: 1 damage a second, whatever the hero is wearing
  poisonTick: number;
  stoneT: number; // ms left as stone: nothing hurts or moves the hero
  safeX: number; // the last sound ground the hero stood on, to climb back to after a fall
  safeY: number;
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
  mode:
    | 'idle' | 'walk' | 'stun' | 'recover' | 'break'
    // the Bandit Chief
    | 'cleaveWind' | 'chargeWind' | 'charge' | 'throwWind' | 'whirlWind' | 'slamWind' | 'leapWind' | 'leap'
    // the Drowned Priest
    | 'boltWind' | 'geyserWind' | 'surgeWind' | 'poolWind' | 'waveWind' | 'sink' | 'rise';
  t: number;
  ang: number;
  chargeCd: number;
  throwCd: number;
  whirlCd: number;
  chain: number;
  // attacks added on the higher difficulty tiers
  slamCd: number;
  leapCd: number;
  sx: number; // leap: where it starts
  sy: number;
  tx: number; // and where it lands
  ty: number;
  // the Drowned Priest
  cd: Record<string, number>; // ms until each of his spells is ready again
  marks: { x: number; y: number; r: number }[]; // where his geysers are about to burst
  near: number; // ms the hero has been right on top of him
  wave: { side: number; gap: number }; // the wall of water he is calling: which side it comes from and where its gap is
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
  stunT: number; // ms left stunned by a melee hit: it cannot walk, attack or wind up, but knockback still shoves it
  chain: number; // lunges already made in the current run of lunges
  burnT: number; // ms left burning: it takes a little damage every tick
  burnTick: number; // ms until the next tick of burn damage
  poisonT: number; // ms left poisoned, the same way
  poisonTick: number;
  sx: number; // a leap: where it started
  sy: number;
  aid: Mon | null; // a shaman's spell in the making: the ally it is about to mend
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
  pierce: boolean; // passes through monsters, hitting each once
  trail?: number; // set on shots that shed sparkles: ms until the next one
  /** A thrown weapon that returns: `t` is the ms left flying out, `slot` the slot it was thrown from. */
  back?: { t: number; slot: number; turned: boolean };
  fire: boolean; // bursts and lights braziers
  web: boolean; // slows the hero
  poison: number; // ms of poison it leaves on what it hits
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
