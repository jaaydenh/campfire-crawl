# Game Design Document

Title: **Campfire Crawl** (project folder: `reflow`).
Status: design approved 2026-11-24. Built so far: the hub, all of map 1 (section 12) and all of map 2 (section 6, "Map 2"). Maps 3-8 and the two full bosses are not built.
Revised 2026-11-25: difficulty tiers per map, starter kits paid with Prowess, a fourth rarity, and
first-time secret prizes. Built from that revision: the starter kit rework (Prowess, offers by
role, pinned items, renown re-rolls), first-time secret prizes, and the three difficulty tiers on
map 1 with their unlocks and rewards, each higher tier's own secrets, the legendary rarity and
four tier-only items, four monster variants and two added boss attacks (2026-11-26).
Map 2, the Drowned Mire, was built on 2026-11-27 on all three tiers: see "Map 2" in section 6.

A top-down, pixel-art, classic-fantasy dungeon crawler for 1-4 players who take
turns at one keyboard and mouse. Real-time dexterity combat, hand-designed maps
split into checkpointed sections, and roguelite meta-progression between runs.

Items marked **(default)** were not explicitly decided in the design interview;
they are my proposals and the first things to change if they feel wrong.

---

## 1. Decisions at a glance

| Area | Decision |
|---|---|
| Players | 1-4, hot-seat: pass the keyboard and mouse between turns |
| Turn model | Each player has their own hero; the party advances through one shared map |
| Movement / aim | WASD in 8 directions. Each hero picks a control style: abilities fire toward the mouse cursor, or the way the hero faces with aim assist |
| Slots | 3 active slots + 1 passive slot; every hero starts a run with a short sword; empty active slots punch with fists |
| Resources | Cooldowns only; limited-use items have charges. No mana or stamina |
| Defence | No built-in dodge. Shields, dashes and blinks are equipment |
| Classes | None. Gear makes the build; players pick a name and colour |
| Run | One map per run (about 30-45 minutes). Beating a map unlocks the next |
| Difficulty | Three tiers per map, chosen with the map at the hub. Clearing a tier unlocks that map's next tier |
| Maps | Fixed layouts, puzzles and secrets; monsters, loot and some traps re-rolled per run |
| Death | Monsters in the unfinished section respawn; everything else persists |
| Rescue | A fallen hero's life waits where they fell; the next hero to reach the spot wins it back |
| Run failure | Shared pool of lives: 2 per player, more earned during the run |
| Bosses | On a death, the boss heals only to the start of its current phase |
| Healing | Heart drops, merchant healing for gold, full HP plus comeback health on respawn, at least half HP at every campfire |
| Loot | Finder keeps; trade between heroes at checkpoint camps |
| In-run growth | Gear and gold shops. No XP or levels |
| Inventory | 6-space backpack; re-equip only when no monster is alerted |
| Item gates | The main path never needs a specific item; gear opens secrets and shortcuts |
| Fog of war | Explored areas stay drawn but dim; monsters visible only in light radius and line of sight |
| Meta-progression | Permanent upgrades bought with renown, item-pool unlocks, map knowledge, and Prowess: a budget for each run's starter kit that grows with achievements |
| Profiles | Per-player hero profiles inside a save file; map unlocks belong to the save |
| Saving | 3 save files, autosave at every checkpoint and at the hub, export/import to a file |
| Endgame | Tier 3 of every map, and completing the item collection |
| Art / audio | Original 16x16 pixel art authored in code; synthesised chiptune and effects |
| Platform | Browser, TypeScript |
| First delivery | Hub + all of map 1, with every core system working |

---

## 2. Game loop

1. **Hub.** Pick a save file, choose which heroes (1-4) join, spend renown on
   permanent upgrades, choose an unlocked map and tier, and pick each hero's
   starter kit with their Prowess.
2. **Run.** The party plays that map section by section, one hero at a time.
3. **Camp** at each checkpoint: autosave, everyone rests up to at least half
   health, trade items, visit the merchant if one is there, then hand the
   controls to the next player.
4. **End.** The run ends when the map's boss dies (next map unlocks) or a death
   leaves the party with no lives (see Lives). In-run gear is lost; gold becomes
   meta currency; back to the hub.

## 3. Turn rules

- Turn order is fixed for the run (P1, P2, ...). Only the active hero is in the
  world; the others wait at the last checkpoint.
- **Reach the next checkpoint alive:** camp opens, then control passes to the next
  player, who starts from that checkpoint.
- **Die:** one life leaves the party pool and waits where the hero fell (see
  Rescue), the hero will respawn at full HP with comeback health on their next
  turn, and control passes to the next player, who starts from the previous
  checkpoint.
