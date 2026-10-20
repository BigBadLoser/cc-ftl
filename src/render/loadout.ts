import type { Atlas, LayerSprite } from './assets/loader';
import { hash } from './assets/palette';
import type { ClipDef, LayerAsset } from './assets/manifest';
import type { Crew } from '../sim/crew/components';

/** Role gear: the top a role wears instead of the tee, eye and left-arm variants, and the gear on top. `hat`: the kit
 * has head gear that tall hair (mohawk, bun) would poke through, so those are left out of the hair pick. */
interface Kit { torso: string; gear: string[]; eyes?: string; armL?: string; hat?: boolean }
const KITS: Record<string, Kit> = {
  'role.engineer': {
    torso: 'work_shirt', eyes: 'cyber', armL: 'cyber',
    gear: ['gear.belt.tool_belt', 'gear.back.engineer_rig', 'gear.head.welding_goggles'],
  },
  'role.medic': { torso: 'medic_vest', gear: ['gear.back.medkit'] },
  'role.security': { torso: 'armor_vest', gear: ['gear.head.tactical_helmet'], hat: true },
  'role.gunner': { torso: 'harness', gear: ['gear.head.headset'] },
  'role.pilot': { torso: 'flight_vest', gear: ['gear.head.visor_cap'], hat: true },
};
const TALL_HAIR = ['hair.mohawk', 'hair.bun'];

/**
 * Which sprite layers a crew member wears, from sim data (species, role, appearance seed).
 * Ids that the manifest lacks are skipped, so partial asset sets still render. A suited crew member wears the EVA suit
 * layers (torso, legs, both arms, helmet, pack) instead of their clothes, gear, hair and eyes (the helmet covers them).
 */
export function crewLoadout(atlas: Atlas, crew: Crew, suited = false): LayerSprite[] {
  const own = crew.species.replace(/^species\./, '');
  // Robots wear a single body layer per type (worker, repair, security), built from the role id.
  const bot = atlas.layer(`crew.${own}.body.${crew.role.replace(/^role\.robot_/, '')}`);
  if (bot && bot.def.species === own) return [bot];
  // Species without art yet borrow the human layers as a placeholder until their sheets exist.
  const sp = atlas.layer(`crew.${own}.body`) ? own : 'human';
  const p = `crew.${sp}.`;
  const kit = KITS[crew.role];
  const hair = atlas.ids(`${p}hair.`).filter((id) => !kit?.hat || !TALL_HAIR.some((t) => id === p + t));
  const ids = suited ? suitIds(p, crew.role === 'role.engineer') : [
    `${p}body`,
    `${p}eyes.${kit?.eyes ?? 'organic'}`,
    hair.length ? (hair[hash(crew.appearanceSeed, 10) % hair.length] as string) : '',
    `${p}arm.L.${kit?.armL ?? 'flesh'}`,
    `${p}arm.R.flesh`,
    `${p}torso.${kit?.torso ?? 'tee'}`,
    `${p}legs.cargo_pants`,
    ...(kit?.gear ?? []).map((g) => p + g),
  ];
  const out: LayerSprite[] = [];
  for (const id of ids) {
    const l = id ? atlas.layer(id) : undefined;
    if (l && l.def.species === sp) out.push(l);
  }
  return out.sort((a, b) => a.def.order - b.def.order);
}

/** The layers of a suited human: the body and the suit (the engineer keeps the cyber arm, in its sleeve). */
function suitIds(p: string, engineer: boolean): string[] {
  return [
    `${p}body`, `${p}arm.L.${engineer ? 'eva_cyber' : 'eva'}`, `${p}arm.R.eva`, `${p}torso.eva`, `${p}legs.eva`,
    `${p}gear.head.eva_helmet`, `${p}gear.back.eva_pack`,
  ];
}

/** Clip name for a sim activity. `floating`: crossing open space on the pack's thrusters. */
export function clipFor(activity: string, moving: boolean, floating = false): string {
  if (floating) return 'eva_float';
  if (activity === 'sleeping') return 'sleep';
  if (activity === 'charging') return 'charge';
  if (activity === 'walking' || moving) return 'walk';
  return activity === 'working' ? 'work' : 'idle';
}

/**
 * Clips to try, after the requested one, when a layer has no sheet for it. A layer lacking a clip is normal (sheets are
 * per item and clip, and new clips are added without re-rendering old items), so every clip has a rule:
 * - default: the layer's idle frames (never a hole in the body; right for eva_float, charge, wreck... on a layer that
 *   does not need to move differently);
 * - `sit_idle`: nothing, so the layer is hidden. Seated poses are fitted to the chair; a standing pose would clip through
 *   it. The engineer rig and EVA pack have no sit sheets for exactly this reason;
 * - `sit_work`: the layer's sit_idle.
 */
const CLIP_FALLBACK: Readonly<Record<string, readonly string[]>> = {
  sit_idle: [],
  sit_work: ['sit_idle'],
};

/** The clip a layer plays for a requested clip name, or undefined if the layer is not drawn for it. */
export function resolveClip(def: LayerAsset, clip: string): ClipDef | undefined {
  for (const name of [clip, ...(CLIP_FALLBACK[clip] ?? ['idle'])]) {
    const c = def.clips[name];
    if (c) return c;
  }
  return undefined;
}
