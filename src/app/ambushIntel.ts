import type { Sim } from '../sim';
import type { SceneShip } from '../sim/scene/types';
import type { SkillName } from '../sim/registry';
import { bestAt } from '../sim/story/world';

/**
 * What a scan of the pirate ambush's skiff reads (DESIGN.md "Pirate ambush"). Sensors catch its weapons, its boarding craft and its crew; how much
 * they make of it is the crew's skill: gunnery reads the guns, piloting the craft, hacking the crew and the transponder. A dull read says only what any
 * pirate skiff shows; a sharp one tells a trap from an honest skiff. The read is true to the spec (the same facts the scene opens with).
 */
const level = (sim: Sim, skill: SkillName): number => bestAt(sim, skill)?.level ?? 0;

/** The tell a scan can catch: a hacker (level 4) sees the transponder ID change. The video's stutter (`lag`) needs no skill: it shows on the hail. */
export function scanSeesNameTell(sim: Sim, s: SceneShip): boolean {
  return !!s.ambush?.trap && s.ambush.tell === 'name' && level(sim, 'hacking') >= 4;
}

export function ambushRows(sim: Sim, s: SceneShip, owner: string): { label: string; value: string }[] {
  const a = s.ambush;
  if (!a) return [];
  const gunnery = level(sim, 'gunnery');
  const piloting = level(sim, 'piloting');
  const hacking = level(sim, 'hacking');
  return [
    { label: 'Transponder', value: owner },
    { label: 'Hull', value: s.family ? `${s.family[0]?.toUpperCase()}${s.family.slice(1)} class` : 'Unknown' },
    { label: 'Weapons', value: gunnery < 2 ? 'Armed, as any pirate' : a.trap ? 'Guns powered and charged' : 'Guns cold' },
    { label: 'Boarding craft', value: piloting < 2 ? 'A shuttle bay' : a.trap ? 'Shuttle fuelled, suited crew in the bay' : 'Shuttle bay, cold' },
    { label: 'Crew aboard', value: hacking < 2 ? 'Unclear' : s.crew === undefined ? 'Unclear' : String(s.crew) },
  ];
}