- **Solo:** the same player simply continues.
- A "Player N, get ready" screen sits between turns so nobody is ambushed mid-swap.
- On death, in the unfinished section: monsters respawn; solved puzzles, opened
  doors, looted chests and explored fog all stay.
- Earlier, completed sections stay cleared and can be walked back into to hunt
  secrets. **(default)**
- A dead hero keeps their gear and gold; the life is the whole penalty. **(default)**

### Rescue

- A hero who dies leaves their body where they fell, with a life token floating
  over it. That life is held at risk, not spent. The spot shows green on the
  minimap and the full map.
- The next hero to come within about a tile of the body wins the life back for
  the party. Solo, the same player runs back to their own body.
- A hero who dies while another is still waiting loses both lives, and leaves
  nobody to rescue. So the two deaths together cost two lives, the same as
  before rescues: a rescue can save a life but never costs an extra one.
- The body stays until a hero reaches it or another hero dies, even after the
  party moves on to later campfires.
- The party's last life can be rescued too: with no lives in the pool and a hero
  waiting, the next player gets one attempt. Dying on it loses the waiting life
  and ends the run.

### Comeback health and campfire rest

- **Comeback health:** on the turn after a death, the hero has extra health
  worth 25% of their max HP (rounded up) on top of a full bar. It soaks damage
  first, cannot be healed back, and ends when the turn does.
- **Campfire rest:** reaching a campfire raises every hero who is below half
  health to half their max HP (rounded up). Nobody is lowered.

### Lives

- Start: 2 per participating hero, pooled (solo 2, four players 8), plus any
  bought through meta upgrades.
- Earned in a run: +1 for each boss phase broken, +1 for each life shrine found
  (1-2 hidden per map). **(default amounts)**
- A life waiting for rescue is not in the pool. Every death takes one life from
  the pool if it has one, and also loses the waiting life if there is one.
- The run ends when a death leaves the party with no lives at all: none in the
  pool and none waiting for rescue.

### Bosses

- Every map's final section ends in a mini-boss. Maps 4 and 8 have a full boss:
  more phases and a larger arena.
- Bosses have 3 phases (full bosses 4-5). When the active hero dies, the boss
  resets to the start of the phase it was in, not to full.

## 4. Hero and controls

| Input | Action |
|---|---|
| W A S D | Move in 8 directions |
| Mouse | Aim |
| Left click / Right click / Space | Active slots 1, 2, 3 |
| Tab or I | Inventory (pauses the game) |
| M | Full map of explored areas **(default)** |
| E | Interact: levers, chests, NPCs **(default)** |
| Esc | Pause menu |

**Control styles.** Each hero has their own, set in the hero's settings at the hub
or from the pause menu, so players passing the keyboard never have to change it back.

- **Mouse aim (default):** the table above. Abilities go toward the cursor.
- **Facing aim:** abilities go the way the hero faces, which is the way they last
  moved. Slots 1, 2, 3 are on J, K and Space (the mouse buttons still work). A
  small tick in front of the hero shows the facing, and a raised shield keeps its
  facing while the hero moves.
  - **Aim assist:** a swing turns toward the best monster within its reach and
    about 80 degrees either side of the facing; a shot or a thrown bomb turns
    toward one within its range and about 37 degrees either side, as long as
    nothing solid is in the way, and leads a monster that is walking. Being in
    line with the facing counts for more than being close. The monster the next
    attack would turn to is marked with brackets.
  - With no monster to turn to, a swing turns toward a pot in reach, a shot turns
    toward a lever it could trip (a fire bolt also toward an unlit brazier) and
    otherwise goes straight ahead, and a bomb lands 3.5 tiles ahead.

- **Active slots (3):** weapons, spells, tools. An empty slot is a fist punch.
- **Passive slot (1):** always-on gear such as a lantern, armour or a charm.
- **Backpack:** 6 spaces. Slots can be changed only while no monster nearby is
  alerted. Items that do not fit stay on the ground or are traded at camp.
- **Stats:** max HP, damage bonus, move speed, light radius. Raised by meta
  upgrades and by passive gear.

## 5. Combat

- Real-time, with contact and projectile damage and a brief invulnerability
  window after being hit **(default)**.
- Every ability has its own cooldown: fast for melee swings, longer for big spells.
- Every melee hit stuns the monster it lands on: it cannot walk, attack or wind
  up, though the hit's knockback still shoves it back. A wind-up already begun
  waits rather than resets, and so does its attack cooldown. A wolf hit in the
  middle of a lunge is knocked out of it and goes straight to its recovery
  instead of finishing the lunge. The stun grows with the weapon's weight: fists
  0.2 s, short sword and longsword 0.3 s, spear 0.4 s, club 0.8 s, cleaver 1.0
  s. The club and cleaver stun for longer than their cooldowns, so repeated hits
  never let a monster act. The Bandit Chief and monster generators cannot be
  stunned.
