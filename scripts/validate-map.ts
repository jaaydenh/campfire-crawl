// Checks that a map can actually be played: everything is reachable in the intended
// order and every gate really gates. Run with: npm run validate
import { T } from '../src/art/manifest';
import { MAPS } from '../src/data/maps';
import { PIT_TILES, SOLID_OBJECTS, SOLID_TILES, type MapDef, type MapObject } from '../src/world/mapdef';

const ascii = process.argv.includes('--ascii');
let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log('  FAIL ' + msg);
};

function reach(m: MapDef, from: { x: number; y: number }, open: (o: MapObject) => boolean, extraOpenTiles: Set<number> = new Set()): Uint8Array {
  const blocked = new Uint8Array(m.w * m.h);
  for (const o of m.objects) {
    if (o.type === 'hidden') {
      if (!open(o)) blocked[o.y * m.w + o.x] = 1;
    } else if ((SOLID_OBJECTS.has(o.type) || (o.type === 'decor' && o.solid)) && !((o.type === 'gate' || o.type === 'door') && open(o)) && o.type !== 'block' && o.type !== 'pot')
      blocked[o.y * m.w + o.x] = 1;
  }
  const seen = new Uint8Array(m.w * m.h);
  const q = [from.y * m.w + from.x];
  seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop()!;
    const x = i % m.w;
    const y = (i - x) / m.w;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (y + dy) * m.w + x + dx;
      if (seen[j] || blocked[j]) continue;
      const t = m.tiles[j];
      const hiddenHere = m.objects.some((o) => o.type === 'hidden' && o.y * m.w + o.x === j);
      if (((SOLID_TILES.has(t) && !hiddenHere) || PIT_TILES.has(t)) && !extraOpenTiles.has(j)) continue;
      seen[j] = 1;
      q.push(j);
    }
  }
  return seen;
}

const near = (m: MapDef, seen: Uint8Array, x: number, y: number) =>
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(y + dy) * m.w + x + dx]);

