// Menu screens. Everything here is plain DOM layered over the game canvas.
import { IC } from '../art/manifest';
import { audio } from '../audio/audio';
import * as app from '../app';
import { G, activeHero, profileOf, run } from '../core';
import { ITEMS, RARITY_NAMES, type ItemDef } from '../data/items';
import { MAPS, getMap } from '../data/maps';
import { MONSTERS } from '../data/monsters';
import { UPGRADES } from '../data/upgrades';
import { scene } from '../game/scene';
import { giveItem, heroStats, kitCost, kitOffer, shopStock, toggleKitItem, trimKit, upgradeCost, type RunSummary } from '../run';
import { SLOT_COUNT, deleteSlot, exportSave, loadSlot, newSave, parseSave, writeSlot } from '../save';
import { GAME_TITLE, LIVES_PER_HERO, MAX_HEROES, type ItemStack, type RunHero } from '../types';
import { HERO_COLORS, drawMap, esc, ico } from './hud';
import { applyVolumes, musicIcon, musicToggle, toggleMusic } from './sound';

type Handler = (el: HTMLElement, ev: Event) => void;

let modal: HTMLElement;
let toasts: HTMLElement;
let handlers: Record<string, Handler> = {};
let current = ''; // name of the open screen, '' when none
let overlayResume = false; // closing this screen resumes the simulation

export function initUi(root: HTMLElement): void {
  modal = document.createElement('div');
  modal.id = 'modal';
  modal.hidden = true;
  toasts = document.createElement('div');
  toasts.id = 'toasts';
  root.append(modal, toasts);
  modal.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!t || (t as HTMLButtonElement).disabled) return;
    const h = handlers[t.dataset.act!];
    if (h) {
      audio.unlock();
      h(t, ev);
    }
  });
  modal.addEventListener('mouseover', (ev) => {
    const t = (ev.target as HTMLElement).closest('[data-item]') as HTMLElement | null;
    const box = modal.querySelector('#desc');
    if (t && box) box.innerHTML = describe(t.dataset.item!, t.dataset.charges);
  });
  window.addEventListener('keydown', onKey);
}

function show(name: string, html: string, h: Record<string, Handler>, cls = ''): void {
  current = name;
  handlers = h;
  modal.className = cls;
  modal.innerHTML = html;
  modal.hidden = false;
}

export function closeScreen(): void {
  modal.hidden = true;
  modal.innerHTML = '';
  handlers = {};
  current = '';
  if (overlayResume) {
    overlayResume = false;
    scene.paused = false;
  }
}

/** Opens a screen over live play: the world pauses and resumes when it closes. */
function overlay(name: string, html: string, h: Record<string, Handler>, cls = ''): void {
  if (!overlayResume) overlayResume = !scene.paused;
  scene.paused = true;
  show(name, html, h, cls);
}

function onKey(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null;
  if (t && t.tagName === 'INPUT') return;
  if (current) {
    if (e.code === 'Enter' || e.code === 'Space' || (current === 'dialog' && e.code === 'KeyE')) {
      const def = modal.querySelector('[data-default]') as HTMLElement | null;
      if (def) {
        e.preventDefault();
        def.click();
      }
    } else if (e.code === 'Escape' || (current === 'inventory' && (e.code === 'Tab' || e.code === 'KeyI')) || (current === 'map' && e.code === 'KeyM')) {
      if (['inventory', 'map', 'pause', 'bestiary'].includes(current)) {
        e.preventDefault();
        if (current === 'bestiary') hubScreen();
        else closeScreen();
      }
    }
    return;
  }
  if (!scene?.loaded || scene.paused || !scene.hero || scene.hero.dead) return;
  if (e.code === 'Tab' || e.code === 'KeyI') inventoryScreen();
  else if (e.code === 'KeyM') mapScreen();
  else if (e.code === 'Escape') pauseScreen();
}

export function toast(msg: string, kind: 'good' | 'bad' | 'info' = 'info'): void {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  toasts.appendChild(t);
  while (toasts.children.length > 4) toasts.firstChild!.remove();
  setTimeout(() => t.classList.add('out'), 3600);
  setTimeout(() => t.remove(), 4200);
}

function describe(id: string, charges?: string): string {
  const d = ITEMS[id];
  if (!d) return '';
  const tags = [RARITY_NAMES[d.rarity], d.cat, d.slot === 'passive' ? 'passive slot' : 'active slot'];
  if (d.ammo) tags.push(`${charges || d.charges} arrows`);
  else if (d.charges) tags.push(`${charges ?? d.charges} of ${d.charges} uses left`);
  if (d.cooldown && !d.hold) tags.push(`${(d.cooldown / 1000).toFixed(1)}s cooldown`);
  return `<b class="r${d.rarity}">${esc(d.name)}</b><span class="muted"> ${tags.join(' · ')}</span><br>${esc(d.desc)}`;
}

