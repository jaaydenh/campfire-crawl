// Keyboard and mouse state for the game world. Menus handle their own clicks.
import { VIEW_H, VIEW_W, type ControlMode } from './types';

export const input = {
  down: new Set<string>(),
  pressed: new Set<string>(), // went down since the last frame
  mx: VIEW_W / 2, // mouse position in game pixels
  my: VIEW_H / 2,
  buttons: [false, false, false],
  clicked: [false, false, false],
  endFrame() {
    this.pressed.clear();
    this.clicked = [false, false, false];
  },
  reset() {
    this.down.clear();
    this.pressed.clear();
    this.buttons = [false, false, false];
    this.clicked = [false, false, false];
  },
};

/** What each control style calls the three ability inputs, for the HUD and the menus. */
export const SLOT_KEYS: Record<ControlMode, string[]> = { mouse: ['L-click', 'R-click', 'Space'], facing: ['J', 'K', 'Space'] };

/** True while the input for an active slot is held. The mouse buttons work in both styles; J and K only when facing. */
export function slotHeld(i: number, mode: ControlMode): boolean {
  if (i === 2) return input.down.has('Space');
  return input.buttons[i === 0 ? 0 : 2] || (mode === 'facing' && input.down.has(i === 0 ? 'KeyJ' : 'KeyK'));
}

/** Movement keys as a direction: each axis is -1, 0 or 1. */
export function moveKeys(): { x: number; y: number } {
  const d = input.down;
  return {
    x: (d.has('KeyD') || d.has('ArrowRight') ? 1 : 0) - (d.has('KeyA') || d.has('ArrowLeft') ? 1 : 0),
    y: (d.has('KeyS') || d.has('ArrowDown') ? 1 : 0) - (d.has('KeyW') || d.has('ArrowUp') ? 1 : 0),
  };
}

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'Tab', 'KeyI', 'KeyM', 'Escape']);

export function initInput(gameEl: HTMLElement): void {
  window.addEventListener('keydown', (e) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.down.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.down.delete(e.code));
  window.addEventListener('blur', () => input.reset());
  window.addEventListener('mousemove', (e) => {
    const r = gameEl.getBoundingClientRect();
    input.mx = ((e.clientX - r.left) / r.width) * VIEW_W;
    input.my = ((e.clientY - r.top) / r.height) * VIEW_H;
  });
  gameEl.addEventListener('mousedown', (e) => {
    if (e.button > 2) return;
    input.buttons[e.button] = true;
    input.clicked[e.button] = true;
    e.preventDefault();
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button <= 2) input.buttons[e.button] = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}
