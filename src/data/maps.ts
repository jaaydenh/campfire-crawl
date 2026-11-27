import type { MapDef } from '../world/mapdef';
import { buildMap1 } from './map1';
import { tierDef } from './tiers';

export interface MapInfo {
  id: string;
  number: number;
  name: string;
  blurb: string;
  build?: (tier: number) => MapDef; // undefined until the map is made
}

export const MAPS: MapInfo[] = [
  { id: 'map1', number: 1, name: 'Whispering Woods', blurb: 'Forest into the bandit cave', build: buildMap1 },
  { id: 'map2', number: 2, name: 'The Drowned Mire', blurb: 'Swamp into the sunken temple' },
  { id: 'map3', number: 3, name: 'Hollow Graves', blurb: 'Graveyard into the crypt' },
  { id: 'map4', number: 4, name: 'Stormwatch Pass', blurb: 'Mountain pass into the fortress' },
  { id: 'map5', number: 5, name: 'The Scoured Waste', blurb: 'Desert into the tomb' },
  { id: 'map6', number: 6, name: 'Frostfall', blurb: 'Snowfield into the ice cavern' },
  { id: 'map7', number: 7, name: 'Cinderpeak', blurb: 'Volcano into the forge' },
  { id: 'map8', number: 8, name: 'The Cursed City', blurb: "City into the dark lord's castle" },
];

const cache = new Map<string, MapDef>();
/**
 * A map as it is on a difficulty tier. The layout, puzzles and shared monsters are the same on every tier;
 * the secrets, their prizes and the items a first clear unlocks belong to the tier.
 */
export function getMap(id: string, tier: number | undefined = 1): MapDef {
  const t = tierDef(tier).tier;
  let m = cache.get(`${id}:${t}`);
  if (!m) {
    const info = MAPS.find((x) => x.id === id);
    if (!info?.build) throw new Error(`Map ${id} is not available`);
    m = info.build(t);
    cache.set(`${id}:${t}`, m);
  }
  return m;
}