- Limited-use items (bombs, scrolls, throwing knives) carry charges and are gone
  when spent.
- The bow uses arrows: a new bow holds 120 (199 at most) and stays equipped when
  empty. While a bow is equipped, each monster killed has a 15% chance to drop a
  pile of 10 arrows.
- Enemies are finite per section. Rarely, a **monster generator** keeps spawning
  until it is destroyed.
- **Traps:** spikes, arrow slits, flame jets, pits, collapsing floors. Some trap
  placements are re-rolled per run.

### Equipment

| Category | Examples |
|---|---|
| Offensive | Fists, short sword (every hero starts each run with one), club, longsword, spear, bow, throwing knives, fire bolt, frost nova, chain lightning, bombs |
| Defensive | Shield (block toward cursor), dash boots, blink, stone skin, armour (passive) |
| Utility | Lantern and torch (light radius, passive), keys, magnet charm (pulls gold), reveal scroll |

- Rarities: common, uncommon, rare, legendary. A
  rarer item is not the same item with bigger numbers: each step up adds a power
  and a better look.
- Built so far are 30 items: 22 from map 1 and 8 found in the Drowned Mire (listed under "Map 2"
  in section 6). Four are found only on map 1's higher tiers:

  | Item | Rarity | Power | Found |
  |---|---|---|---|
  | Emberbrand | Rare | A sword whose slashes set monsters burning for 3 seconds; it also lights braziers | Veteran secret |
  | Berserker Charm | Rare, passive | +50% damage while at half health or less; the hero glows red | The Chief's first defeat on Veteran |
  | Dawnbreaker | Legendary | A sword whose every slash sends a wave of light on through all monsters in its path | Legend secret |
  | Kingsplitter | Legendary | A thrown axe that cuts through everything out and back; catching it readies the next throw | The Chief's first defeat on Legend |

| Rarity | What it does | How it looks |
|---|---|---|
| Common | One plain action | A plain sprite |
| Uncommon | One twist on that action: pierce, burst, knockback, a pull | An accent colour and its own swing or shot effect |
| Rare | A second power: an effect on hit, a charged attack, or a bonus while a condition holds | An animated glint on the icon, a coloured trail, its own sound |
| Legendary | A named, one-of-a-kind item whose signature power changes how the hero plays | A unique silhouette, an animated icon, particles in the world, a fanfare when found |

- Rarer gear turns up in ordinary chests and shops at a low rate, more often on
  higher tiers, and reliably from boss phases. Secrets are not the main source:
  a secret pays its prize only the first time it is found (section 6).
- What can drop is limited to the save file's **unlocked item pool**, which grows
  as bosses are beaten, secrets are first found and higher tiers are cleared.
  The target is more than 50 item types across the eight maps.

## 6. World

Eight maps, each starting outdoors and ending inside its dungeon.

| # | Outdoors → Indoors | Sections | End of map |
|---|---|---|---|
| 1 | Forest → Bandit cave | 6 | Mini-boss |
| 2 | Swamp → Sunken temple | 7 | Mini-boss |
| 3 | Graveyard → Crypt | 7 | Mini-boss |
| 4 | Mountain pass → Fortress | 8 | **Boss** |
| 5 | Desert → Tomb | 8 | Mini-boss |
| 6 | Snowfield → Ice cavern | 9 | Mini-boss |
| 7 | Volcano → Forge | 9 | Mini-boss |
| 8 | Cursed city → Dark lord's castle | 10 | **Final boss** |

64 sections in total; section counts are **(default)** within your 6-10 range.
Each section targets 3-5 minutes; boss sections run longer.

### Difficulty tiers

Every map has three tiers, chosen with the map at the hub: Tier 1 Adventurer,
Tier 2 Veteran, Tier 3 Legend **(default names)**.

- Clearing a map on one tier unlocks that map's next tier. Tier 1 of the next
  map still unlocks as before.
- The layout and puzzles are the same on every tier. Secrets are not: each tier
  hides its own secrets in different places (see Secrets below). Higher tiers have
  tougher monsters in larger packs, new monster variants, more traps, fewer
  heart drops, and a boss with an added attack in each phase **(default)**.
- **Tier 1 has no monster generators.** Where a den or nest would stand, one of
  the monsters it hatches stands instead. Generators appear from tier 2.
- Tier 1 of map 1 is tuned so that a brand-new party can just barely clear it
  on its first run. Tier 2 of map N is tuned about level with tier 1 of map
  N+2, and tier 3 with map N+4 **(default)**, so a party moves back and forth
  between new maps and higher tiers of old ones.
- For each tier the map screen shows what is still to be won there:
  undiscovered items as silhouettes, unclaimed secret prizes, and Prowess not
  yet earned.
