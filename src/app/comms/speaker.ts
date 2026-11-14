import { crewNames } from '../../content/names';
import { Rng } from '../../sim/rng';
import type { SceneShip } from '../../sim/scene/types';
import type { UiLook } from '../../ui/api';

/**
 * The adapter from a scene ship to the person on its comm: a name, a second name (for a tell), a look for the portrait renderer (`api.lookPortrait`)
 * and the ship's transponder ID with a second ID. All of it is seeded from the contact's seed, so the same signal always shows the same face; nothing
 * here reads or changes the sim.
 */
export interface Speaker {
  name: string;
  altName: string;
  look: UiLook;
  /** The ship's ID tag (the generator's `SC-4471`), and a second one for a transponder that is not telling the truth. */
  tag: string;
  altTag: string;
}

/** Faction kind to the role kits its crews wear (the kit is the outfit; a pirate has the headset harness). */
const KITS: Record<string, readonly string[]> = {
  pirates: ['role.gunner'], civilian: ['role.engineer', 'role.pilot'], government: ['role.pilot', 'role.security'], corporation: ['role.engineer', 'role.pilot'],
};

export function speakerOf(s: { contact: Pick<SceneShip['contact'], 'seed'> }, shipName: string | undefined, factionKind: string | undefined): Speaker {
  const rng = new Rng((s.contact.seed ^ 0x5bd1e995) >>> 0);
  const name = rng.pick(crewNames);
  const rest = crewNames.filter((n) => n !== name);
  const altName = rng.pick(rest);
  const kits = KITS[factionKind ?? ''] ?? ['role.engineer'];
  const look: UiLook = { species: 'species.human', role: rng.pick(kits), appearanceSeed: rng.int(1, 997) };
  const tag = /([A-Z]{2}-[0-9A-F]{4})$/.exec(shipName ?? '')?.[1] ?? '';
  const prefix = tag.slice(0, 3);
  const altTag = tag ? `${prefix}${rng.int(0, 0xffff).toString(16).toUpperCase().padStart(4, '0')}` : '';
  return { name, altName, look, tag, altTag: altTag === tag ? `${prefix}0000` : altTag };
}