const heroIco = (color: number, cls = '') => `<i class="heroico ${cls}" style="--hero:var(--hero${color})"></i>`;

// ---------------------------------------------------------------- title and save files

export function titleScreen(): void {
  audio.music('hub');
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => loadSlot(i));
  const card = (i: number) => {
    const s = slots[i];
    if (!s)
      return `<div class="panel slotcard"><h3>Save ${i + 1}</h3><p class="muted">Empty</p>
        <div class="row"><button class="btn" data-act="new" data-i="${i}">New game</button><button class="btn ghost" data-act="import" data-i="${i}">Import file</button></div></div>`;
    const heroes = s.heroes.map((h) => `<span style="color:${HERO_COLORS[h.color]}">${esc(h.name)}</span>`).join(', ') || '<span class="muted">no heroes yet</span>';
    return `<div class="panel slotcard"><h3>Save ${i + 1}</h3>
      <p>${heroes}</p>
      <p class="muted">Runs: ${s.runsPlayed} · Maps open: ${s.mapsUnlocked} of 8${s.run ? ' · <span class="good">run in progress</span>' : ''}</p>
      <p class="muted">Last played ${new Date(s.updated).toLocaleDateString()}</p>
      <div class="row"><button class="btn" data-act="open" data-i="${i}">Continue</button><button class="btn ghost" data-act="export" data-i="${i}">Export</button><button class="btn ghost danger" data-act="delete" data-i="${i}">Delete</button></div></div>`;
  };
  show(
    'title',
    `<div class="screen title">
      <h1>${GAME_TITLE}</h1>
      <p class="tag">A pass-the-controls dungeon crawl for 1 to 4 players</p>
      <div class="row slots">${[0, 1, 2].map(card).join('')}</div>
      <p class="muted small">Progress is stored in this browser. Export a save to back it up or move it to another computer.</p>
      <input type="file" id="importfile" accept=".json,application/json" hidden>
    </div>`,
    {
      new: (el) => {
        G.slot = Number(el.dataset.i);
        G.save = newSave();
        applyVolumes();
        app.saveNow();
        hubScreen();
      },
      open: (el) => {
        G.slot = Number(el.dataset.i);
        G.save = loadSlot(G.slot);
        if (!G.save) return titleScreen();
        applyVolumes();
        hubScreen();
      },
      export: (el) => {
        const i = Number(el.dataset.i);
        const s = loadSlot(i);
        if (s) exportSave(s, i);
      },
      delete: (el) => {
        const i = Number(el.dataset.i);
        confirmBox(`Delete save ${i + 1}? Its heroes and all their progress will be gone for good.`, 'Delete', () => {
          deleteSlot(i);
          titleScreen();
        }, titleScreen);
      },
      import: (el) => {
        const i = Number(el.dataset.i);
        const inp = modal.querySelector('#importfile') as HTMLInputElement;
        inp.onchange = async () => {
          const f = inp.files?.[0];
          if (!f) return;
          try {
            const s = parseSave(await f.text());
            if (!writeSlot(i, s)) throw new Error('This browser would not store the save.');
            toast(`Imported into save ${i + 1}.`, 'good');
          } catch (err) {
            toast((err as Error).message, 'bad');
          }
          titleScreen();
        };
        inp.click();
      },
    },
  );
}

function confirmBox(msg: string, yes: string, onYes: () => void, onNo: () => void): void {
  show('confirm', `<div class="screen dim"><div class="panel narrow"><p>${esc(msg)}</p><div class="row"><button class="btn danger" data-act="yes">${esc(yes)}</button><button class="btn ghost" data-act="no" data-default>Cancel</button></div></div></div>`, { yes: onYes, no: onNo });
}

// ---------------------------------------------------------------- hub

let party: number[] = [];
let selHero = 0;
let addingHero = false;