- What higher tiers pay is in section 8.

The numbers as built **(default, to be tuned by playing)**. They are multipliers
on the monster table, kept in one place (`src/data/tiers.ts`):

| | Tier 1 Adventurer | Tier 2 Veteran | Tier 3 Legend |
|---|---|---|---|
| Monster and boss health | x0.8 | x1.2 | x1.5 |
| Monster and boss damage | x0.75 | x1.25 | x1.6 |
| Heart drops from monsters | x1.5 | x1 | x0.75 |
| Monster generators | none | yes | yes, hatching faster and up to 4 at once |
| Extra monsters on map 1 | none | +10 | +20, one of them a third generator |
| Optional traps | as authored | 20 points more likely | always there, and all traps hit 1 harder |
| Monster variants | none | Brood Slime, Dire Wolf (about 5 a run) | those, Bandit Marksman and Bandit Brute (about 16 a run) |
| Boss's helpers | 2 bandits at the first break | and an archer | and a brute and a marksman at the second break |
| Boss's added attacks | none | Slam | Slam and Leap |
| Clear bonus, renown per hero | 30 | 60 | 100 |
| Chests and shops | as before | lean rarer | lean rarer still |

The game as it was before tiers sat between tier 1 and tier 2: every multiplier
at 1, with generators and no extra monsters.

Built on map 1: all of the above, tier unlocks, and the camp's "to win" line
(Prowess not yet earned, unclaimed secret prizes, undiscovered items as
silhouettes, the next tier, the second pin and the extra offer).

Variants take the place of some of a tier's ordinary monsters, picked per run.
Each is the monster it grows out of in its own colours, tougher, with one trick:

| Variant | Replaces | Trick | Tiers |
|---|---|---|---|
| Brood Slime (purple, larger) | Slime | Bursts into two slimes when it dies | 2: 30% of slimes, 3: 45% |
| Dire Wolf (black, red eye) | Wolf | Lunges twice in a row before it rests | 2: 30% of wolves, 3: 45% |
| Bandit Marksman (red hood) | Archer | Looses three arrows in a fan | 3: 40% of archers |
| Bandit Brute (steel plate, larger) | Bandit | A slower, wider, longer swing; barely knocked back or stunned | 3: 30% of bandits |

The Chief's added attacks, each shown as a red circle before it lands:

- **Slam** (tiers 2 and 3): with the hero close, he winds up and a shockwave
  bursts around him. Step out of the circle.
- **Leap** (tier 3): with the hero at a distance, he jumps to where the hero
  stands and lands with a smaller shockwave. The circle follows the hero until
  just before he jumps.

Map 1's secrets by tier. A tier's secrets are sealed rock on the other tiers:

| Tier | Secret | How it opens | Prize |
|---|---|---|---|
| 1 | The hidden grove | Bomb the cracked rock | Longsword |
| 1 | Behind the crooked torch | Turn the odd torch | Dash Boots |
| 1 | Across the gap | Dash over the pit | Frost Nova, and a life shrine |
| 2 | The slab in the rock | Park the grove's stone on the plate in the trail | Emberbrand |
| 2 | Past the far lever | Hit a lever across a pit with something thrown or shot | A rare or better item |
| 3 | Beyond the cold brazier | Light a brazier across a pit with a fire bolt or a bomb | Dawnbreaker |
| 3 | Behind the wolf den | Bomb the cracked rock at the back of the den's clearing | A rare or better item, and a life shrine |

A "rare or better item" prize is picked from the unlocked pool for the run. Like
every prize it is given once per save.

### Map 2: the Drowned Mire

Swamp into the sunken temple: seven sections, six campfires (the third, at the temple gate, is the
halfway one), a 3-phase mini-boss. Built on all three tiers. Everything marked **(default)** here
was my call and is the first thing to change if it plays wrong.

**How hard.** A map's monsters can be tougher than the monster table says: the map carries its own
multipliers, applied on top of the tier's. Map 2's are x1.22 health and x1.29 damage **(default)**,
which puts its tier 1 about halfway between map 1's tiers 1 and 2, as section "Difficulty tiers"
asks. Map 1's are x1.

**What is new underfoot.**

| Thing | Rule |
|---|---|
| Mire (shallow green water) | Walkable, at 55% speed. Monsters that cannot swim wade at 60% |
| Deep water (black in the swamp, blue in the temple) | Nothing walks or dashes across it. Shots, bombs and flyers cross |
| Rotten planks, cracked slabs | Hold for 0.6 s after the hero steps on them, then fall away for 4.5 s and come back. A hero caught on one takes trap damage and is put back on the last sound footing. Cross without stopping |
| Sluice wheels | Each turn of a wheel takes its water channel from high to low or back. At high water a channel is deep and its stone rafts can be walked on; at low water the channel is wet floor and the rafts lie at the bottom of their shafts. The water starts every turn where the map sets it, so a party can never be stranded |
| Gas vents | Breathe out a cloud for about a third of their cycle. Standing in it poisons |
| Poison | 1 damage a second for a few seconds, through armour and the moment of safety after a hit. More poison makes it last longer, not hurt more. A heart clears it; so does the end of the turn. The HP bar turns purple |
| Anything on foot standing where a floor falls or the water rises | Is lost. What swims stays in the water |

