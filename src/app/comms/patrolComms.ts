import type { Encounter, Sim } from '../../sim';
import { peekGenerated, warmContact } from '../../sim/galaxy/arrivals';
import type { UiPatrolHail } from '../../ui/starmapApi';
import { speakerOf } from './speaker';

/**
 * The adapter from a patrol's hail to stop (#138 step 2, an `Encounter` with `scan`) to the comms window's data: the captain, what they say, the patrol
 * ship as the hologram and a vague reading of their scan (it flags the ship as suspect; it names nothing, so the player is not told what was found).
 * It only reads the sim: the fleet's lead ship (its contact).
 */
export function patrolHailOf(sim: Sim, e: Encounter, nodeName: string): UiPatrolHail | null {
  const f = sim.galaxy.fleets.find((x) => x.id === e.fleet);
  const c = f?.ships[0];
  if (!c) return null;
  const faction = sim.content.galaxy?.factions[e.faction];
  warmContact(sim, c);
  const gen = peekGenerated(sim, c)?.template.name;
  const sp = speakerOf({ contact: c }, gen, faction?.kind);
  const ship = c.name ?? gen ?? 'patrol cutter';
  const fname = faction?.name ?? e.faction;
  return {
    caller: {
      name: sp.name, role: 'Captain of the', ship, faction: `${fname} · patrol`, swatch: faction?.kind === 'corporation' ? 'var(--amber)' : 'var(--cyan)',
      status: { label: 'Law enforcement', tone: 'cyan' },
    },
    look: sp.look,
    transcript: [
      { kind: 'narration', text: `A ${fname} patrol matches your course in the lane and opens a channel.` },
      { kind: 'speech', speaker: sp.name, text: `This is Captain ${sp.name} of the ${ship}. Our scan flags your vessel as a smuggling risk. Cut your drive, drop out at ${nodeName} and stand by for inspection.` },
      { kind: 'speech', speaker: sp.name, text: 'Run, and we will remember it.' },
    ],
    holo: { faction: c.faction, shipgen: c.shipgen, seed: c.seed, depth: c.depth },
    hullTitle: `${fname.toUpperCase()} PATROL`,
    readout: [
      { label: 'Transponder', value: sp.tag ? `${fname} · ${sp.tag}` : fname, wide: true },
      { label: 'Ships', value: String(e.ships) },
      { label: 'Their scan', value: 'Suspicious' },
    ],
  };
}
