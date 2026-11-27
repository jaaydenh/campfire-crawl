// Checks that a map can actually be played: everything is reachable in the intended
// order and every gate really gates. Run with: npm run validate
import { T } from '../src/art/manifest';
import { MAPS } from '../src/data/maps';
import { DEEP_TILES, PIT_TILES, SOLID_OBJECTS, SOLID_TILES, blocksWalk, type MapDef, type MapObject } from '../src/world/mapdef';

const ascii = process.argv.includes('--ascii');
let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.log('  FAIL ' + msg);
};

/**
 * Every tile that can be walked to. Water is part of the search: a state is a tile and the level of every
 * channel, and standing next to a sluice wheel lets the level of its channel change. With `wheels` false the
 * water stays where it starts.
 */
function reach(m: MapDef, from: { x: number; y: number }, open: (o: MapObject) => boolean, wheels = true): Uint8Array {
  const chans = Object.keys(m.water);
  const kind = new Map<number, { bit: number; float: boolean }>();
  let start = 0;
  chans.forEach((ch, n) => {
    const c = m.water[ch];
    if (c.low) start |= 1 << n;
    for (const i of c.flood) kind.set(i, { bit: 1 << n, float: false });
    for (const i of c.float) kind.set(i, { bit: 1 << n, float: true });
  });
  const turn = new Map<number, number>(); // tile next to a wheel -> the channels it can turn there
  for (const o of m.objects) {
    if (o.type !== 'valve') continue;
    const bit = 1 << chans.indexOf(o.channel!);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (o.y + dy) * m.w + o.x + dx;
      turn.set(j, (turn.get(j) ?? 0) | bit);
    }
  }
  const masks = 1 << chans.length;
  const size = m.w * m.h;
  const blocked = new Uint8Array(m.w * m.h);
  for (const o of m.objects) {
    if (o.type === 'hidden') {
      if (!open(o)) blocked[o.y * m.w + o.x] = 1;
    } else if ((SOLID_OBJECTS.has(o.type) || (o.type === 'decor' && o.solid)) && !((o.type === 'gate' || o.type === 'door') && open(o)) && o.type !== 'block' && o.type !== 'pot')
      blocked[o.y * m.w + o.x] = 1;
  }
  const hidden = new Set(m.objects.filter((o) => o.type === 'hidden').map((o) => o.y * m.w + o.x));
  const walk = (j: number, mask: number): boolean => {
    if (blocked[j]) return false;
    const k = kind.get(j);
    if (k) return k.float ? !(mask & k.bit) : !!(mask & k.bit); // a raft rides at high water; a channel is floor at low water
    const t = m.tiles[j];
    return !(SOLID_TILES.has(t) && !hidden.has(j)) && !PIT_TILES.has(t) && !DEEP_TILES.has(t);
  };
  const seenAt = new Uint8Array(size * masks);
  const seen = new Uint8Array(size);
  const q = [(from.y * m.w + from.x) * masks + start];
  seenAt[q[0]] = 1;
  while (q.length) {
    const s = q.pop()!;
    const mask = s % masks;
    const i = (s - mask) / masks;
    seen[i] = 1;
    const x = i % m.w;
    const y = (i - x) / m.w;
    const push = (j: number, mk: number) => {
      const n = j * masks + mk;
      if (seenAt[n]) return;
      seenAt[n] = 1;
      q.push(n);
    };
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const j = (y + dy) * m.w + x + dx;
      if (walk(j, mask)) push(j, mask);
    }
    const bits = wheels ? (turn.get(i) ?? 0) : 0;
    for (let n = 0; n < chans.length; n++) if (bits & (1 << n)) push(i, mask ^ (1 << n));
  }
  return seen;
}

/** True if a solid object stands on a tile. */
const taken0 = (m: MapDef, x: number, y: number) => m.objects.some((o) => o.x === x && o.y === y && (SOLID_OBJECTS.has(o.type) || (o.type === 'decor' && !!o.solid)));

const near = (m: MapDef, seen: Uint8Array, x: number, y: number) =>
  [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(y + dy) * m.w + x + dx]);

