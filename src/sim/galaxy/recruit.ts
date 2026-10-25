import type { Sim } from '../sim';
import { spawnNamedCrew } from '../combat/ships';
import { playerShip } from '../trade/player';
import { hash32, strHash, unit } from './hash';
import { portsAt } from './portIndex';
import type { Port } from './ports';
import { tierOf } from './standing';
import { nodeOf } from './state';
import { RECRUIT_BASE, RECRUIT_JITTER, RECRUIT_LOG_MAX, RECRUIT_PER_WORTH, RECRUIT_ROLES, RECRUIT_SLOTS, RECRUIT_TURNS } from './tuningRecruit';

/**
 * Crew for hire. A port whose structure lists the `recruit` service (trade stations) posts candidates, derived from hashes of (seed, port, window, slot) the way
 * job offers are (jobOffers.ts): nothing is stored until one is hired, then the key goes in `GalaxyState.recruitLog` so it does not come back in its window.
 * Command: `crew.hire` (at the player's node, enough credits, a free floor tile aboard). There is no crew cap beyond floor space.
 */
export interface Recruit {
  key: string;
  name: string;
  role: string;
  species: string;
  cost: number;
}

const SALT = 0x4e17;

/** Whether the port's structure lists the recruit service. */
function recruits(sim: Sim, port: Port): boolean {
  const s = nodeOf(sim, port.node)?.structures[Number(port.id.slice(port.id.indexOf('#') + 1))];
  return !!s && !!sim.content.galaxy?.structures[s.def]?.services?.includes('recruit');
}

/** The candidates of one port now: none from a faction hostile to the player. */
export function portRecruits(sim: Sim, port: Port): Recruit[] {
  if (!recruits(sim, port) || tierOf(sim, port.owner) === 'hostile') return [];
  const g = sim.galaxy;
  const window = Math.floor(g.turn / RECRUIT_TURNS);
  const names = sim.content.crewNames;
  const out: Recruit[] = [];
  for (let slot = 0; slot < RECRUIT_SLOTS; slot++) {
    const key = `${port.id}|${window}|${slot}`;
    if (g.recruitLog.includes(key)) continue;
    const h = (salt: number): number => unit(sim.seed, strHash(port.id), window, slot, SALT, salt);
    const pick = RECRUIT_ROLES.filter((r) => sim.content.roles[r.role])[Math.floor(h(1) * RECRUIT_ROLES.length)];
    const role = pick ? sim.content.roles[pick.role] : undefined;
    const species = sim.content.species[role?.species ?? 'species.human'];
    if (!pick || !species || !names.length) continue;
    out.push({
      key, role: pick.role, species: role?.species ?? 'species.human',
      name: species.designation ? `${species.designation}-${String(hash32(sim.seed, strHash(key), 1) % 1000).padStart(3, '0')}` : names[Math.floor(h(2) * names.length)] as string,
      cost: RECRUIT_BASE + RECRUIT_PER_WORTH * pick.worth + Math.floor(h(3) * (RECRUIT_JITTER + 1)),
    });
  }
  return out;
}

/** Every candidate at the player's node. */
export const recruitsHere = (sim: Sim): Recruit[] => portsAt(sim, sim.galaxy.current).flatMap((p) => portRecruits(sim, p));

const reject = (sim: Sim, reason: string): void => void sim.events.emit({ type: 'command.rejected', command: 'crew.hire', reason });

/** `crew.hire`: take on a candidate at the player's node, paying their cost; they appear on a free floor tile of the player's ship. */
export function hireCrew(sim: Sim, key: string): void {
  const g = sim.galaxy;
  if (sim.sector.state !== 'active' || g.event) return reject(sim, 'notHere');
  const c = recruitsHere(sim).find((r) => r.key === key);
  if (!c) return reject(sim, 'noCandidate');
  if (sim.trade.credits < c.cost) return reject(sim, 'cantAfford');
  const crew = spawnNamedCrew(sim, playerShip(sim), c.role, sim.content.species[c.species]?.designation ? undefined : c.name);
  if (!crew) return reject(sim, 'noRoom');
  sim.trade.credits -= c.cost;
  g.recruitLog.push(key);
  if (g.recruitLog.length > RECRUIT_LOG_MAX) g.recruitLog.splice(0, g.recruitLog.length - RECRUIT_LOG_MAX);
  g.rev++;
  sim.events.emit({ type: 'crew.hired', crew, role: c.role, cost: c.cost });
}