export function hubScreen(): void {
  const s = G.save!;
  audio.music('hub');
  party = party.filter((i) => i < s.heroes.length);
  if (!party.length && !s.run) party = s.heroes.map((_, i) => i);
  if (selHero >= s.heroes.length) selHero = Math.max(0, s.heroes.length - 1);
  s.heroes.forEach((_, i) => trimKit(s, i)); // last run's choices are not on offer any more
  const p = s.heroes[selHero];

  const heroCards = s.heroes
    .map((h, i) => {
      const order = party.indexOf(i);
      return `<div class="herocard ${i === selHero ? 'sel' : ''}" data-act="sel" data-i="${i}">
        ${heroIco(h.color)}
        <div class="grow"><b style="color:${HERO_COLORS[h.color]}">${esc(h.name)}</b><br><span class="gold">${ico(IC.Renown, 'sm')}${h.renown}</span></div>
        ${s.run ? '' : `<button class="btn tiny ${order >= 0 ? '' : 'ghost'}" data-act="party" data-i="${i}">${order >= 0 ? `Player ${order + 1}` : 'Sitting out'}</button>`}
      </div>`;
    })
    .join('');

  const addForm = addingHero
    ? `<div class="panel inset"><input id="heroname" maxlength="10" placeholder="Hero name" autocomplete="off">
        <div class="row">${[0, 1, 2, 3].map((c) => `<button class="colorpick" data-act="create" data-c="${c}">${heroIco(c)}</button>`).join('')}</div>
        <p class="muted small">Type a name, then pick a colour.</p></div>`
    : s.heroes.length < MAX_HEROES
      ? `<button class="btn ghost wide" data-act="add">+ Add a hero</button>`
      : '';

  let detail = '<p class="muted">Add a hero to begin. Each player gets their own.</p>';
  if (p) {
    const ups = UPGRADES.map((u) => {
      const lv = p.upgrades[u.id] ?? 0;
      const cost = upgradeCost(p, u.id);
      return `<div class="uprow"><b class="upname">${u.name}</b><span class="muted pips">${'●'.repeat(lv)}${'○'.repeat(u.costs.length - lv)}</span><span class="muted small grow">${u.desc}</span>
        ${cost === null ? '<span class="muted">Max</span>' : `<button class="btn tiny" data-act="buy" data-id="${u.id}" ${cost > p.renown ? 'disabled' : ''}>${ico(IC.Renown, 'sm')}${cost}</button>`}</div>`;
    }).join('');
    const kc = kitCost(p);
    const activeFull = p.kit.slice(0, 3).every(Boolean);
    const offers = kitOffer(s, selHero)
      .map((id) => {
        const d = ITEMS[id];
        const chosen = p.kit.includes(id);
        const refund = d.slot === 'passive' && p.kit[3] ? ITEMS[p.kit[3]].kit : 0;
        const blocked = !chosen && (kc - refund + d.kit > p.renown || (d.slot === 'active' && activeFull));
        return `<button class="pick ${chosen ? 'on' : ''}" data-act="pick" data-id="${id}" data-item="${id}" ${blocked ? 'disabled' : ''}>${ico(d.icon, 'sm')}<span class="r${d.rarity}">${esc(d.name)}</span><span class="cost">${chosen ? 'in kit · ' : ''}${ico(IC.Renown, 'sm')}${d.kit}</span></button>`;
      })
      .join('');
    detail = `<h3 style="color:${HERO_COLORS[p.color]}">${esc(p.name)} <span class="muted small">${ico(IC.Renown, 'sm')}${p.renown} renown to spend</span></h3>
      <h4>Permanent upgrades</h4>${ups}
      <h4>Starter kit <span class="muted small">${kc ? `costs ${kc} renown at run start` : 'four offers, new every run'}</span></h4>
      <div class="picker">${offers}</div>
      <div id="desc" class="desc"></div>
      ${s.run ? '' : `<button class="btn ghost tiny danger" data-act="retire">Retire this hero</button>`}`;
  }

  const k = s.knowledge;
  const maps = MAPS.map((m) => {
    const open = m.number <= s.mapsUnlocked;
    const built = !!m.build;
    const kn = k[m.id];
    const sub = !open ? 'Locked: clear the map before it' : !built ? 'Unlocked, but not built yet' : `${m.blurb}${kn ? ` · secrets ${kn.secrets.length}/${getMap(m.id).secrets.length} · clears ${kn.clears}` : ''}`;
    return `<div class="maprow ${open && built ? 'open' : 'locked'}"><b>${m.number}. ${open ? esc(m.name) : '???'}</b><br><span class="muted small">${sub}</span></div>`;
  }).join('');

  let runBox: string;
  if (s.run) {
    const r = s.run;
    const def = getMap(r.mapId);
    runBox = `<div class="panel inset"><b class="good">Run in progress</b><p class="muted small">${esc(def.name)} · ${esc(def.sectionNames[r.checkpoint])} · ${r.lives} ${r.lives === 1 ? 'life' : 'lives'} left · next up: ${esc(s.heroes[r.heroes[r.active].profile].name)}</p>
      <div class="row"><button class="btn" data-act="resume" data-default>Resume</button><button class="btn ghost danger" data-act="abandon">Abandon</button></div></div>`;
  } else {
    const lives = party.length * LIVES_PER_HERO + party.reduce((n, i) => n + (s.heroes[i].upgrades.wind ?? 0), 0);
    const over = party.some((i) => kitCost(s.heroes[i]) > s.heroes[i].renown);
    runBox = `<div class="panel inset"><b>Map 1: Whispering Woods</b>
      <p class="muted small">${party.length ? `${party.length} ${party.length === 1 ? 'player' : 'players'}: ${party.map((i) => esc(s.heroes[i].name)).join(', then ')} · ${lives} shared lives` : 'Choose at least one hero to play.'}</p>
      <button class="btn big" data-act="start" ${party.length && !over ? '' : 'disabled'} data-default>Start run</button></div>`;
  }

  const scrolled = current === 'hub' ? (modal.querySelector('.detail')?.scrollTop ?? 0) : 0;
  show(
    'hub',
    `<div class="screen hub">
      <div class="hubhead"><h2>The Camp</h2><span class="muted">Save ${G.slot + 1}</span><span class="grow"></span>
        <button class="btn ghost tiny" data-act="bestiary">Bestiary (${s.bestiary.length})</button><button class="btn ghost tiny" data-act="title">Save &amp; exit to title</button>${musicToggle()}</div>
      <div class="hubcols">
        <div class="panel col heroes"><h3>Heroes</h3>${heroCards}${addForm}</div>
        <div class="panel col detail">${detail}</div>
        <div class="panel col maps"><h3>Maps</h3><div class="maplist">${maps}</div>${runBox}</div>
      </div>
    </div>`,
    {
      sel: (el) => {
        selHero = Number(el.dataset.i);
        hubScreen();
      },
      party: (el, ev) => {
        ev.stopPropagation();
        const i = Number(el.dataset.i);
        if (party.includes(i)) party = party.filter((x) => x !== i);
        else party.push(i);
        hubScreen();
      },
      add: () => {
        addingHero = true;
        hubScreen();
        (modal.querySelector('#heroname') as HTMLInputElement)?.focus();
      },
      create: (el) => {
        const name = (modal.querySelector('#heroname') as HTMLInputElement).value.trim();
        if (!name) return toast('Give the hero a name first.', 'bad');
        s.heroes.push({ name, color: Number(el.dataset.c), renown: 0, upgrades: {}, kit: [null, null, null, null] });
        party.push(s.heroes.length - 1);
        selHero = s.heroes.length - 1;
        addingHero = false;
        app.saveNow();
        hubScreen();
      },
      retire: () =>
        confirmBox(`Retire ${p.name}? Their renown and upgrades are lost for good.`, 'Retire', () => {
          s.heroes.splice(selHero, 1);
          party = [];
          app.saveNow();
          hubScreen();
        }, hubScreen),
      buy: (el) => {
        const cost = upgradeCost(p, el.dataset.id!);
        if (cost === null || cost > p.renown) return;
        p.renown -= cost;
        p.upgrades[el.dataset.id!] = (p.upgrades[el.dataset.id!] ?? 0) + 1;
        if (kitCost(p) > p.renown) p.kit = [null, null, null, null];
        audio.sfx('buy');
        app.saveNow();
        hubScreen();
      },
      pick: (el) => {
        const res = toggleKitItem(s, selHero, el.dataset.id!);
        if (res === 'full') return toast('All three active slots are taken. Remove one first.', 'bad');
        if (res === 'cost') return toast('Not enough renown for that.', 'bad');
        audio.sfx(res === 'added' ? 'buy' : 'ui');
        app.saveNow();
        hubScreen();
      },
      start: () => {
        closeScreen();
        app.startRun([...party], 'map1');
      },
      resume: () => {
        closeScreen();
        app.resumeRun();
      },
      abandon: () => confirmBox('Abandon this run? Gold carried so far still becomes renown.', 'Abandon', () => app.abandonRun(), hubScreen),
      bestiary: bestiaryScreen,
      music: musicButton,
      title: () => {
        app.saveNow();
        G.save = null;
        titleScreen();
      },
    },
  );
  // every click redraws the screen: keep the hero panel where the player had scrolled it
  const panel = modal.querySelector('.detail');
  if (panel) panel.scrollTop = scrolled;
}