**Sections.**

| # | Section | What it asks |
|---|---|---|
| 1 | The Sodden Road | Mire, toads and leeches for the first time |
| 2 | Leechwater | A lake crossed on boardwalks and rotten planks. The lever for the reed gate is on an islet reached by wading through leech water |
| 3 | The Lizard Village | Gas vents on the way in. The blue key is in the witch-doctor's hut; the temple door needs it |
| 4 | The Sunken Gate | The first wheel: drain the court to cross it. Drowned dead lie under the puddles. A lever at the far end opens a shortcut back to the temple gate for good |
| 5 | The Sluice Halls | Two waters, two wheels each, and an order to find: the rafts to the first wheel ride the water that bars the way out. Then a gallery of cracked slabs over a drop |
| 6 | The Ossuary | A corridor of vents, then four fires to light in the order the Penitent gives as a riddle (east, then against the sun) |
| 7 | The Drowned Sanctum | A guard room, then the Priest |

**Monsters.** Slimes and bats return as filler. Base numbers, before the map and the tier:

| Monster | HP / hit | What it does |
|---|---|---|
| Bog Toad | 11 / 4 | Sits, then leaps onto where the hero stands; a red circle shows where. Its hit poisons |
| Mire Leech | 4 / 2 | Fast in the mire, at 40% speed out of it. Comes in swarms. Its bite poisons |
| Will-o'-wisp | 6 / 4 | Flies. Drifts close, flares (a red circle), bursts, and blinks away |
| Lizardfolk Spearman | 15 / 5 | A long, narrow thrust: sidestep it. Not slowed by mire |
| Lizardfolk Shaman | 9 / 3 | Throws hexes that poison, and heals a wounded ally near it instead when there is one |
| Drowned Dead | 19 / 5 | Lies under the water until the hero is within about three tiles; only ripples show. Slow and tough; its hit slows |
| Leech Clutch, Sunken Coffin | 30, 34 | Generators (tier 2 and up) for leeches and the drowned |

Variants on the higher tiers, in the same table as map 1's (`src/data/tiers.ts`):

| Variant | Replaces | Trick | Tiers |
|---|---|---|---|
| Bloat Toad (yellow, larger) | Bog Toad | Leaves a poison cloud where it dies | 2: 30% of toads, 3: 45% |
| Grave Light (violet) | Will-o'-wisp | Its burst throws six sparks | 2: 30% of wisps, 3: 45% |
| Marsh Stalker (dark scales) | Spearman | Thrusts twice, turning between them | 3: 35% of spearmen |
| Mire Witch (white robe) | Shaman | Three hexes in a fan, and heals more | 3: 40% of shamans |

The shared roster is 64 monsters. Tier 2 adds 14 and tier 3 adds 30 (map 1 adds 10 and 20 to its 61).

**The Drowned Priest.** Where the Chief runs the hero down, the Priest keeps a spell's length away
and fights with the water. 48, 56 and 66 HP in his three phases, before the map and the tier. The
sanctum is lit for the fight: the hero sees all of it.

- **Bolts:** a fan of three (five in the last phase).
- **Geysers:** red circles, one under the hero and the rest around them, that burst after a moment.
- **The flood:** when his guard first breaks the outer ring of the sanctum goes under; at the second
  break everything does but the middle and the stone round each pillar. Flooded floor is mire.
- **Surge** (once there is a flood): every flooded tile flashes, then strikes whoever stands in it.
  Dry stone is safe. Afterwards he is spent for 1.5 s and takes half as much again.
- **Sinks:** crowded for about a second, he sinks into the floor and rises at whichever of his seven
  places is furthest away, with a splash that hurts anyone on it. He cannot be hurt while under.
- **Helpers:** two drowned at the first break; on tier 2 a shaman as well; on tier 3 a Marsh Stalker
  and a Mire Witch at the second.
- **Whirlpool** (tiers 2 and 3): opens under the hero and drags them toward its eye, which hurts.
- **Wave** (tier 3): a wall of bolts crosses the sanctum from one side with one gap three tiles
  wide, shown in green. The pillars stop it too.

**Secrets and items.** As on map 1, a tier's secrets are sealed on the other tiers.

