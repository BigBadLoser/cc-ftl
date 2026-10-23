import type { HandWeaponArt, ItemDef } from '../sim';
import type { World } from '../sim/ecs';
import { CrewC, PositionC } from '../sim/crew/components';
import { EquipC } from '../sim/fight/components';
import type { Atlas } from './assets/loader';
import { FAMILY, muzzleAt } from './handWeapon';
import { singleBody } from './loadout';

/** The art of the weapon a crew member holds in `items`' terms, if one is drawn on them (robots and creatures carry none). */
export function drawnWeapon(world: World, atlas: Atlas, items: Readonly<Record<string, ItemDef>>, id: number): HandWeaponArt | undefined {
  const crew = world.get(id, CrewC);
  const item = world.get(id, EquipC)?.weapon;
  const art = item ? items[item]?.hand?.art : undefined;
  return crew && art && !singleBody(atlas, crew) ? art : undefined;
}

/**
 * Where a shot leaves a crew member's weapon: art px from their feet (the sprite anchor), for the direction they face.
 * Ranged: the muzzle in the first frame of the fire clip. Melee (`strike`): the tip at the middle of the swing. Null when
 * no weapon is drawn on them, or its sheet lacks the point (the fx then use the crew's centre).
 */
export function crewMuzzle(world: World, atlas: Atlas, items: Readonly<Record<string, ItemDef>>, id: number): { x: number; y: number } | null {
  const art = drawnWeapon(world, atlas, items, id);
  const pos = world.get(id, PositionC);
  if (!art || !pos) return null;
  const clip = atlas.layer(`crew.human.gear.hand.${art.id}`)?.def.clips[FAMILY[art.family].fire];
  const melee = art.family === '1m' || art.family === '2m';
  return muzzleAt(clip, pos.facing, melee ? 2 : 0);
}