function bestiaryScreen(): void {
  const s = G.save!;
  const rows = Object.values(MONSTERS)
    .map((m) => {
      const known = s.bestiary.includes(m.id);
      return `<div class="uprow"><div class="grow"><b>${known ? esc(m.name) : '???'}</b><br><span class="muted small">${known ? esc(m.desc) : 'Not yet defeated.'}</span></div>${known ? `<span class="muted small">HP ${m.hp}${m.dmg ? ` · hits for ${m.dmg}` : ''}</span>` : ''}</div>`;
    })
    .join('');
  show('bestiary', `<div class="screen dim"><div class="panel mid"><h3>Bestiary</h3>${rows}<button class="btn" data-act="back" data-default>Back</button></div></div>`, { back: hubScreen });
}

// ---------------------------------------------------------------- inventory (shared by pack and camp screens)

type Loc = { h: number; where: 'slot' | 'passive' | 'pack'; i: number };
let sel: Loc | null = null;

const getAt = (l: Loc): ItemStack | null => {
  const rh = run().heroes[l.h];
  return l.where === 'slot' ? rh.slots[l.i] : l.where === 'passive' ? rh.passive : rh.pack[l.i];
};
const setAt = (l: Loc, v: ItemStack | null) => {
  const rh = run().heroes[l.h];
  if (l.where === 'slot') rh.slots[l.i] = v;
  else if (l.where === 'passive') rh.passive = v;
  else rh.pack[l.i] = v;
};
const fits = (v: ItemStack | null, l: Loc) => !v || l.where === 'pack' || ITEMS[v.id].slot === (l.where === 'passive' ? 'passive' : 'active');