| Tier | Secret | How it opens | Prize |
|---|---|---|---|
| 1 | The hollow in the rock | Bomb the cracked rock north of the first clearing | Wading Boots |
| 1 | Where the rafts ride | Drain the court to get through a side door, then raise the water again from inside | Antivenom Charm |
| 1 | Across the broken floor | Dash over the gap north of the gallery | Stone Skin, and a life shrine |
| 2 | Behind the tilted flame | Turn the odd torch in the wisp gallery | Tidecaller |
| 2 | The far shore | Hit a lever out on the lake with something thrown or shot | A rare or better item |
| 3 | The cold altar | Light a brazier out in the gallery's drop with a fire bolt or a bomb | Wisp Lantern |
| 3 | The witch-doctor's cache | Park the village's stone on its plate | A rare or better item, and a life shrine |

| Item | Rarity | Power | Found |
|---|---|---|---|
| Wading Boots | Uncommon, passive | Mire does not slow; floors that give way hold longer | Adventurer secret |
| Antivenom Charm | Uncommon, passive | Immune to poison | Adventurer secret |
| Stone Skin | Uncommon | 2.6 s of taking no damage and no shove, at half speed | Adventurer secret |
| Blowpipe | Uncommon | Quick darts that poison monsters | The Priest's first defeat on Adventurer |
| Fire Bolt | Uncommon | Was in the game but could not be found anywhere | The Priest's first defeat on Adventurer |
| Tidecaller | Rare | A wave that hurls back everything in front of the hero and leaves it slowed | Veteran secret |
| Leech Ring | Rare, passive | Every kill heals 1 HP | The Priest's first defeat on Veteran |
| Wisp Lantern | Legendary, passive | A caught wisp lights like a lantern and strikes the nearest monster every 1.5 s | Legend secret |
| The Drowned Crown | Legendary | Opens a whirlpool at the cursor that drags monsters in, holds them and grinds them down | The Priest's first defeat on Legend |

The Wisp Lantern costs 9 Prowess, more than one map's feats can reach: it needs feats from both maps.

**Also built with it:** the camp's map list now picks the map (the furthest open one is suggested),
two music tracks (swamp, temple), five sound effects, and two NPCs (the Old Ferryman, the Penitent).

### Inside a section

- **Scrolling:** the area is larger than the screen and the camera follows the hero.
- **Fog of war:** unexplored is black; explored stays drawn but dimmed; monsters
  show only inside the light radius with a clear line of sight. Light gear widens
  the radius.
- **Puzzles on the main path:** switches and pressure plates (pushed blocks,
  timed doors, ranged switches), coloured keys and locked doors, pattern and
  riddle rooms (torch order, floor patterns, NPC riddles). Solved puzzles stay
  solved for the rest of the run.
- **Secrets, off the main path:** cracked walls for bombs, gaps for a dash, dark
  rooms for a light, hidden switches. The first time a secret is found on a save
  it pays a prize: a guaranteed rare or better item or an item-pool discovery,
  shown on a pedestal. Found again in later runs, the pedestal is empty and
  whatever else is in the room (a chest, pots) is ordinary loot. Finding a
  secret pays a little renown on every run. Each
  tier has its own secrets: about as many as tier 1, hidden in different places
  and opened in different ways, so knowing where tier 1's secrets are does not
  give away tier 2's. Each pays its own first-time prize, and found secrets are
  recorded per tier. Life shrines work on every run. Nothing required is ever locked behind a
  specific item.
- **NPCs:** rare, a few lines of dialogue each: hints, riddles, a merchant.

## 7. Economy

- **Gold** drops from monsters, pots and chests and belongs to the hero who
  picks it up.
- **Merchants** stand at some checkpoints and sell gear, limited-use items,
  one-run stat charms and healing.
- **Hearts** drop occasionally from monsters and breakables.
- At the end of a run each hero's remaining gold converts to that hero's meta
  currency, renown, with bonuses for secrets found and boss phases broken, and a
  clear bonus that grows with the tier. **(default)**
- Renown buys permanent upgrades and starter kit re-rolls. It does not buy kit
  items: those are paid with Prowess (section 8).

## 8. Meta-progression

| What | Owned by | How |
|---|---|---|
| Upgrade tree: 23 permanent upgrades in four paths (see below) | Each hero | Bought at the hub with renown |
| Prowess | Each hero | Earned by first-time achievements, never bought. Full again before every run |
| Starter kit | Each hero, per run | Chosen from six offered items plus the hero's pinned item and paid with Prowess (see below); not kept |
| Item pool | Save file | Grows from boss kills, first-time secret prizes and tier discoveries |
| Map knowledge: found secrets (per tier), open shortcuts, bestiary | Save file | Recorded on discovery; shortcuts stay open in later runs on every tier |
| Map and tier unlocks | Save file | Beat a map to unlock the next map and that map's next tier |

