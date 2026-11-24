export interface UpgradeDef {
  id: string;
  name: string;
  desc: string;
  costs: number[]; // renown per level
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'vit', name: 'Vitality', desc: '+4 max HP', costs: [25, 45, 70, 100, 140] },
  { id: 'might', name: 'Might', desc: '+15% damage', costs: [30, 50, 80, 115, 160] },
  { id: 'swift', name: 'Swiftness', desc: '+5% move speed', costs: [30, 60, 100] },
  { id: 'eyes', name: 'Keen Eyes', desc: '+1 light radius', costs: [20, 40, 70] },
  { id: 'fortune', name: 'Fortune', desc: '+15% gold found', costs: [25, 50, 90] },
  { id: 'wind', name: 'Second Wind', desc: '+1 party life each run', costs: [60, 140] },
];