function moveItem(a: Loc, b: Loc): boolean {
  const A = getAt(a);
  const B = getAt(b);
  if (!fits(A, b) || !fits(B, a)) return false;
  setAt(a, B);
  setAt(b, A);
  return true;
}

function invGrid(h: number, locked: boolean): string {
  const rh = run().heroes[h];
  const cell = (l: Loc, st: ItemStack | null, label: string) => {
    const isSel = sel && sel.h === l.h && sel.where === l.where && sel.i === l.i;
    return `<button class="cell ${isSel ? 'sel' : ''}" data-act="cell" data-h="${l.h}" data-w="${l.where}" data-i="${l.i}" ${locked ? 'disabled' : ''} ${st ? `data-item="${st.id}" data-charges="${st.charges ?? ''}"` : ''}>
      ${st ? ico(ITEMS[st.id].icon) + (st.charges !== undefined ? `<b class="ch">${st.charges}</b>` : '') : `<span class="empty">${label}</span>`}</button>`;
  };
  const keys = ['L-click', 'R-click', 'Space'];
  return `<div class="invgrid">
    <div class="row">${rh.slots.map((st, i) => `<div class="cellwrap">${cell({ h, where: 'slot', i }, st, 'fists')}<span class="key">${keys[i]}</span></div>`).join('')}
      <div class="cellwrap gap">${cell({ h, where: 'passive', i: 0 }, rh.passive, 'none')}<span class="key">Passive</span></div></div>
    <div class="row pack">${rh.pack.map((st, i) => cell({ h, where: 'pack', i }, st, '')).join('')}</div></div>`;
}

function clickCell(el: HTMLElement, redraw: () => void): void {
  const l: Loc = { h: Number(el.dataset.h), where: el.dataset.w as Loc['where'], i: Number(el.dataset.i) };
  if (!sel) {
    if (getAt(l)) sel = l;
  } else if (sel.h === l.h && sel.where === l.where && sel.i === l.i) {
    sel = null;
  } else {
    if (moveItem(sel, l)) audio.sfx('pickup');
    else {
      audio.sfx('deny');
      toast('That does not fit there: active items go in the three action slots, passive items in the passive slot.', 'bad');
    }
    sel = null;
  }
  redraw();
}

