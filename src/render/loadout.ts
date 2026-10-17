import type { Atlas, LayerSprite } from './assets/loader';
import { hash } from './assets/palette';
import type { Crew } from '../sim/crew/components';

/**
 * Which sprite layers a crew member wears, from sim data (species, role, appearance seed).
 * Ids that the manifest lacks are skipped, so partial asset sets still render.
 */
export function crewLoadout(atlas: Atlas, crew: Crew): LayerSprite[] {
  const sp = crew.species.replace(/^species\./, '');
  const p = `crew.${sp}.`;
  const engineer = crew.role === 'role.engineer';
  const hair = atlas.ids(`${p}hair.`);
  const ids = [
    `${p}body`,
    `${p}eyes.${engineer ? 'cyber' : 'organic'}`,
    hair.length ? (hair[hash(crew.appearanceSeed, 10) % hair.length] as string) : '',
    `${p}arm.L.${engineer ? 'cyber' : 'flesh'}`,
    `${p}arm.R.flesh`,
    `${p}torso.${engineer ? 'work_shirt' : 'tee'}`,
    `${p}legs.cargo_pants`,
    ...(engineer ? [`${p}gear.belt.tool_belt`, `${p}gear.back.engineer_rig`, `${p}gear.head.welding_goggles`] : []),
  ];
  const out: LayerSprite[] = [];
  for (const id of ids) {
    const l = id ? atlas.layer(id) : undefined;
    if (l && l.def.species === sp) out.push(l);
  }
  return out.sort((a, b) => a.def.order - b.def.order);
}

/** Clip name for a sim activity. */
export function clipFor(activity: string, moving: boolean): string {
  if (activity === 'sleeping') return 'sleep';
  if (activity === 'walking' || moving) return 'walk';
  return activity === 'working' ? 'work' : 'idle';
}
