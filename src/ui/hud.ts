// In-run heads-up display and the minimap. Drawn as DOM over the game canvas.
import { IC, T } from '../art/manifest';
import { G, activeHero, profileOf, run } from '../core';
import { ITEMS } from '../data/items';
import { scene } from '../game/scene';
import { SLOT_KEYS } from '../input';
import type { World } from '../game/world';
import { TILE, controlsOf } from '../types';
import { musicIcon, toggleMusic } from './sound';

/** Name colour per hero look; its length is the number of looks on offer. */
export const HERO_COLORS = ['#5aa2ff', '#ff6a5a', '#6fd36a', '#f2c84b', '#ff7fc0'];
export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const ico = (i: number, cls = '') => `<i class="ico ${cls}" style="--i:${i}"></i>`;
/** An item's icon. Rare items glint and legendary ones glow. */
export const itemIco = (id: string, cls = '') => ico(ITEMS[id].icon, `${cls} ${['', '', 'rare', 'legend'][ITEMS[id].rarity]}`);

let el: HTMLElement;
let mini: CanvasRenderingContext2D;
let last: Record<string, string> = {};
let lastFog = -1;
let lastHeroTile = -1;

export function initHud(root: HTMLElement): void {
  el = document.createElement('div');
  el.id = 'hud';
  el.hidden = true;
  el.innerHTML = `
    <div class="hud-tl">
      <div class="hud-name" data-h="name"></div>
      <div class="hpbar"><div class="hpfill" data-h="hpfill"></div><div class="hpbonus" data-h="hpbonus"></div><span data-h="hp"></span></div>
      <div class="hud-row"><span>${ico(IC.GoldUI, 'sm')}<b data-h="gold"></b></span><span data-h="keys"></span></div>
    </div>
    <div class="hud-tr">
      <canvas width="48" height="36" class="minimap"></canvas>
      <div class="hud-row right"><span>${ico(IC.LifeUI, 'sm')}<b data-h="lives"></b></span></div>
      <div class="hud-section" data-h="section"></div>
      <div class="hud-pips" data-h="pips"></div>
    </div>
    <div class="hud-boss" data-h="boss" hidden><div class="boss-name" data-h="bossname"></div><div class="bossbar"><div class="bossfill" data-h="bossfill"></div></div><div class="boss-pips" data-h="bosspips"></div></div>
    <div class="hud-prompt" data-h="prompt"></div>
    <div class="hud-slots">
      ${[0, 1, 2].map((i) => `<div class="slot"><div data-h="s${i}"></div><div class="cdmask" data-h="cd${i}"></div><span class="key" data-h="k${i}"></span></div>`).join('')}
      <div class="slot passive"><div data-h="s3"></div><span class="key">Passive</span></div>
    </div>
    <button class="btn ghost iconbtn hud-music" data-h="music" tabindex="-1" title="Music on / off" aria-label="Music on / off"></button>`;
  root.appendChild(el);
  const music = el.querySelector('.hud-music') as HTMLButtonElement;
  music.addEventListener('mousedown', (e) => e.preventDefault()); // never take keyboard focus: Space is an ability key
  music.addEventListener('click', () => {
    toggleMusic();
    set('music', musicIcon()); // show it now, even when the game is paused and frames are not running
  });
  mini = (el.querySelector('.minimap') as HTMLCanvasElement).getContext('2d')!;
}

export function showHud(on: boolean): void {
  el.hidden = !on;
  last = {};
  lastFog = -1;
}

function set(key: string, html: string): HTMLElement {
  const node = el.querySelector(`[data-h="${key}"]`) as HTMLElement;
  if (last[key] !== html) {
    last[key] = html;
    node.innerHTML = html;
  }
  return node;
}

function style(key: string, prop: string, value: string): void {
  const k = key + ':' + prop;
  if (last[k] === value) return;
  last[k] = value;
  (el.querySelector(`[data-h="${key}"]`) as HTMLElement).style.setProperty(prop, value);
}