export function inventoryScreen(): void {
  const r = run();
  const rh = activeHero();
  const safe = scene.isSafe();
  const st = heroStats(G.save!, rh);
  const selItem = sel ? getAt(sel) : null;
  overlay(
    'inventory',
    `<div class="screen dim"><div class="panel mid">
      <h3>${esc(profileOf(rh).name)}'s pack</h3>
      ${safe ? '<p class="muted small">Click an item, then click where it should go.</p>' : '<p class="bad">Enemies are close. You can look, but you cannot change your gear until it is safe.</p>'}
      ${invGrid(r.active, !safe)}
      <div id="desc" class="desc">${selItem ? describe(selItem.id, String(selItem.charges ?? '')) : ''}</div>
      <p class="muted small">Max HP ${st.maxHp} · Damage x${st.dmgMult.toFixed(2)} · Light ${st.light} · Gold x${st.goldMult.toFixed(2)}${rh.charmHp || rh.charmDmg ? ` · Charms: ${rh.charmHp} vigor, ${rh.charmDmg} might` : ''}</p>
      <div class="row"><button class="btn" data-act="close" data-default>Close</button>
        <button class="btn ghost" data-act="drop" ${sel && safe ? '' : 'disabled'}>Drop selected</button></div>
    </div></div>`,
    {
      cell: (el) => clickCell(el, inventoryScreen),
      drop: () => {
        if (!sel) return;
        const item = getAt(sel);
        if (item && scene.hero) {
          setAt(sel, null);
          scene.dropGround(item, scene.hero.x, scene.hero.y + 6);
        }
        sel = null;
        inventoryScreen();
      },
      close: () => {
        sel = null;
        scene.refreshStats();
        closeScreen();
      },
    },
  );
}

export function mapScreen(): void {
  overlay('map', `<div class="screen dim"><div class="panel mapbox"><h3>${esc(scene.def.name)}</h3><canvas id="bigmap" width="${scene.world.w * 2}" height="${scene.world.h * 2}"></canvas>
    <p class="muted small">Orange: campfires · Yellow: unopened chests · Red: closed doors and gates · Cyan: shrines · Pink: pedestals</p>
    <button class="btn" data-act="close" data-default>Close</button></div></div>`, { close: closeScreen });
  const ctx = (modal.querySelector('#bigmap') as HTMLCanvasElement).getContext('2d')!;
  const h = scene.hero!;
  drawMap(ctx, scene.world, 0, 0, scene.world.w, scene.world.h, 2, Math.floor(h.x / 16), Math.floor(h.y / 16));
}

/** Click handler for the music toggle on any menu screen. */
function musicButton(el: HTMLElement): void {
  toggleMusic();
  el.innerHTML = musicIcon();
  el.blur(); // so Space and Enter keep going to the screen's main button
}

export function pauseScreen(): void {
  const v = G.save!.settings;
  overlay(
    'pause',
    `<div class="screen dim"><div class="panel narrow"><h3>Paused</h3>
      <div class="row nowrap volrow"><label class="grow">Music <input type="range" id="vmusic" min="0" max="1" step="0.05" value="${v.music}"></label>${musicToggle()}</div>
      <label>Sound <input type="range" id="vsfx" min="0" max="1" step="0.05" value="${v.sfx}"></label>
      <button class="btn wide" data-act="close" data-default>Resume</button>
      <button class="btn ghost wide" data-act="quit">Quit to camp</button>
      <p class="muted small">Quitting returns the party to the last campfire when you resume. The run is kept.</p>
    </div></div>`,
    {
      close: closeScreen,
      music: musicButton,
      quit: () => {
        overlayResume = false;
        closeScreen();
        app.quitToHub();
      },
    },
  );
  const upd = () => {
    const m = Number((modal.querySelector('#vmusic') as HTMLInputElement).value);
    const s = Number((modal.querySelector('#vsfx') as HTMLInputElement).value);
    G.save!.settings = { ...G.save!.settings, music: m, sfx: s };
    applyVolumes();
  };
  modal.querySelectorAll('input[type=range]').forEach((n) => n.addEventListener('input', upd));
}

export function dialog(name: string, lines: string[]): void {
  let i = 0;
  const draw = () =>
    overlay('dialog', `<div class="screen clear"><div class="panel dialog" data-act="next" data-default>${name ? `<b class="speaker">${esc(name)}</b>` : ''}<p>${esc(lines[i])}</p><span class="muted small more">${i < lines.length - 1 ? 'Space: more' : 'Space: close'}</span></div></div>`, {
      next: () => {
        audio.sfx('ui');
        if (++i >= lines.length) closeScreen();
        else draw();
      },
    });
  draw();
}

// ---------------------------------------------------------------- turn flow screens

function loadoutIcons(rh: RunHero): string {
  return rh.slots.map((s) => ico(ITEMS[s?.id ?? 'fists'].icon)).join('') + (rh.passive ? ico(ITEMS[rh.passive.id].icon) : '');
}

