import type { Texture } from 'pixi.js';
import type { Atlas, LayerSprite } from './assets/loader';
import { hash } from './assets/palette';
import type { ClipDef, LayerAsset } from './assets/manifest';
import type { Crew } from '../sim/crew/components';

/** What a crew figure's look depends on: species, role (the kit) and the appearance seed (hair, colours). */
export type CrewLook = Pick<Crew, 'species' | 'role' | 'appearanceSeed'>;
import type { HandWeaponArt } from '../sim';
import { FAMILY, weaponLayerIds } from './handWeapon';

/** Role gear: the top a role wears instead of the tee, eye and left-arm variants, and the gear on top. `hat`: the kit
 * has head gear that tall hair (mohawk, bun) would poke through, so those are left out of the hair pick. */
interface Kit { torso: string; gear: string[]; eyes?: string; armL?: string; hat?: boolean; bald?: boolean }
const KITS: Record<string, Kit> = {
  'role.engineer': {
    torso: 'work_shirt', eyes: 'cyber', armL: 'cyber',
    gear: ['gear.belt.tool_belt', 'gear.back.engineer_rig', 'gear.head.welding_goggles'],
  },
  'role.medic': { torso: 'medic_vest', gear: ['gear.back.medkit'] },
  'role.security': { torso: 'armor_vest', gear: ['gear.shoulder.pads', 'gear.head.tactical_helmet'], hat: true },
  // Full armour (no role wears it yet): the heavy helmet covers all the hair, like the EVA helmet.
  'role.marine': { torso: 'armor_heavy', gear: ['gear.shoulder.pads', 'gear.head.heavy_helmet'], hat: true, bald: true },
  'role.gunner': { torso: 'harness', gear: ['gear.head.headset'] },
  'role.pilot': { torso: 'flight_vest', gear: ['gear.head.visor_cap'], hat: true },
};
const TALL_HAIR = ['hair.mohawk', 'hair.bun'];

/**
 * Which sprite layers a crew member wears, from sim data (species, role, appearance seed).
 * Ids that the manifest lacks are skipped, so partial asset sets still render. A suited crew member wears the EVA suit
 * layers (torso, legs, both arms, helmet, pack) instead of their clothes, gear, hair and eyes (the helmet covers them).
 * `weapon`: the art of the equipped hand weapon: both its holster and held layers are worn, and the view draws one of
 * them per clip (see handWeapon.layerShown). Robots and species without the weapon layers wear none.
 */
export function crewLoadout(atlas: Atlas, crew: CrewLook, suited = false, weapon?: HandWeaponArt): LayerSprite[] {
  const own = crew.species.replace(/^species\./, '');
  const single = singleBody(atlas, crew);
  if (single) return [single];
  // Species without art yet borrow the human layers as a placeholder until their sheets exist.
  const sp = atlas.layer(`crew.${own}.body`) ? own : 'human';
  const p = `crew.${sp}.`;
  const kit = KITS[crew.role];
  const hair = kit?.bald ? [] : atlas.ids(`${p}hair.`).filter((id) => !kit?.hat || !TALL_HAIR.some((t) => id === p + t));
  const ids = suited ? suitIds(p, crew.role === 'role.engineer') : [
    `${p}body`,
    `${p}eyes.${kit?.eyes ?? 'organic'}`,
    hair.length ? (hair[hash(crew.appearanceSeed, 10) % hair.length] as string) : '',
    `${p}arm.L.${kit?.armL ?? 'flesh'}`,
    `${p}arm.R.flesh`,
    `${p}torso.${kit?.torso ?? 'tee'}`,
    `${p}legs.cargo_pants`,
    ...(kit?.gear ?? []).map((g) => p + g),
    ...weaponLayerIds(p, weapon),
  ];
  const out: LayerSprite[] = [];
  for (const id of ids) {
    const l = id ? atlas.layer(id) : undefined;
    if (l && l.def.species === sp) out.push(l);
  }
  return out.sort((a, b) => a.def.order - b.def.order);
}

/**
 * The one layer of a crew member drawn as a single sprite, or undefined for a human-style layered figure. Robots wear a
 * layer per type (worker, repair, security), built from the role id; creatures of one art species with several bodies
 * (`species.alien_hunter` wears `crew.alien.body.hunter`). These carry no gear, so no weapon is drawn on them.
 */