/** Called once per rendered frame. Only touches the DOM when a value changed. */
export function hudFrame(): void {
  if (el.hidden || !G.save?.run || !scene.loaded) return;
  const r = run();
  const rh = activeHero();
  const p = profileOf(rh);
  const st = scene.stats;
  const h = scene.hero;
  set('name', `<span style="color:${HERO_COLORS[p.color]}">${esc(p.name)}</span>`);
  if (st) {
    const bonus = Math.ceil(rh.bonusHp ?? 0);
    set('hp', `${Math.max(0, Math.ceil(rh.hp))}${bonus > 0 ? ` <b class="bonus">+${bonus}</b>` : ''} / ${st.maxHp}`);
    style('hpbonus', 'width', `${Math.max(0, Math.min(100, (bonus / st.maxHp) * 100)).toFixed(0)}%`);
    style('hpfill', 'width', `${Math.max(0, Math.min(100, (rh.hp / st.maxHp) * 100)).toFixed(0)}%`);
    style('hpfill', 'background', rh.hp / st.maxHp < 0.3 ? '#e0483a' : '#5fc24f');
  }
  set('gold', String(rh.gold));
  set('keys', r.keys.map((k) => ico(k === 'blue' ? IC.KeyBlueUI : IC.KeyRedUI, 'sm')).join(''));
  set('lives', String(r.lives) + (r.fallen ? ' <span class="risk">+1 to rescue</span>' : ''));
  set('section', `${esc(scene.def.sectionNames[r.checkpoint] ?? '')} · ${scene.tier.name}`);
  const total = scene.def.checkpoints.length;
  set('pips', Array.from({ length: total }, (_, i) => `<i class="pip ${i <= r.checkpoint ? 'on' : ''}"></i>`).join('') + '<i class="pip bosspip"></i>');
  const keys = SLOT_KEYS[controlsOf(p)];
  for (let i = 0; i < 3; i++) {
    set(`k${i}`, keys[i]);
    const s = rh.slots[i];
    const def = ITEMS[s?.id ?? 'fists'];
    set(`s${i}`, itemIco(def.id) + (s?.charges !== undefined ? `<b class="ch ${s.charges <= 0 ? 'zero' : ''}">${s.charges}</b>` : ''));
    const frac = h && h.cdMax[i] > 0 ? h.cd[i] / h.cdMax[i] : 0;
    style(`cd${i}`, 'height', `${(Math.max(0, Math.min(1, frac)) * 100).toFixed(0)}%`);
  }
  set('music', musicIcon());
  set('s3', rh.passive ? itemIco(rh.passive.id) : '<span class="none">-</span>');

  let prompt = scene.prompt ? `<kbd>E</kbd> ${esc(scene.prompt)}` : '';
  for (const [, secs] of Object.entries(scene.world.timers)) if (secs > 0) prompt = `Gate closes in ${secs.toFixed(1)}s`;
  set('prompt', scene.paused ? '' : prompt);

  const boss = scene.boss;
  const fight = !!boss && scene.world.bossLocked;
  const bossEl = el.querySelector('[data-h="boss"]') as HTMLElement;
  if (bossEl.hidden === fight) bossEl.hidden = !fight;
  if (fight && boss) {
    set('bossname', esc(boss.def.name));
    style('bossfill', 'width', `${Math.max(0, (boss.hp / boss.maxHp) * 100).toFixed(1)}%`);
    set('bosspips', [0, 1, 2].map((i) => `<i class="pip ${i < boss.boss!.phase ? 'broken' : 'on'}"></i>`).join(''));
  }

  if (h) {
    const ht = scene.world.idx(Math.floor(h.x / TILE), Math.floor(h.y / TILE));
    if (scene.fogVersion !== lastFog || ht !== lastHeroTile) {
      lastFog = scene.fogVersion;
      lastHeroTile = ht;
      const hx = Math.floor(h.x / TILE);
      const hy = Math.floor(h.y / TILE);
      drawMap(mini, scene.world, hx - 24, hy - 18, 48, 36, 1, hx, hy);
    }
  }
}

const MAP_COLORS: Record<number, string> = {
  [T.Grass]: '#3f7a3c', [T.Grass2]: '#3f7a3c', [T.Grass3]: '#3f7a3c', [T.Dirt]: '#9a7a4a', [T.Dirt2]: '#9a7a4a',
  [T.Tree]: '#1d4027', [T.Tree2]: '#1d4027', [T.Bush]: '#2c5a30', [T.Rock]: '#6a6a70', [T.Water]: '#3a6ac0',
  [T.CaveFloor]: '#6d6478', [T.CaveFloor2]: '#6d6478', [T.CaveFloor3]: '#6d6478', [T.CaveWall]: '#2a2533', [T.CaveWallFace]: '#3a3445',
  [T.Cracked]: '#3a3445', [T.Rubble]: '#7d7488', [T.Pit]: '#0a0810', [T.PitEdge]: '#0a0810', [T.Planks]: '#8a6a40',
};

/** Draws explored terrain and landmarks. Used by the minimap and the full map screen. */
export function drawMap(ctx: CanvasRenderingContext2D, w: World, x0: number, y0: number, cols: number, rows: number, scale: number, hx: number, hy: number): void {
  ctx.fillStyle = '#07060b';
  ctx.fillRect(0, 0, cols * scale, rows * scale);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const tx = x0 + x;
      const ty = y0 + y;
      if (!w.inside(tx, ty) || !w.explored[w.idx(tx, ty)]) continue;
      ctx.fillStyle = MAP_COLORS[w.tiles[w.idx(tx, ty)]] ?? '#000';
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  const cp = run().checkpoint;
  for (const o of w.objs) {
    if (!w.inside(o.x, o.y) || !w.explored[w.idx(o.x, o.y)]) continue;
    const t = o.def.type;
    let c = '';
    if (t === 'campfire') c = o.def.index! <= cp ? '#ffb030' : '#b06a30';
    else if (t === 'chest' && !o.open) c = '#ffe14a';
    else if ((t === 'door' || t === 'gate') && !o.open) c = '#d04838';
    else if (t === 'shrine' && !o.open) c = '#7af0ff';
    else if (t === 'pedestal' && !o.open) c = '#ff8af0';
    if (!c) continue;
    ctx.fillStyle = c;
    ctx.fillRect((o.x - x0) * scale, (o.y - y0) * scale, scale, scale);
  }
  const fallen = run().fallen;
  if (fallen) {
    ctx.fillStyle = '#6dff8a';
    ctx.fillRect((Math.floor(fallen.x / TILE) - x0) * scale, (Math.floor(fallen.y / TILE) - y0) * scale, scale, scale);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect((hx - x0) * scale - (scale > 1 ? 1 : 0), (hy - y0) * scale - (scale > 1 ? 1 : 0), scale + (scale > 1 ? 2 : 0), scale + (scale > 1 ? 2 : 0));
}
