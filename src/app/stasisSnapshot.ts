import { AssignmentC, CrewC, JobC, type Sim } from '../sim';
import { slabDraining, slabInfo, slabPlace, wheelSlots } from '../sim/stasis/query';
import { moduleNameOf } from '../sim/upgrades/stats';
import type { UiStasis, UiWheelSlot } from '../ui/api';

const nameOf = (sim: Sim, id: number): string => sim.world.get(id, CrewC)?.name ?? 'Someone';
const pct = (sim: Sim, prisoner: number): number => Math.round((slabInfo(sim, prisoner)?.reserve ?? 0) * 100);

/** A stasis wheel's slots for its module panel (slot 0 at the hatch), or null when the module is not a wheel. Reads the sim. */
export function buildWheel(sim: Sim, id: number): UiWheelSlot[] | null {
  const slots = wheelSlots(sim.world, id);
  if (!slots.length) return null;
  return slots.map((s) => (s.kind === 'full'
    ? { kind: 'full', crew: s.prisoner, name: nameOf(sim, s.prisoner), reserve: pct(sim, s.prisoner), draining: slabDraining(sim, s.prisoner) }
    : s));
}

/** A frozen prisoner's slab for their inspector, or null when they are not in stasis. Reads the sim. */
export function stasisOf(sim: Sim, id: number): UiStasis | null {
  const place = slabPlace(sim, id);
  if (!place) return null;
  const base = { reserve: pct(sim, id), draining: slabDraining(sim, id), wheel: null, carrier: null, to: null };
  if (place.kind === 'wheel') return { ...base, where: `${moduleNameOf(sim, place.wheel)}, slot ${place.slot + 1}`, wheel: place.wheel };
  if (place.kind === 'floor') return { ...base, where: 'On the floor, waiting to be carted' };
  const a = sim.world.get(place.crew, AssignmentC);
  const wheel = (a && sim.world.get(a.jobId, JobC)?.stasis?.wheel) || 0;
  return {
    ...base, where: 'On a hover cart', carrier: { id: place.crew, name: nameOf(sim, place.crew) },
    to: wheel ? moduleNameOf(sim, wheel) : null, wheel: wheel || null,
  };
}
