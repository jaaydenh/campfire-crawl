// The contract between the audio module and the rest of the game.

export type SfxName =
  | 'ui' // menu move / click blip
  | 'deny' // action not allowed
  | 'buy' // purchase
  | 'punch' // fist swing
  | 'swing' // weapon swing
  | 'shoot' // bow / knife release
  | 'fire' // fire bolt cast
  | 'frost' // frost nova
  | 'explode' // bomb
  | 'dash' // dash boots
  | 'block' // shield blocks a hit
  | 'hit' // hero hits a monster
  | 'monsterDie'
  | 'hurt' // hero takes damage
  | 'death' // hero dies
  | 'pickup' // item picked up
  | 'coin'
  | 'heart'
  | 'key'
  | 'door' // door or gate opens
  | 'lever'
  | 'plate' // pressure plate clicks
  | 'push' // block scrapes
  | 'chest'
  | 'torch' // brazier lights
  | 'wrong' // puzzle mistake
  | 'solved' // puzzle solved jingle
  | 'secret' // secret found jingle
  | 'checkpoint' // campfire lit fanfare
  | 'life' // extra life gained
  | 'bossRoar'
  | 'phase' // boss phase broken
  | 'victory' // map complete fanfare
  | 'gameover' // run failed
  | 'turn' // next player's turn
  | 'splash' // something heavy hits the water
  | 'poison' // a hiss of gas: the hero is poisoned
  | 'zap' // a wisp's spark
  | 'crumble' // a floor starts to give way
  | 'valve'; // water rushing after a sluice wheel turns

export type MusicTrack = 'hub' | 'forest' | 'cave' | 'swamp' | 'temple' | 'boss';

export interface AudioApi {
  /** Create/resume the AudioContext. Safe to call repeatedly; must be called from a user gesture at least once. */
  unlock(): void;
  sfx(name: SfxName): void;
  /** Switch looping music (cross-fades briefly). null stops music. Calling with the current track is a no-op. */
  music(track: MusicTrack | null): void;
  /** Volumes 0..1. */
  setVolumes(music: number, sfx: number): void;
  getVolumes(): { music: number; sfx: number };
}
