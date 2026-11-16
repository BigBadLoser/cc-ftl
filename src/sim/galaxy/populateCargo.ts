import { spawnDriftingContainer } from '../containers/detach';
import { rotatedSize } from '../modules/footprint';
import type { Place } from '../regions';
import type { Sim } from '../sim';
import { rollCargo } from './cargoLoot';
import { hash32, unit } from './hash';
import { growSector } from './populateSpawn';
import type { NodeData } from './types';

/**
 * Lost cargo (`structure.lost_cargo`): one or two sealed containers adrift in the node with no ship, each with a small hashed drift and tumble. They are the
 * same container bodies a wreck's torn-off boxes are (`spawnDriftingContainer`); the drift system eases them to rest a few tiles from where they start.
 */

/** Container defs a lost load can be, with their shares. */
const BOXES: readonly { def: string; share: number }[] = [{ def: 'container.2x4', share: 0.65 }, { def: 'container.3x6', share: 0.35 }];
/** Chance of a second container, and the tiles between the two. */
const PAIR_CHANCE = 0.35;
const PAIR_GAP = [9, 16] as const;
const SPEED = [0.05, 0.2] as const;
const SPIN = 0.12;
const HP = [0.55, 1] as const;

/** Make the node's lost cargo at the place the layout gives. Returns whether anything was made. */
export function populateCargo(sim: Sim, node: NodeData, seed: number, at: Place): boolean {
  const n = unit(seed, 211) < PAIR_CHANCE ? 2 : 1;
  const first = typeof at === 'function' ? at(8, 8) : at;
  let made = 0;
  for (let k = 0; k < n; k++) {
    const s = hash32(seed, k, 212);
    const u = unit(s, 1);
    const box = BOXES.find((_, i) => u < BOXES.slice(0, i + 1).reduce((t, x) => t + x.share, 0)) ?? (BOXES[0] as (typeof BOXES)[number]);
    const def = sim.content.modules[box.def];
    if (!def?.container) continue;
    const rot = unit(s, 2) < 0.5 ? 0 : 1;
    const [w, h] = rotatedSize(def, rot);
    const a = unit(s, 3) * Math.PI * 2;
    const speed = SPEED[0] + unit(s, 4) * (SPEED[1] - SPEED[0]);
    // The second box lies off to one side of the first, a clear gap between them.
    const gap = k === 0 ? 0 : PAIR_GAP[0] + unit(s, 5) * (PAIR_GAP[1] - PAIR_GAP[0]);
    const ga = (unit(s, 6) - 0.5) * 1.6;
    const x = first.x + w / 2 + Math.cos(ga) * gap;
    const y = first.y + h / 2 + Math.sin(ga) * gap;
    growSector(sim, Math.floor(x), Math.floor(y), w + 6, h + 6);
    spawnDriftingContainer(sim, {
      def: box.def, rot, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, spin: (unit(s, 7) - 0.5) * 2 * SPIN,
      hp: HP[0] + unit(s, 8) * (HP[1] - HP[0]), ship: 0, stock: rollCargo(sim, s, node.danger, def.storage?.capacity ?? 0),
    });
    made++;
  }
  return made > 0;
}
