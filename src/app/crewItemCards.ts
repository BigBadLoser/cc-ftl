import { hitChance, stat, suitAir, suitDef, type HandWeaponDef, type Sim } from '../sim';
import type { UiItemCard } from '../ui/crewDetailApi';

const pct = (v: number): string => `${Math.round(v * 100)}%`;

/**
 * The stats card of a hand weapon in this crew member's hands: damage, range, fire rate, the accuracy they would get with
 * it (base plus their skill, at point blank without cover), the damage per second that makes, and its value. Fields the
 * sim has no data for (ammo, weight) are left out.
 */
export function weaponCard(sim: Sim, crew: number, name: string, def: HandWeaponDef, price?: number): UiItemCard {
  const skill = def.kind === 'ranged' ? 'gunnery' : 'melee';
  const level = Math.round(stat(sim, crew, skill));
  const acc = hitChance(sim, crew, def, 0, 'none');
  const bonus = Math.round((acc - def.accuracy) * 100);
  const hands = def.art?.family === '2h' ? ' · 2 hands' : def.art?.family === '1h' ? ' · 1 hand' : '';
  const rows: UiItemCard['rows'] = [
    { label: 'Damage', value: `${def.damage}`, note: 'per hit' },
    { label: 'Range', value: def.kind === 'ranged' ? `${def.range} tiles` : 'adjacent' },
    { label: 'Fire rate', value: `every ${def.cooldownSec} s` },
    { label: 'Accuracy', value: pct(acc), note: `${pct(def.accuracy)} base`, extra: bonus ? { text: `${bonus > 0 ? '+' : '−'}${Math.abs(bonus)}% ${skill[0]!.toUpperCase()}${skill.slice(1)} ${level}`, good: bonus > 0 } : undefined },
    { label: 'Damage / s', value: `≈ ${((def.damage * acc) / def.cooldownSec).toFixed(1)}`, note: 'at this accuracy' },
  ];
  if (def.ion) rows.push({ label: 'Ion', value: 'stuns robots' });
  if (def.knockdownChance) rows.push({ label: 'Knockdown', value: pct(def.knockdownChance), note: `for ${def.knockdownSec ?? 0} s` });
  return { title: name, sub: `${def.kind === 'ranged' ? 'Ranged' : 'Melee'}${hands}`, rows, foot: price ? [{ label: 'Value', value: `${price} cr` }] : [] };
}

/** The card of the EVA suit being worn. */
export function suitCard(sim: Sim, crew: number): UiItemCard {
  const s = suitDef(sim);
  return {
    title: 'EVA suit', sub: 'Worn',
    rows: [
      { label: 'Air', value: `${Math.round(suitAir(sim, crew))} s`, note: `of ${s.airSec} s` },
      { label: 'Move speed', value: `x${s.moveMult}` }, { label: 'Work speed', value: `x${s.workMult}` }, { label: 'Aim', value: `x${s.accuracyMult}` },
    ],
    foot: [],
  };
}

/** The card of a hauled stack: what it is, how many against the carry capacity, its value. */
export function carriedCard(sim: Sim, crew: number, item: string, count: number): UiItemCard {
  const def = sim.content.items[item];
  const cap = Math.round(stat(sim, crew, 'carryCapacity'));
  return {
    title: def?.name ?? item, sub: 'Carried',
    rows: [{ label: 'Count', value: `${count}`, note: `of ${cap} carry` }],
    foot: def?.price ? [{ label: 'Value', value: `${def.price} cr each` }] : [],
  };
}
