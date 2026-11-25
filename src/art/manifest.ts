// The contract between the art module and the rest of the game.
// Every sheet is a horizontal strip of equally sized frames, in enum order.

/** Terrain tiles (sheet 'tiles', 16x16). The numeric value is the frame index. */
export enum T {
  Void = 0, // solid black, outside the map
  Grass, // plain grass
  Grass2, // grass with tufts
  Grass3, // grass with small flowers
  Dirt, // trodden dirt path
  Dirt2, // dirt with pebbles
  Tree, // leafy tree canopy seen from above, fills the tile (solid, blocks sight)
  Tree2, // pine / darker tree variant (solid, blocks sight)
  Bush, // low bush (solid, does not block sight)
  Rock, // outdoor boulder (solid, does not block sight)
  Water, // pond water (solid, does not block sight)
  CaveFloor, // plain cave floor
  CaveFloor2, // cave floor with cracks
  CaveFloor3, // cave floor with pebbles
  CaveWall, // top of rock wall (solid, blocks sight)
  CaveWallFace, // front face of a rock wall, drawn where floor lies directly below (solid, blocks sight)
  Cracked, // wall face with obvious cracks, can be bombed (solid, blocks sight)
  Rubble, // floor with rubble where a cracked wall was blown open
  Pit, // bottomless chasm (not walkable, does not block sight)
  PitEdge, // chasm tile directly below floor, showing the lip of the ledge at its top
  Planks, // wooden plank floor (camp platforms, bridges)
  COUNT,
}

/** World objects (sheet 'objects', 16x16). */
export enum O {
  CampfireOff = 0, // unlit checkpoint campfire: logs in a stone ring
  CampfireOn0, // lit, flame frame 1
  CampfireOn1, // lit, flame frame 2
  ChestClosed,
  ChestOpen,
  Pot, // breakable clay pot
  PotBroken, // shards
  Sign, // wooden signpost
  DoorRed, // locked door with a red lock plate
  DoorBlue, // locked door with a blue lock plate
  Gate, // iron-barred gate (opened by puzzles)
  PlateUp, // stone pressure plate, raised
  PlateDown, // pressed
  Block, // pushable stone block / boulder with a carved face
  LeverOff, // floor lever leaning left
  LeverOn, // leaning right
  BrazierOff, // unlit standing brazier
  BrazierOn0, // lit, flame frame 1
  BrazierOn1, // lit, flame frame 2
  SpikesDown, // floor spike holes, retracted (safe)
  SpikesUp, // spikes extended (dangerous)
  ArrowTrap, // stone face with a dart hole, shooting DOWNWARD (rotated in code for other directions)
  Shrine, // glowing life shrine (small statue or ankh on a plinth)
  ShrineUsed, // same, dim
  Pedestal, // stone pedestal that displays an item on top (leave top area empty)
  Den, // wolf den: mound of earth with a dark hole (monster generator, outdoors)
  Nest, // spider nest: webbed egg sac cluster (monster generator, cave)
  Sconce, // wall-mounted torch on a cave wall face background
  SconceOdd, // same sconce but subtly different (unlit, slightly tilted): a hidden switch
  Tent, // small bandit tent
  Crate, // wooden crate
  Barrel,
  Mushroom, // small decorative cave mushrooms (non-blocking)
  Bones, // decorative bones (non-blocking)
  Stump, // tree stump
  COUNT,
}