### Prowess and the starter kit

Prowess measures what a hero has achieved. It is a budget, not a purse: it is
full before every run, it pays for that run's starter kit, and whatever is not
used is simply left over. Renown is for the upgrade tree, so a kit never
competes with a permanent upgrade.

- **Starting Prowess:** 3 **(default)**, enough for one uncommon item or two
  cheap commons.
- **Earning more:** +1 each, once per hero, for the heroes in the party when it
  happens. That is 43 at most. Achievements are the only source.
  - Reaching the halfway campfire of a map for the first time (8 in all).
  - Clearing a map on a tier for the first time (24).
  - Finishing a map without that hero dying (8).
- **Item prices** go by rarity **(default)**: common 1-2, uncommon 3-4, rare
  5-7, legendary 8-10. A hero who discovers a strong item early can still find
  it in chests and shops, but cannot start a run with it until their Prowess
  reaches its price.

**The offer.** Before each run every hero is offered six items from the unlocked
pool, drawn by role so that every slot can be filled:

| Offers | Role |
|---|---|
| 2 | Reusable weapons |
| 2 | Other active items: defence, tools, limited-use |
| 2 | Passives |

- The hero takes up to three active items and one passive, within their Prowess.
- **Pinned item:** each hero pins one item from the pool as their signature. It
  is always available on top of the six offers, at its normal price. The pin can
  be changed at the hub between runs.
- **New discoveries:** an item discovered in the last run is guaranteed a place
  in every hero's next offer and is marked as new.
- **Re-rolls:** any hero may redraw their six offers for renown: 10, then 20,
  then 40, doubling each time and starting again at 10 after the run
  **(default prices)**. The pinned item is not redrawn.
- The offer depends only on the save, the run number, the hero and the number
  of re-rolls, so reloading cannot change it.
- The short sword every hero starts with is free and separate: it takes the
  first active slot the kit leaves empty, or the pack.

### Tier rewards

The reward for a harder tier is a larger pool of better items to start runs
with, and the Prowess to afford them.

| Reward | Detail |
|---|---|
| Item discoveries | Tiers 2 and 3 of each map each hold 1-2 items found nowhere else, mostly rare and legendary **(default)**. They come from the boss's first defeat on that tier and from that tier's first-time secret prizes. Once discovered, an item joins the save's pool for kits, chests and shops on every map and tier |
| Prowess | +1 for each first clear, as above |
| Kit power | The first tier 2 clear of any map gives every hero on the save a second pinned item; the first tier 3 clear adds one more offer **(default)** |
| In-run loot | Chests and shops lean toward rarer items on higher tiers, and the clear bonus is larger |

Built: all of it. On map 1 each higher tier holds two items found nowhere
else, one on a secret's pedestal and one from the Chief's first defeat there.
Legendary items cost 8 Prowess, the most a hero can reach with one map built.

### Upgrade tree

Each hero has their own tree. An upgrade opens once the upgrade it grows from
reaches the level shown; five are open from the start. Nothing is exclusive and
nothing is refunded. An upgrade a hero already owns stays open whatever the tree
says.

| Path | Upgrade | Levels | Each level | Opens at |
|---|---|---|---|---|
| Body | Vitality | 5 | +4 max HP | start |
| | Hearty | 3 | Hearts heal +1 HP | Vitality 1 |
| | Thick Skin | 3 | +0.15s invulnerability after a hit | Vitality 2 |
| | Trap Sense | 2 | -1 damage from spikes and arrow traps (never below 1) | Thick Skin 1 |
| | Second Wind | 2 | +1 party life each run | Vitality 3 |
| Arms | Might | 5 | +15% damage | start |
| | Heavy Blows | 2 | +25% melee knockback | Might 1 |
| | Giant Slayer | 3 | +10% damage to bosses and monster generators | Heavy Blows 2 |
| | Quick Hands | 3 | -6% cooldowns | Might 2 |
| | Packrat | 3 | +20% uses on knives, bombs and scrolls | Might 1 |
| | Deep Quiver | 3 | +12 arrows on a new bow, +3% arrow pile chance | Packrat 1 |
| Scout | Swiftness | 3 | +5% move speed | start |
| | Long Reach | 2 | Pickups fly to the hero from further away | Swiftness 1 |
| | Opening Strike | 2 | +25% damage to monsters that have not noticed the hero | Swiftness 2 |
| | Keen Eyes | 3 | +1 light radius | start |
| | Treasure Nose | 1 | A chime within 7 tiles of an undiscovered secret | Keen Eyes 2 |
| | Cartographer | 1 | The party starts with everything explored on this map in earlier runs | Keen Eyes 3 |
| Trade | Fortune | 3 | +15% gold found | start |
| | Pocket Change | 3 | Start each run with +15 gold (never converts to renown) | Fortune 1 |
| | Haggler | 3 | -8% merchant prices | Fortune 2 |
| | Quartermaster | 3 | -15% starter kit re-roll cost **(default)** | Fortune 1 |
| | Wider Offer | 1 | A seventh starter kit offer, of any role | Quartermaster 2 |
| | Second Look | 1 | The first starter kit re-roll before each run is free | Wider Offer 1 |