export function readyScreen(onGo: () => void): void {
  const r = run();
  const rh = activeHero();
  const p = profileOf(rh);
  const def = getMap(r.mapId);
  const st = heroStats(G.save!, rh);
  show(
    'ready',
    `<div class="screen dim"><div class="panel ready">
      ${r.heroes.length > 1 ? `<p class="muted">Pass the controls to</p><h4>Player ${r.active + 1}</h4>` : ''}
      <div class="row center">${heroIco(p.color, 'big')}<h2 style="color:${HERO_COLORS[p.color]}">${esc(p.name)}</h2></div>
      <p>${esc(def.sectionNames[r.checkpoint])} <span class="muted">· section ${r.checkpoint + 1} of ${def.sectionNames.length}</span></p>
      <p>${ico(IC.HeartUI, 'sm')} ${Math.ceil(rh.hp)} / ${st.maxHp} &nbsp; ${ico(IC.LifeUI, 'sm')} ${r.lives} shared ${r.lives === 1 ? 'life' : 'lives'}</p>
      <div class="row center">${loadoutIcons(rh)}</div>
      <button class="btn big" data-act="go" data-default>Begin</button>
      <p class="muted small">Space or Enter to begin</p>
    </div></div>`,
    {
      go: () => {
        closeScreen();
        audio.sfx('turn');
        onGo();
      },
    },
  );
}

export function deathScreen(fallen: number, onNext: () => void): void {
  const r = run();
  const p = G.save!.heroes[r.heroes[fallen].profile];
  show(
    'death',
    `<div class="screen dim red"><div class="panel ready"><h2 style="color:${HERO_COLORS[p.color]}">${esc(p.name)} has fallen</h2>
      <p>${ico(IC.LifeUI, 'sm')} ${r.lives} shared ${r.lives === 1 ? 'life' : 'lives'} left</p>
      <p class="muted">The party regroups at the last campfire. Monsters ahead have returned; opened doors, solved puzzles and looted chests stay as they are.</p>
      <button class="btn big" data-act="go" data-default>Continue</button></div></div>`,
    { go: () => { closeScreen(); onNext(); } },
  );
}

let shopBuyer = 0;