/** Effects, projectiles and pickups (sheet 'fx', 16x16). Directional sprites point RIGHT. */
export enum F {
  Slash0 = 0, // melee swing arc, bright crescent opening to the right, frame 1
  Slash1, // fading frame 2
  Punch, // small impact star for fist hits
  Thrust, // spear thrust streak pointing right
  Arrow, // hero arrow
  EnemyArrow, // darker / red-fletched arrow
  Knife, // throwing knife
  Firebolt0,
  Firebolt1,
  Web, // spider web glob
  Rock, // thrown rock
  Axe, // spinning thrown axe (boss)
  Bomb0, // round bomb with fuse
  Bomb1, // same with bright fuse spark (blink frame)
  Explosion0,
  Explosion1,
  Explosion2,
  Spark, // small white hit spark
  Poof0, // death smoke puff
  Poof1,
  Shield, // curved shield arc held to the right of the hero
  Alert, // "!" mark shown above an alerted monster
  Heart, // heart pickup
  Coin0, // gold coin
  Coin1, // coin, turned (spin frame)
  KeyRed,
  KeyBlue,
  Sparkle, // twinkle used on secrets and pickups
  Frost, // ice shard / snowflake
  Slow, // small blue swirl shown over slowed creatures
  ArrowPile, // a tied bundle of arrows: ammunition pickup
  COUNT,
}

/** Item and HUD icons (sheet 'icons', 16x16). */
export enum IC {
  Fists = 0,
  Club,
  Sword,
  Spear,
  Bow,
  Knives,
  Firebolt, // flame spell
  Frost, // frost nova spell
  Bombs,
  Cleaver, // heavy bandit axe
  Shield,
  DashBoots,
  Armour, // leather armour
  Lantern,
  Magnet, // magnet charm
  Scroll, // reveal scroll
  VigorRing,
  // HUD / shop icons
  HeartUI,
  LifeUI, // party life token (ankh or winged heart)
  GoldUI,
  Renown, // star: meta currency
  KeyRedUI,
  KeyBlueUI,
  CharmHp, // one-run vigor charm
  CharmDmg, // one-run might charm
  Heal, // merchant healing (red flask)
  Lock, // locked / unavailable
  MusicOn, // beamed notes: music toggle, playing
  MusicOff, // the same notes greyed out and struck through
  COUNT,
}

/** Sheet layout. Monsters and the boss face RIGHT; code flips them. */
export const SHEETS = {
  tiles: { w: 16, h: 16, frames: T.COUNT },
  objects: { w: 16, h: 16, frames: O.COUNT },
  fx: { w: 16, h: 16, frames: F.COUNT },
  icons: { w: 16, h: 16, frames: IC.COUNT },
  // Heroes: frames [down0, down1, up0, up1, side0, side1]; side faces RIGHT. 0/1 are walk frames.
  hero0: { w: 16, h: 16, frames: 6 }, // blue tunic
  hero1: { w: 16, h: 16, frames: 6 }, // red tunic
  hero2: { w: 16, h: 16, frames: 6 }, // green tunic
  hero3: { w: 16, h: 16, frames: 6 }, // gold tunic
  // Monsters: 2 animation frames each.
  slime: { w: 16, h: 16, frames: 2 }, // green blob, squash and stretch
  wolf: { w: 16, h: 16, frames: 2 }, // grey wolf in profile
  bandit: { w: 16, h: 16, frames: 2 }, // hooded thug with a club
  archer: { w: 16, h: 16, frames: 2 }, // hooded bandit with a bow
  bat: { w: 16, h: 16, frames: 2 }, // wings up / wings down
  spider: { w: 16, h: 16, frames: 2 }, // cave spider seen from above
  // Mini-boss: frames [walk0, walk1, windup (axe raised), enraged walk0, enraged walk1, enraged windup]
  chief: { w: 32, h: 32, frames: 6 }, // the Bandit Chief: burly, horned helm, big axe
  // NPCs: frames [hermit, merchant]
  npc: { w: 16, h: 16, frames: 2 },
  // Damage-number digits 0-9, tiny bold white digits with a dark outline
  digits: { w: 5, h: 7, frames: 10 },
} as const;

export type SheetKey = keyof typeof SHEETS;

/** Raw RGBA pixels for one sheet (width = w * frames). No DOM types, so it also runs in Node. */
export interface SheetPixels {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export type ArtPixels = Record<SheetKey, SheetPixels>;