Deliberately left out of the tree: more healing at campfires than the rest every
party gets, bonus renown, a death-saving upgrade, a bigger backpack, and
Prowess, which is earned and never bought.

Difficulty target: a brand-new party, each hero with a short sword and a
3-Prowess starter kit, should just barely clear tier 1 of map 1 on its first
run. (Before tiers the target was to run out of lives around the middle and
clear on the second or third run; that level now sits between tiers 1 and 2.)
Tier 1 of map N is tuned for heroes carrying roughly N-1 maps' worth of
upgrades, so map 2 is close to impossible on a first run.

## 9. Saving

- Three save files in browser storage. Each holds up to 4 named heroes, the
  item pool, map knowledge, unlocks, and any run in progress.
- Autosave at every checkpoint and at the hub. Closing the browser mid-section
  resumes from the last checkpoint with the same player's turn.
- Export a save to a file and import it again, for backup or another computer.

## 10. Presentation

- **Art:** original pixel art authored in code. 16x16 tiles and sprites, a
  limited retro palette per map theme, 4 facing directions for heroes and
  monsters **(default)**.
- **View:** low internal resolution (about 384x216) scaled up by whole numbers
  for crisp pixels **(default)**.
- **HUD:** HP (comeback health as a gold strip), the 3 active slots with cooldown
  sweeps, the passive slot, gold, party lives and any life waiting for rescue,
  whose turn it is, a small minimap.
- **Audio:** sound effects and looping chiptune tracks synthesised in the browser.

## 11. Technology

- TypeScript, built with Vite, on the Phaser 2D engine **(default)**.
- Maps authored as data files so that maps 2-8 are content, not new code.
- No server; everything runs and saves locally in the browser.

## 12. First delivery: hub + map 1

- All core systems: turns and hand-off, lives, rescue, camp and trading, merchant,
  inventory with the swap-when-safe rule, fog of war, saving with 3 files and
  export/import, hub with hero profiles, upgrades and starter kits.
- Map 1 complete: 6 sections from forest into bandit cave, 6 monster types,
  one monster generator, traps, 2 main-path puzzles, 2-3 secrets, one NPC, one
  merchant, a 3-phase mini-boss.
- About 12-15 items across the three categories.
- Three music tracks (hub, map, boss) and core sound effects.

Maps 3-8 and the two full bosses follow. Map 2 and the tier system are built (section 6).
Of the 2026-11-25 revision, the starter kit rework (Prowess, offers by role,
one pinned item, re-rolls) is built on map 1. Prowess for the halfway campfire
is awarded when the run ends, not at the campfire itself. First-time secret
prizes are built too: the item on a secret's pedestal is won once per save,
and the pedestal stands empty on later runs. The three difficulty tiers are
built on map 1 too, with the second pinned item, the tier 3 extra offer, each
higher tier's own secrets, and four tier-only items.

## 13. Still open

- Story and tone beyond "classic fantasy": how much text, who the dark lord is.
- Exact numbers: HP, damage, prices, upgrade costs. These will be tuned by
  playing the vertical slice.
- Prowess: the name, the starting amount, what earns it and each item's price.
  New heroes now start every run with a kit, so map 1 may need retuning to keep
  the difficulty target.
- Tiers: the names, the numbers in the table in section 6 (tier 1 has not yet
  been checked against a real first run), and which items each tier of each
  map holds.
- Secret placement per tier: every map needs three sets of secrets. Map 1 has
  all three (3, 2 and 2 secrets); a map is built once per tier, so anything can
  differ between tiers.
- The four tier-only items: their numbers, and whether the hints for the
  higher tiers' secrets are enough (there are no signs or NPC lines for them).
- Variants and the Chief's added attacks: their numbers, and whether the Chief
  should gain a different attack in each phase instead of the same ones throughout.
- Map 2 has been checked by the map validator, the rule checks and a scripted play-through of each
  mechanic and each boss tier, but not played start to finish by a person. Its numbers are all
  first guesses: the map's multipliers, every monster and item, vent and plank timings, the Priest.
- Map 2's water: whether resetting the levels every turn is right, or whether they should stay as
  the last hero left them.
- Old saves: Quartermaster levels already bought change meaning, from a kit
  discount to a re-roll discount. Nothing is refunded as built; decide whether
  it should be.
