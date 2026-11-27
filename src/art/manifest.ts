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
  // --- map 2: the swamp ---
  Mud, // plain swamp ground: dark wet earth with moss
  Mud2, // mud with puddles
  Mud3, // mud with reeds and toadstools
  MireTree, // drooping swamp tree canopy from above (solid, blocks sight)
  MireTree2, // dead, moss-hung tree (solid, blocks sight)
  Reeds, // a thick stand of reeds (solid, does not block sight)
  Bog, // shallow mire: walkable, but wading through it is slow
  Bog2, // shallow mire with lily pads
  Murk, // deep swamp water: nothing walks or dashes across it, but shots and flyers cross
  Sinking, // a raft of rotten planks on deep water: it sinks a moment after it is stepped on, then bobs back up
  // --- map 2: the sunken temple ---
  TempleFloor, // worn green-grey flagstones
  TempleFloor2, // flagstones with a cracked slab
  TempleFloor3, // flagstones with moss in the joints
  TempleWall, // top of a temple wall (solid, blocks sight)
  TempleWallFace, // carved front face of a temple wall, drawn where floor lies directly below (solid, blocks sight)
  TempleCracked, // temple wall face with obvious cracks, can be bombed (solid, blocks sight)
  TempleRubble, // flagstones strewn with rubble where a cracked wall was blown open
  Flood, // a flooded channel at high water: deep, like Murk
  Drained, // the same channel at low water: wet, weedy floor
  Raft, // a stone float riding at high water: walkable. At low water it lies at the bottom of its shaft (a Pit)
  Crumble, // a cracked slab over a drop: it falls away a moment after it is stepped on, then grinds back up
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
  // --- map 2 ---
  ValveHigh, // sluice wheel on a stone post, turned to "high water" (blue mark)
  ValveLow, // the same wheel turned to "low water" (amber mark)
  VentOff, // gas vent: a rusted grate in the floor, quiet
  VentOn, // the grate with green gas boiling out of it
  Clutch, // leech clutch: a rotten log packed with glistening eggs (monster generator, swamp)
  Coffin, // sunken coffin: a stone sarcophagus with its lid ajar (monster generator, temple)
  Statue, // weathered temple statue of a robed figure (solid)
  Totem, // lizardfolk totem: a skull on a feathered pole (solid)
  Hut, // small reed hut on stilts (solid)
  Boat, // a wrecked rowing boat (solid)
  Lily, // a flowering lily pad (non-blocking, drawn on bog)
  TSconce, // wall torch on a temple wall face background
  TSconceOdd, // the same, unlit and slightly tilted: a hidden switch
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
  // --- map 2 ---
  Glob, // a toad's or vent's glob of green poison
  Hex, // a shaman's hex bolt: a purple-green skull-ish spark
  WaterBolt, // the Drowned Priest's bolt of water
  Dart, // blowpipe dart with a green tip
  Gas0, // a puff of green gas
  Gas1, // the puff thinning out
  Ripple0, // rings on the water over something lurking
  Ripple1,
  Splash, // a burst of water
  Poison, // small green drip shown over poisoned creatures
  Zap, // a wisp's spark
  COUNT,
}

/** Item and HUD icons (sheet 'icons', 16x16). */
export enum IC {
  Fists = 0,
  Club,
  Sword, // short sword: the starter weapon
  Longsword, // larger blade, long grip
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
  Prowess, // blue double chevron: the budget for a starter kit
  Ember, // Emberbrand: a sword with a burning blade
  Berserk, // Berserker Charm: a red fang on a cord
  Dawn, // Dawnbreaker: a blade of light with a sunburst guard
  Kingsplitter, // the Chief's double-bitted throwing axe
  // --- map 2 ---
  Antivenom, // Antivenom Charm: a green vial on a cord
  Waders, // Wading Boots: tall oiled boots
  StoneSkin, // Stone Skin: a grey stone fist
  Blowpipe, // a reed pipe with a dart
  Tide, // Tidecaller: a spiral shell horn
  LeechRing, // Leech Ring: a dark ring set with a red stone
  WispLantern, // Wisp Lantern: a lantern with a blue-green wisp inside
  Crown, // the Drowned Crown: a corroded crown dripping water
  PoisonUI, // poison status mark for the HUD
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
  hero4: { w: 16, h: 16, frames: 6 }, // heroine: purple hair, pink dress
  // Monsters: 2 animation frames each.
  slime: { w: 16, h: 16, frames: 2 }, // green blob, squash and stretch
  wolf: { w: 16, h: 16, frames: 2 }, // grey wolf in profile
  bandit: { w: 16, h: 16, frames: 2 }, // hooded thug with a club
  archer: { w: 16, h: 16, frames: 2 }, // hooded bandit with a bow
  bat: { w: 16, h: 16, frames: 2 }, // wings up / wings down
  spider: { w: 16, h: 16, frames: 2 }, // cave spider seen from above
  // Variants met on the higher difficulty tiers: recoloured from the monster they grow out of
  brood: { w: 16, h: 16, frames: 2 }, // Brood Slime: purple slime
  dire: { w: 16, h: 16, frames: 2 }, // Dire Wolf: near-black wolf with a red eye
  marksman: { w: 16, h: 16, frames: 2 }, // Bandit Marksman: archer in a red hood
  brute: { w: 16, h: 16, frames: 2 }, // Bandit Brute: bandit in steel plate
  // Map 2: the swamp and the sunken temple
  toad: { w: 16, h: 16, frames: 2 }, // bog toad: squat / stretched mid-leap
  leech: { w: 16, h: 16, frames: 2 }, // a fat black leech, wriggling
  wisp: { w: 16, h: 16, frames: 2 }, // will-o'-wisp: a pale blue-green flame with a face
  lizard: { w: 16, h: 16, frames: 2 }, // lizardfolk spearman
  shaman: { w: 16, h: 16, frames: 2 }, // lizardfolk shaman: feathered mask and staff
  drowned: { w: 16, h: 16, frames: 2 }, // drowned dead: bloated, weed-hung corpse
  bloat: { w: 16, h: 16, frames: 2 }, // Bloat Toad: sickly yellow toad
  gravelight: { w: 16, h: 16, frames: 2 }, // Grave Light: a violet wisp
  stalker: { w: 16, h: 16, frames: 2 }, // Marsh Stalker: lizardfolk in dark scales with a red crest
  witch: { w: 16, h: 16, frames: 2 }, // Mire Witch: shaman in a bone-white mask
  // Mini-boss: frames [walk0, walk1, windup (axe raised), enraged walk0, enraged walk1, enraged windup]
  chief: { w: 32, h: 32, frames: 6 }, // the Bandit Chief: burly, horned helm, big axe
  // Mini-boss of map 2, same frame layout: [drift0, drift1, casting (arms raised), then the three again, enraged]
  priest: { w: 32, h: 32, frames: 6 }, // the Drowned Priest: robed, mitred, weed-hung, holding a censer
  // NPCs: frames [hermit, merchant, ferryman, penitent]
  npc: { w: 16, h: 16, frames: 4 },
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