for (const info of MAPS)
  for (const tier of [1, 2, 3]) {
  if (!info.build) continue;
  const m = info.build(tier);
  console.log(`${info.name}, tier ${tier}: ${m.w}x${m.h}, ${m.objects.length} objects, ${m.spawns.length} monster spawns, ${m.checkpoints.length - 1} campfires`);

  // 1. Everything stands on sensible ground.
  for (const o of m.objects) {
    const t = m.tiles[o.y * m.w + o.x];
    const onWall = SOLID_TILES.has(t);
    const wantsWall = o.type === 'arrowtrap' || o.type === 'sconce' || o.type === 'hidden';
    if (o.type === 'secret') continue;
    if (wantsWall !== onWall) fail(`${o.id} at ${o.x},${o.y} is on ${T[t]}`);
    if (PIT_TILES.has(t)) fail(`${o.id} at ${o.x},${o.y} is over a pit`);
    if (DEEP_TILES.has(t)) fail(`${o.id} at ${o.x},${o.y} is in deep water`);
  }
  // A wheel is turned from the tile beside it, so that tile must never be water of the wheel's own channel.
  for (const o of m.objects) {
    if (o.type !== 'valve') continue;
    const c = m.water[o.channel!];
    if (!c) fail(`${o.id} works a channel that does not exist: ${o.channel}`);
    else for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if ([...c.flood, ...c.float].includes((o.y + dy) * m.w + o.x + dx)) fail(`${o.id} can be turned from its own water at ${o.x + dx},${o.y + dy}`);
  }
  // The boss arena's flood must leave its walls alone.
  for (const i of (m.boss.flood ?? []).flat()) if (blocksWalk(m.tiles[i])) fail(`arena flood covers a tile nothing can stand on: ${i % m.w},${Math.floor(i / m.w)}`);
  for (const a of m.boss.anchors ?? []) if (blocksWalk(m.tiles[a.y * m.w + a.x]) || taken0(m, a.x, a.y)) fail(`boss anchor ${a.x},${a.y} is blocked`);
  const taken = new Map<number, string>();
  for (const o of m.objects) {
    if (o.type === 'secret') continue;
    const k = o.y * m.w + o.x;
    if (taken.has(k)) fail(`${o.id} overlaps ${taken.get(k)} at ${o.x},${o.y}`);
    taken.set(k, o.id);
  }
  for (const s of m.spawns) {
    const t = m.tiles[s.y * m.w + s.x];
    if (blocksWalk(t)) fail(`spawn ${s.id} at ${s.x},${s.y} is on ${T[t]}`);
    if (taken.has(s.y * m.w + s.x)) fail(`spawn ${s.id} overlaps ${taken.get(s.y * m.w + s.x)}`);
  }
  for (const [i, c] of m.checkpoints.entries()) {
    const t = m.tiles[c.y * m.w + c.x];
    if (blocksWalk(t) || taken.has(c.y * m.w + c.x)) fail(`checkpoint ${i} spawn tile ${c.x},${c.y} is blocked`);
  }

  // 2. With every gate open, everything is reachable on foot (secrets behind pits and cracks excepted).
  const all = reach(m, m.checkpoints[0], () => true);
  for (const [i, c] of m.checkpoints.entries()) if (!all[c.y * m.w + c.x]) fail(`checkpoint ${i} unreachable even with all gates open`);
  for (const s of m.spawns) if (!all[s.y * m.w + s.x]) fail(`spawn ${s.id} (${s.options[0]}) at ${s.x},${s.y} unreachable`);
  if (!all[m.boss.y * m.w + m.boss.x]) fail('boss unreachable');
  const needsGear = new Set<string>();
  for (const o of m.objects) {
    if (['chest', 'lever', 'brazier', 'shrine', 'pedestal', 'npc', 'sign', 'plate', 'block', 'valve'].includes(o.type) && !near(m, all, o.x, o.y)) needsGear.add(`${o.type} ${o.id} at ${o.x},${o.y}`);
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
  // Secrets must not be reachable without their trick. Turning the water is a trick: the search leaves the wheels alone.
  for (const o of m.objects) {
    if (o.type !== 'secret') continue;
    const seen = reach(m, m.checkpoints[0], (g) => g.type !== 'hidden', false);
    if (seen[(o.y + 1) * m.w + o.x + 1]) fail(`secret ${o.secret} is reachable without its trick`);
  }
  // Every secret this tier lists has its zone, and the other way round.
  const zones = new Set(m.objects.filter((o) => o.type === 'secret').map((o) => o.secret));
  for (const s of m.secrets) if (!zones.has(s.id)) fail(`secret ${s.id} has no zone on tier ${tier}`);
  for (const z of zones) if (!m.secrets.some((s) => s.id === z)) fail(`secret zone ${z} is not one of tier ${tier}'s secrets`);

  if (ascii) {
    const ch: Record<number, string> = {
      [T.Tree]: '#', [T.Tree2]: '#', [T.CaveWall]: '%', [T.CaveWallFace]: '=', [T.Cracked]: 'X', [T.Pit]: '~', [T.PitEdge]: '~', [T.Water]: 'w', [T.Dirt]: ',', [T.Dirt2]: ',',
      [T.MireTree]: '#', [T.MireTree2]: '#', [T.Reeds]: '|', [T.Bog]: ':', [T.Bog2]: ':', [T.Murk]: 'w', [T.Sinking]: '-', [T.Planks]: '=',
      [T.TempleWall]: '%', [T.TempleWallFace]: '=', [T.TempleCracked]: 'X', [T.Flood]: 'W', [T.Drained]: 'u', [T.Raft]: 'R', [T.Crumble]: '-',
    };
    const sym: Record<string, string> = { valve: 'V', vent: 'v', campfire: 'C', chest: '$', pot: 'o', sign: '?', npc: 'N', door: 'D', gate: 'G', hidden: 'H', plate: '_', block: 'B', lever: 'L', brazier: 'b', spikes: '^', arrowtrap: 'A', shrine: '+', pedestal: 'P', sconce: 't', decor: 'd' };
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
