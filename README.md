# Campfire Crawl

A top-down, pixel-art dungeon crawler for 1-4 players who pass one keyboard and
mouse between turns. See [GAME_DESIGN.md](GAME_DESIGN.md) for the full design.

Built so far: the hub, map 1 (Whispering Woods into the Bandit Cave) and map 2 (the Drowned Mire into the
Sunken Temple), each on three difficulty tiers. Clearing map 1 opens map 2; pick the map and tier at the camp.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:5183.

## Controls

| Input | Action |
|---|---|
| W A S D | Move |
| Mouse | Aim |
| Left click / Right click / Space | Use slots 1, 2, 3 |
| E | Interact |
| Tab or I | Pack |
| M | Map |
| Esc | Pause |

Each hero can switch to **facing aim** in their settings (at the camp, or from the
pause menu): abilities go the way the hero faces, with aim assist, and slots 1 and 2
move to J and K.

## Project layout

- `src/data/` - items, monsters, upgrades and maps. `map1.ts` and `map2.ts` are each a whole map.
- `src/world/mapdef.ts` - the map format and the builder maps are authored with.
- `src/game/` - the world scene, monster behaviour (`priest.ts` is map 2's boss) and puzzle state.
- `src/ui/` - menus and HUD (plain DOM over the canvas).
- `src/art/`, `src/audio/` - pixel art and sound, all generated in code. `src/art/mire.ts` holds map 2's art.
- `src/run.ts`, `src/save.ts` - run rules and save files.

## Checks

```bash
npm run check
```

Type-checks, verifies every map is completable (each gate gates, each secret
needs its trick), and runs the rule checks.
