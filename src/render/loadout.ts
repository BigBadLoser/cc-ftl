import type { Atlas, LayerSprite } from './assets/loader';
import { hash } from './assets/palette';
import type { Crew } from '../sim/crew/components';

/**
 * Which sprite layers a crew member wears, from sim data (species, role, appearance seed).
 * Ids that the manifest lacks are skipped, so partial asset sets still render.
 */
export function crewLoadout(atlas: Atlas, crew: Crew): LayerSprite[] {
  const own = crew.species.replace(/^species\./, '');
  // Robots wear a single body layer per type (worker, repair, security), built from the role id.
  const bot = atlas.layer(`crew.${own}.body.${crew.role.replace(/^role\.robot_/, '')}`);
  if (bot && bot.def.species === own) return [bot];
  // Species without art yet borrow the human layers as a placeholder until their sheets exist.
  const sp = atlas.layer(`crew.${own}.body`) ? own : 'human';
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
  if (activity === 'charging') return 'charge';
  if (activity === 'walking' || moving) return 'walk';
  return activity === 'working' ? 'work' : 'idle';
}
