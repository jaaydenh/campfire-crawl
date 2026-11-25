// Shared live state. Kept free of imports from the scene and UI so both can depend on it.
import type { SheetKey } from './art/manifest';
import type { RunHero, RunState, SaveFile } from './types';

export interface Hooks {
  toast(msg: string, kind?: 'good' | 'bad' | 'info'): void;
  dialog(name: string, lines: string[]): void;
  onCheckpoint(index: number): void;
  onHeroDeath(x: number, y: number): void; // where the hero fell, in world pixels
  onBossDefeated(): void;
  onBossPhase(phase: number): void;
  frame(): void; // HUD refresh, once per rendered frame
}

const noop = () => {};

export const G = {
  slot: 0,
  save: null as SaveFile | null,
  art: {} as Record<SheetKey, HTMLCanvasElement>,
  artUrl: {} as Record<SheetKey, string>,
  hooks: { toast: noop, dialog: noop, onCheckpoint: noop, onHeroDeath: noop, onBossDefeated: noop, onBossPhase: noop, frame: noop } as Hooks,
};

export const run = (): RunState => G.save!.run!;
export const activeHero = (): RunHero => run().heroes[run().active];
export const profileOf = (rh: RunHero) => G.save!.heroes[rh.profile];
