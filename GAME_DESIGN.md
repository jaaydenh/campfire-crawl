# Game Design Document

Title: **Campfire Crawl** (project folder: `reflow`).
Status: design approved 2026-11-24. Built so far: the hub and all of map 1 (section 12). Maps 2-8, the two full bosses and the tier system are not built.

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
| Movement / aim | WASD in 8 directions, abilities fire toward the mouse cursor |
| Slots | 3 active slots + 1 passive slot; empty active slots punch with fists |
| Resources | Cooldowns only; limited-use items have charges. No mana or stamina |
| Defence | No built-in dodge. Shields, dashes and blinks are equipment |
| Classes | None. Gear makes the build; players pick a name and colour |
| Run | One map per run (about 30-45 minutes). Beating a map unlocks the next |
| Maps | Fixed layouts, puzzles and secrets; monsters, loot and some traps re-rolled per run |
| Death | Monsters in the unfinished section respawn; everything else persists |
| Run failure | Shared pool of lives: 2 per player, more earned during the run |
| Bosses | On a death, the boss heals only to the start of its current phase |
| Healing | Heart drops, merchant healing for gold, full HP on respawn. No checkpoint heal |
| Loot | Finder keeps; trade between heroes at checkpoint camps |
| In-run growth | Gear and gold shops. No XP or levels |
| Inventory | 6-space backpack; re-equip only when no monster is alerted |
| Item gates | The main path never needs a specific item; gear opens secrets and shortcuts |
| Fog of war | Explored areas stay drawn but dim; monsters visible only in light radius and line of sight |
| Meta-progression | Permanent stat upgrades, item-pool unlocks, map knowledge, per-run starter kits |
| Profiles | Per-player hero profiles inside a save file; map unlocks belong to the save |
| Saving | 3 save files, autosave at every checkpoint and at the hub, export/import to a file |
| Endgame | Harder tiers of every map after the final boss |
| Art / audio | Original 16x16 pixel art authored in code; synthesised chiptune and effects |
| Platform | Browser, TypeScript |
| First delivery | Hub + all of map 1, with every core system working |

---

## 2. Game loop

1. **Hub.** Pick a save file, choose which heroes (1-4) join, spend meta currency
   on permanent upgrades, buy a starter kit, choose an unlocked map and tier.
2. **Run.** The party plays that map section by section, one hero at a time.
3. **Camp** at each checkpoint: autosave, trade items, visit the merchant if one
   is there, then hand the controls to the next player.
4. **End.** The run ends when the map's boss dies (next map unlocks) or the lives
   pool hits zero. In-run gear is lost; gold becomes meta currency; back to the hub.

## 3. Turn rules

- Turn order is fixed for the run (P1, P2, ...). Only the active hero is in the
  world; the others wait at the last checkpoint.
- **Reach the next checkpoint alive:** camp opens, then control passes to the next
  player, who starts from that checkpoint.
- **Die:** one life leaves the party pool, the hero will respawn at full HP on their
  next turn, and control passes to the next player, who starts from the previous
  checkpoint.
- **Solo:** the same player simply continues.
- A "Player N, get ready" screen sits between turns so nobody is ambushed mid-swap.
- On death, in the unfinished section: monsters respawn; solved puzzles, opened
  doors, looted chests and explored fog all stay.
- Earlier, completed sections stay cleared and can be walked back into to hunt
  secrets. **(default)**
- A dead hero keeps their gear and gold; the life is the whole penalty. **(default)**

### Lives

- Start: 2 per participating hero, pooled (solo 2, four players 8), plus any
  bought through meta upgrades.
- Earned in a run: +1 for each boss phase broken, +1 for each life shrine found
  (1-2 hidden per map). **(default amounts)**
- Zero lives ends the run.

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
- Limited-use items (bombs, scrolls, throwing knives) carry charges and are gone
  when spent.
- The bow uses arrows: a new bow holds 60 (99 at most) and stays equipped when
  empty. While a bow is equipped, each monster killed has a 15% chance to drop a
  pile of 10 arrows.
- Enemies are finite per section. Rarely, a **monster generator** keeps spawning
  until it is destroyed.
- **Traps:** spikes, arrow slits, flame jets, pits, collapsing floors. Some trap
  placements are re-rolled per run.

### Equipment

| Category | Examples |
|---|---|
| Offensive | Fists, club, sword, spear, bow, throwing knives, fire bolt, frost nova, chain lightning, bombs |
| Defensive | Shield (block toward cursor), dash boots, blink, stone skin, armour (passive) |
| Utility | Lantern and torch (light radius, passive), keys, magnet charm (pulls gold), reveal scroll |

- Rarities: common, uncommon, rare. Rare gear comes mainly from secrets, boss
  phases and higher map tiers.
- What can drop is limited to the save file's **unlocked item pool**, which grows
  as bosses are beaten and secrets are found.

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
  rooms for a light, hidden switches. They hold the better loot, life shrines and
  item-pool unlocks. Nothing required is ever locked behind a specific item.
- **NPCs:** rare, a few lines of dialogue each: hints, riddles, a merchant.

## 7. Economy

- **Gold** drops from monsters, pots and chests and belongs to the hero who
  picks it up.
- **Merchants** stand at some checkpoints and sell gear, limited-use items,
  one-run stat charms and healing.
- **Hearts** drop occasionally from monsters and breakables.
- At the end of a run each hero's remaining gold converts to that hero's meta
  currency, with bonuses for secrets found and boss phases broken. **(default)**

## 8. Meta-progression

| What | Owned by | How |
|---|---|---|
| Stat upgrades: max HP, damage, speed, light radius, extra party lives | Each hero | Bought at the hub with meta currency |
| Starter kit | Each hero, per run | Before each run every hero is offered 4 random items from the unlocked pool (one is always a reusable weapon) and may buy any of them; not kept |
| Item pool | Save file | Grows from boss kills and secrets |
| Map knowledge: found secrets, open shortcuts, bestiary | Save file | Recorded on discovery; shortcuts stay open in later runs |
| Map and tier unlocks | Save file | Beat a map to unlock the next; beat map 8 to unlock tiers |

Difficulty target: a brand-new party on fists should usually run out of lives
around the middle of map 1, and clear it on the second or third run. Map N is
tuned for heroes carrying roughly N-1 maps' worth of upgrades, so map 2 is
close to impossible on a first run.

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
- **HUD:** HP, the 3 active slots with cooldown sweeps, the passive slot, gold,
  party lives, whose turn it is, a small minimap.
- **Audio:** sound effects and looping chiptune tracks synthesised in the browser.

## 11. Technology

- TypeScript, built with Vite, on the Phaser 2D engine **(default)**.
- Maps authored as data files so that maps 2-8 are content, not new code.
- No server; everything runs and saves locally in the browser.

## 12. First delivery: hub + map 1

- All core systems: turns and hand-off, lives, camp and trading, merchant,
  inventory with the swap-when-safe rule, fog of war, saving with 3 files and
  export/import, hub with hero profiles, upgrades and starter kits.
- Map 1 complete: 6 sections from forest into bandit cave, 6 monster types,
  one monster generator, traps, 2 main-path puzzles, 2-3 secrets, one NPC, one
  merchant, a 3-phase mini-boss.
- About 12-15 items across the three categories.
- Three music tracks (hub, map, boss) and core sound effects.

Maps 2-8, the two full bosses and the tier system follow once map 1 feels right.

## 13. Still open

- Story and tone beyond "classic fantasy": how much text, who the dark lord is.
- Exact numbers: HP, damage, prices, upgrade costs. These will be tuned by
  playing the vertical slice.