for (const info of MAPS) {
  if (!info.build) continue;
  const m = info.build();
  console.log(`${info.name}: ${m.w}x${m.h}, ${m.objects.length} objects, ${m.spawns.length} monster spawns, ${m.checkpoints.length - 1} campfires`);

  // 1. Everything stands on sensible ground.
  for (const o of m.objects) {
    const t = m.tiles[o.y * m.w + o.x];
    const onWall = SOLID_TILES.has(t);
    const wantsWall = o.type === 'arrowtrap' || o.type === 'sconce' || o.type === 'hidden';
    if (o.type === 'secret') continue;
    if (wantsWall !== onWall) fail(`${o.id} at ${o.x},${o.y} is on ${T[t]}`);
    if (PIT_TILES.has(t)) fail(`${o.id} at ${o.x},${o.y} is over a pit`);
  }
  const taken = new Map<number, string>();
  for (const o of m.objects) {
    if (o.type === 'secret') continue;
    const k = o.y * m.w + o.x;
    if (taken.has(k)) fail(`${o.id} overlaps ${taken.get(k)} at ${o.x},${o.y}`);
    taken.set(k, o.id);
  }
  for (const s of m.spawns) {
    const t = m.tiles[s.y * m.w + s.x];
    if (SOLID_TILES.has(t) || PIT_TILES.has(t)) fail(`spawn ${s.id} at ${s.x},${s.y} is on ${T[t]}`);
    if (taken.has(s.y * m.w + s.x)) fail(`spawn ${s.id} overlaps ${taken.get(s.y * m.w + s.x)}`);
  }
  for (const [i, c] of m.checkpoints.entries()) {
    const t = m.tiles[c.y * m.w + c.x];
    if (SOLID_TILES.has(t) || PIT_TILES.has(t) || taken.has(c.y * m.w + c.x)) fail(`checkpoint ${i} spawn tile ${c.x},${c.y} is blocked`);
  }

  // 2. With every gate open, everything is reachable on foot (secrets behind pits and cracks excepted).
  const all = reach(m, m.checkpoints[0], () => true);
  for (const [i, c] of m.checkpoints.entries()) if (!all[c.y * m.w + c.x]) fail(`checkpoint ${i} unreachable even with all gates open`);
  for (const s of m.spawns) if (!all[s.y * m.w + s.x]) fail(`spawn ${s.id} (${s.options[0]}) at ${s.x},${s.y} unreachable`);
  if (!all[m.boss.y * m.w + m.boss.x]) fail('boss unreachable');
  const needsGear = new Set<string>();
  for (const o of m.objects) {
    if (['chest', 'lever', 'brazier', 'shrine', 'pedestal', 'npc', 'sign', 'plate', 'block'].includes(o.type) && !near(m, all, o.x, o.y)) needsGear.add(`${o.type} ${o.id} at ${o.x},${o.y}`);
  }
  console.log(`  not reachable on foot (should only be gear-gated extras): ${[...needsGear].join('; ') || 'none'}`);

  // 3. With everything closed, each checkpoint only reaches the next one through its puzzle.
  const closed = (from: number) => reach(m, m.checkpoints[from], () => false);
  for (let i = 0; i < m.checkpoints.length - 1; i++) {
    const seen = closed(i);
    const next = m.checkpoints[i + 1];
    const got = !!seen[next.y * m.w + next.x];
    console.log(`  checkpoint ${i} -> ${i + 1} with all gates shut: ${got ? 'open path' : 'gated'}`);
  }
  // Main-path puzzle pieces must be reachable before their gate.
  const mainPuzzles = new Set(m.objects.filter((o) => o.type === 'gate' && !o.meta).map((o) => o.puzzle));
  for (const o of m.objects) {
    if (!o.puzzle || !mainPuzzles.has(o.puzzle) || o.puzzle === m.boss.gate || o.type === 'gate') continue;
    const sec = o.section;
    const seen = reach(m, m.checkpoints[sec], (g) => g.section < sec);
    if (!near(m, seen, o.x, o.y)) console.log(`  note: ${o.type} ${o.id} for puzzle '${o.puzzle}' is not walkable-adjacent from checkpoint ${sec} (fine only if it is meant to be shot)`);
  }
  for (const o of m.objects) {
    if (o.type === 'chest' && o.loot?.startsWith('key:')) {
      const seen = reach(m, m.checkpoints[o.section], () => false);
      if (!near(m, seen, o.x, o.y)) fail(`key chest ${o.id} cannot be reached before its door`);
    }
  }
  // Secrets must not be reachable without their trick.
  for (const o of m.objects) {
    if (o.type !== 'secret') continue;
    const seen = reach(m, m.checkpoints[0], (g) => g.type !== 'hidden');
    if (seen[(o.y + 1) * m.w + o.x + 1]) fail(`secret ${o.secret} is reachable without its trick`);
  }

  if (ascii) {
    const ch: Record<number, string> = { [T.Tree]: '#', [T.Tree2]: '#', [T.CaveWall]: '%', [T.CaveWallFace]: '=', [T.Cracked]: 'X', [T.Pit]: '~', [T.PitEdge]: '~', [T.Water]: 'w', [T.Dirt]: ',', [T.Dirt2]: ',' };
    const sym: Record<string, string> = { campfire: 'C', chest: '$', pot: 'o', sign: '?', npc: 'N', door: 'D', gate: 'G', hidden: 'H', plate: '_', block: 'B', lever: 'L', brazier: 'b', spikes: '^', arrowtrap: 'A', shrine: '+', pedestal: 'P', sconce: 't', decor: 'd' };
    const grid: string[][] = [];
    for (let y = 0; y < m.h; y++) grid.push(Array.from({ length: m.w }, (_, x) => ch[m.tiles[y * m.w + x]] ?? '.'));
    for (const o of m.objects) if (sym[o.type]) grid[o.y][o.x] = sym[o.type];
    for (const s of m.spawns) grid[s.y][s.x] = s.options[0][0];
    grid[m.checkpoints[0].y][m.checkpoints[0].x] = '@';
    grid[m.boss.y][m.boss.x] = '!';
    const rows = grid.map((r) => r.join(''));
    const first = rows.findIndex((r) => /[^#%]/.test(r));
    const last = rows.length - 1 - [...rows].reverse().findIndex((r) => /[^#%]/.test(r));
    console.log(rows.slice(Math.max(0, first - 1), last + 2).join('\n'));
  }
}
console.log(failures ? `\n${failures} problem(s) found` : '\nMap checks passed');
process.exit(failures ? 1 : 0);
