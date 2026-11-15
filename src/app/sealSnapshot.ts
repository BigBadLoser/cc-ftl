import { PrisonerC, type Sim } from '../sim';
import { sealMarked, sealRefusal } from '../sim/stasis/order';

const REASONS: Record<string, string> = {
  frozen: 'Already sealed in stasis',
  notYours: 'Not aboard one of your ships',
  noWheel: 'No stasis wheel with room that can be reached on this ship',
  notPrisoner: 'Not a prisoner',
};

/** A prisoner's seal order for the UI: marked or not, and the reason they cannot be marked (null when they can). Null for anyone who is not a prisoner. */
export function sealOf(sim: Sim, id: number): { marked: boolean; refusal: string | null } | null {
  if (!sim.world.has(id, PrisonerC)) return null;
  const why = sealRefusal(sim, id);
  return { marked: sealMarked(sim, id), refusal: why ? (REASONS[why] ?? why) : null };
}