export function campScreen(index: number, arrived: number, onLeave: () => void): void {
  const r = run();
  const s = G.save!;
  const def = getMap(r.mapId);
  const merchant = def.objects.some((o) => o.type === 'campfire' && o.index === index && o.merchant);
  if (shopBuyer >= r.heroes.length) shopBuyer = 0;
  const redraw = () => campScreen(index, arrived, onLeave);
  const heroPanels = r.heroes
    .map((rh, h) => {
      const p = s.heroes[rh.profile];
      const st = heroStats(s, rh);
      return `<div class="panel inset camphero ${merchant && shopBuyer === h ? 'buyer' : ''}">
        <div class="row nowrap">${heroIco(p.color)}<div class="grow"><b style="color:${HERO_COLORS[p.color]}">${esc(p.name)}</b>${h === r.active ? ' <span class="good small">up next</span>' : ''}<br>
          <span class="small nobr">${ico(IC.HeartUI, 'sm')}${Math.ceil(Math.min(rh.hp, st.maxHp))}/${st.maxHp} &nbsp;${ico(IC.GoldUI, 'sm')}${rh.gold}</span></div>
          <div class="col tight">${merchant ? `<button class="btn tiny ${shopBuyer === h ? '' : 'ghost'}" data-act="buyer" data-h="${h}">${shopBuyer === h ? 'Shopping' : 'Shop as'}</button>` : ''}
          ${r.heroes.length > 1 ? `<button class="btn tiny ghost" data-act="gift" data-h="${h}" ${rh.gold >= 10 ? '' : 'disabled'}>Give 10 gold to ${esc(s.heroes[r.heroes[(h + 1) % r.heroes.length].profile].name)}</button>` : ''}</div></div>
        ${invGrid(h, false)}</div>`;
    })
    .join('');
  let shop = '';
  if (merchant) {
    const buyer = r.heroes[shopBuyer];
    const stock = shopStock(r, s, index);
    shop = `<div class="panel inset shop"><h4>Merchant <span class="muted small">selling to ${esc(s.heroes[buyer.profile].name)} (${buyer.gold} gold)</span></h4>${stock
      .map((e) => {
        const d = e.item ? ITEMS[e.item.id] : null;
        const label = d ? `<span class="r${d.rarity}">${esc(d.name)}</span>` : e.kind === 'heal' ? 'Bandages: heal 10 HP' : e.kind === 'charmHp' ? 'Vigor charm: +4 max HP this run' : 'Might charm: +10% damage this run';
        const icon = d ? d.icon : e.kind === 'heal' ? IC.Heal : e.kind === 'charmHp' ? IC.CharmHp : IC.CharmDmg;
        return `<button class="pick" data-act="shop" data-key="${e.key}" ${d ? `data-item="${d.id}"` : ''} ${e.price > buyer.gold ? 'disabled' : ''}>${ico(icon, 'sm')}${label}<span class="cost">${ico(IC.GoldUI, 'sm')}${e.price}</span></button>`;
      })
      .join('')}</div>`;
  }
  const last = index === def.checkpoints.length - 1;
  show(
    'camp',
    `<div class="screen camp">
      <div class="hubhead"><h2>Campfire ${index} of ${def.checkpoints.length - 1}</h2><span class="muted">${esc(s.heroes[r.heroes[arrived].profile].name)} made it. Progress saved. Everyone earns 5 renown.</span><span class="grow"></span>
        <span>${ico(IC.LifeUI, 'sm')} ${r.lives} ${r.lives === 1 ? 'life' : 'lives'}</span>
        ${musicToggle()}</div>
      <div class="campcols"><div class="col grow">${heroPanels}</div>${shop ? `<div class="col shopcol">${shop}</div>` : ''}</div>
      <div id="desc" class="desc"></div>
      <div class="row"><span class="muted small grow">Trade by clicking an item, then a space on any hero. ${last ? "The Chief's hall lies ahead." : `Next: ${esc(def.sectionNames[index])}.`}</span>
        <button class="btn big" data-act="leave" data-default>Break camp</button></div>
    </div>`,
    {
      cell: (el) => clickCell(el, redraw),
      music: musicButton,
      buyer: (el) => {
        shopBuyer = Number(el.dataset.h);
        redraw();
      },
      gift: (el) => {
        const from = r.heroes[Number(el.dataset.h)];
        const to = r.heroes[(Number(el.dataset.h) + 1) % r.heroes.length];
        if (from.gold < 10) return;
        from.gold -= 10;
        to.gold += 10;
        audio.sfx('coin');
        redraw();
      },
      shop: (el) => {
        const buyer = r.heroes[shopBuyer];
        const e = shopStock(r, s, index).find((x) => x.key === el.dataset.key);
        if (!e || e.price > buyer.gold) return;
        if (e.kind === 'item') {
          if (!giveItem(buyer, e.item!)) return toast('Their pack is full.', 'bad');
        } else if (e.kind === 'heal') {
          const max = heroStats(s, buyer).maxHp;
          if (buyer.hp >= max) return toast('Already at full health.', 'info');
          buyer.hp = Math.min(max, buyer.hp + 10);
        } else if (e.kind === 'charmHp') {
          buyer.charmHp++;
          buyer.hp += 4;
        } else buyer.charmDmg++;
        buyer.gold -= e.price;
        if (e.kind !== 'heal') r.flags.push(`shop:${index}:${e.key}`);
        audio.sfx('buy');
        redraw();
      },
      leave: () => {
        sel = null;
        closeScreen();
        onLeave();
      },
    },
  );
}

export function summaryScreen(sum: RunSummary, mapName: string, onDone: () => void): void {
  const rows = sum.rows
    .map((row) => `<div class="uprow">${heroIco(row.color)}<div class="grow"><b style="color:${HERO_COLORS[row.color]}">${esc(row.name)}</b><br><span class="muted small">${row.gold} gold carried + ${row.bonus} bonus</span></div><b>${ico(IC.Renown, 'sm')}+${row.total}</b></div>`)
    .join('');
  const unlocks = sum.unlockedItems.length ? `<p class="good">New items join the pool: ${sum.unlockedItems.map((id) => esc(ITEMS[id].name)).join(', ')}</p>` : '';
  show(
    'summary',
    `<div class="screen dim ${sum.won ? 'gold' : 'red'}"><div class="panel mid">
      <h2>${sum.won ? `${esc(mapName)} is cleared!` : 'The run is over'}</h2>
      <p class="muted">${sum.won ? 'The Bandit Chief is beaten. The next map is unlocked (it will be playable once it is built).' : 'The party is out of lives. What you earned comes home with you: spend it at camp and go further next time.'}</p>
      <p class="small">Reached campfire ${sum.checkpoint} · ${sum.kills} monsters defeated · ${sum.secrets} secrets found</p>
      ${rows}${unlocks}
      <button class="btn big" data-act="done" data-default>Back to camp</button></div></div>`,
    { done: onDone },
  );
}
