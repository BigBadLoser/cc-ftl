import type { Sim } from '../sim';
import { bestAt } from '../sim/story/world';
import { CrewC, DeadC, DownedC } from '../sim/crew/components';
import { lodgingHere } from '../sim/consent/guests';
import { podAdrift } from '../sim/scene/pods';
import type { ScenePod } from '../sim/scene/types';
import { VehicleC } from '../sim/vehicles/components';
import type { UiEventGrid } from '../ui/starmapApi';

/**
 * The medical pod (DESIGN.md "Medical pod"; #173 step 6) as the UI shows it: what a scan reads off the pod beacon before anyone drops out, and in the
 * pocket where its patient stands (adrift and bleeding, the pod on its way, carried to a bed, recovering, dead) with the one order it takes: call it in.
 */

const ownerName = (sim: Sim, id: string): string => sim.content.galaxy?.factions[id]?.name ?? id;

/** Medicine at which the scan reads the bleeding to the second (a medic aboard), not in rough bands. */
const READ_EXACT = 4;

/** The scan of a pod: who is aboard and how bad it is. A medic reads the time they have left; anyone else a rough band. */
export function podRows(sim: Sim, p: ScenePod): { label: string; value: string }[] {
  const role = sim.content.roles[p.patient.role];
  const species = sim.content.species[role?.species ?? 'species.human']?.name ?? 'Human';
  const exact = (bestAt(sim, 'medicine')?.level ?? 0) >= READ_EXACT;
  const minutes = Math.round(p.bleed / 60);
  const bleed = exact ? `Bleeding out: about ${Math.round(p.bleed / 10) * 10} s once you are there` : p.bleed < 150 ? 'Bleeding badly: minutes at most' : `Bleeding: a few minutes (${minutes})`;
  const top = Object.entries(p.patient.skills ?? {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  return [
    { label: 'Beacon', value: `${ownerName(sim, p.owner)} registry` },
    { label: 'Life sign', value: `One ${species.toLowerCase()}, unconscious` },
    { label: 'Injury', value: bleed },
    { label: 'Skills', value: top ? `Their suit logs ${top[0]} work` : 'Nothing on record' },
  ];
}

/** The pod in the pocket and its one order, or null (no pod, or not made real yet). */
export function podOf(sim: Sim): UiEventGrid['pod'] {
  const p = sim.galaxy.event?.scene.pods?.[0];
  if (!p || p.vehicle === undefined || p.crew === undefined) return null;
  const name = p.patient.name;
  const crew = p.crew;
  const dead = !sim.world.has(crew, CrewC) || sim.world.has(crew, DeadC);
  const downed = sim.world.get(crew, DownedC);
  const adrift = podAdrift(sim, p);
  const coming = adrift && sim.world.get(p.vehicle, VehicleC)?.dest?.type === 'dock';
  const status = dead ? `${name} is dead`
    : adrift ? (coming ? 'The pod is on its way to your airlock' : `${name} is adrift in the pod, unconscious`)
    : downed ? (downed.stabilized ? `${name} is in a bed, recovering` : `${name} needs a bed`)
    : lodgingHere(sim, crew) ? `${name} is aboard as a passenger` : name;
  const clock = !dead && downed && !downed.stabilized && !downed.patched ? Math.max(0, Math.ceil(downed.bleed)) : null;
  return { pod: p.id, name, status, clock, action: adrift && !coming ? 'call' : null };
}