export function singleBody(atlas: Atlas, crew: CrewLook): LayerSprite | undefined {
  const own = crew.species.replace(/^species\./, '');
  const bot = atlas.layer(`crew.${own}.body.${crew.role.replace(/^role\.robot_/, '')}`);
  if (bot && bot.def.species === own) return bot;
  const [kin, kind] = own.split('_');
  const body = kind ? atlas.layer(`crew.${kin}.body.${kind}`) : undefined;
  return body && body.def.species === kin ? body : undefined;
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
 * - `sit_work`: the layer's sit_idle;
 * - `walk`: `run` (creature sheets), then idle.
 */
const CLIP_FALLBACK: Readonly<Record<string, readonly string[]>> = {
  // Creatures run where crew walk (the alien sheets have `run`, no `walk`).
  walk: ['run', 'idle'],
  sit_idle: [],
  sit_work: ['sit_idle'],
  ...weaponFallbacks(),
};

/**
 * Weapon and cover clips: a layer without the combat pose shows its nearest plainer one (aim -> idle, fire -> aim, swing ->
 * ready, walking with a weapon -> walk). Crouch clips fall to crouch_idle, then idle; leans to idle. The held weapon layers
 * have none of the plain clips, so they are hidden then (and layerShown hides them outside combat clips anyway).
 */
function weaponFallbacks(): Record<string, readonly string[]> {
  const out: Record<string, readonly string[]> = { crouch_walk: ['crouch_idle', 'idle'], crouch_idle: ['idle'] };
  for (const f of Object.values(FAMILY)) {
    out[f.aim] = ['idle'];
    out[f.fire] = [f.aim, 'idle'];
    if (f.walk) out[f.walk] = ['walk', 'idle'];
    if (f.crouchAim) out[f.crouchAim] = ['crouch_idle', 'idle'];
    if (f.crouchFire) out[f.crouchFire] = [f.crouchAim ?? 'crouch_idle', 'crouch_idle', 'idle'];
  }
  for (const c of ['lean_l_1h', 'lean_r_1h', 'lean_l_2h', 'lean_r_2h']) out[c] = ['idle'];
  return out;
}

/** The clip a layer plays for a requested clip name, or undefined if the layer is not drawn for it. */
export function resolveClip(def: LayerAsset, clip: string): ClipDef | undefined {
  for (const name of [clip, ...(CLIP_FALLBACK[clip] ?? ['idle'])]) {
    const c = def.clips[name];
    if (c) return c;
  }
  return undefined;
}

/**
 * Clips queued when a figure appears. Idle is wanted at once (it is what the figure is drawn in, and the stand-in for every
 * other clip), so it queues as urgent; the others (walk, run, work) are preloads in the lowest tier: they load once
 * everything being drawn is in, so they are there before they are needed, and a clip still loading draws as the idle.
 */
export const PRELOAD_CLIPS: readonly string[] = ['idle', 'walk', 'run', 'work'];

/** Queue the common clips of each layer (a layer without a clip is skipped). */
export function preloadLayers(layers: readonly LayerSprite[]): void {
  // Clip by clip across all layers (not layer by layer): the whole figure gets its idle first, then its walk, so a
  // layer is never the last of the stack to have any sheet while the body already walks.
  for (const name of PRELOAD_CLIPS) for (const l of layers) if (l.def.clips[name]) l.request(l.def.clips[name] as ClipDef, name === 'idle');
}

/** Column in the clip's sheet at time t (seconds into the clip). */
export function colOf(c: ClipDef, t: number): number {
  const f = Math.floor(t * c.fps);
  return c.start + (c.loop ? f % c.frames : Math.min(c.frames - 1, f));
}

export interface Drawn {
  tex: Texture;
  clip: ClipDef;
  col: number;
}

/**
 * The frame to draw for a layer: the requested clip's (see resolveClip), or, while that clip's sheet is still loading,
 * the layer's idle, then walk, then any other clip of it that is loaded, so a layer never vanishes while some sheet of
 * it exists. Undefined if the layer is not drawn for the clip, or has no sheet loaded at all yet. Only the requested
 * clip's sheet is queued (urgently); the stand-ins are used only if already loaded.
 */
export function pickFrame(layer: LayerSprite, clip: string, dir: number, t: number): Drawn | undefined {
  const want = resolveClip(layer.def, clip);
  if (!want) return undefined;
  const first = layer.frame(want, dir, colOf(want, t));
  if (first) return { tex: first, clip: want, col: colOf(want, t) };
  const rest = [layer.def.clips.idle, layer.def.clips.walk, ...Object.values(layer.def.clips)];
  for (const c of rest) {
    if (!c || !layer.loaded(c)) continue;
    const col = colOf(c, t);
    const tex = layer.frame(c, dir, col);
    if (tex) return { tex, clip: c, col };
  }
  return undefined;
}
