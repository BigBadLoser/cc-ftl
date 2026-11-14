import { PrisonerC, type Sim } from '../sim';
import { sealMarked, sealRefusal, sealWait } from '../sim/stasis/order';

const REASONS: Record<string, string> = {
  frozen: 'Already sealed in stasis',
  notYours: 'Not aboard one of your ships',
  noWheel: 'No stasis wheel with room that can be reached, here or on a ship of yours a shuttle can carry the slab to',
  noShuttle: 'No shuttle to carry the slab to a stasis wheel',
  notPrisoner: 'Not a prisoner',
};

/** What a marked prisoner waits on (`sealWait`), as the hint under the button. */
const WAITS: Record<string, string> = {
  noShuttle: 'Marked: waiting for a free shuttle to fly out with empty slabs',
  noCrew: 'Marked: the shuttle waits for crew with hauling work to go along',
  shuttle: 'Marked: a shuttle brings empty slabs and carries the full one home',
  noSlab: 'Marked: waiting for an empty stasis slab',
  noRoom: 'Marked: waiting for room in a stasis wheel',
};

/**
 * A prisoner's seal order for the UI: marked or not, the reason they cannot be marked (null when they can), and what a marked one waits on
 * (null while crew are on it). Null for anyone who is not a prisoner.
 */
export function sealOf(sim: Sim, id: number): { marked: boolean; refusal: string | null; wait: string | null } | null {
  if (!sim.world.has(id, PrisonerC)) return null;
  const why = sealRefusal(sim, id);
  const wait = sealWait(sim, id);
  return { marked: sealMarked(sim, id), refusal: why ? (REASONS[why] ?? why) : null, wait: wait ? WAITS[wait] ?? null : null };
}
