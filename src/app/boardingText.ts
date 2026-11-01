import { CrewC, ModuleC, ShipC, type Sim, type SimEvent } from '../sim';
import { homeShip } from '../sim/index';
import type { LogEntry } from './logText';
import { crewSubject, shipSubject } from './subjects';

/** Why a crew member could not be recalled (the sim's reason codes), as a short phrase after their name. */
const RECALL_REASON: Record<string, string> = {
  noCrew: 'is gone', incapacitated: 'is down', notAboard: 'is not aboard', noShuttle: 'has no shuttle docked here', noHome: 'cannot fly home',
  full: 'found the shuttle full', notBoardable: 'cannot reach the shuttle', airlockDown: 'found the airlock down', unreachable: 'has no way to the shuttle',
  lost: 'was lost on the way', late: 'was too late for the shuttle',
};
export const recallReason = (r: string): string => RECALL_REASON[r] ?? 'could not be recalled';

/** Ship's log lines for the boarding events (sabotage, recall, a party left with a ship). Null for anything else. */
export function describeBoarding(sim: Sim, e: SimEvent): LogEntry | null {
  const crew = (id: number) => sim.world.get(id, CrewC)?.name ?? 'A boarder';
  const module = (id: number) => sim.content.modules[sim.world.get(id, ModuleC)?.def ?? '']?.name ?? 'module';
  const shipName = (id: number) => sim.world.get(id, ShipC)?.name ?? 'the enemy ship';
  const who = (ids: number[]) => (ids.length === 1 ? crew(ids[0] as number) : `${ids.length} crew`);
  const at = (id: number) => { const s = crewSubject(sim, id); return s ? { subject: s } : {}; };
  switch (e.type) {
    case 'crew.sabotageStarted': return { kind: 'boarding', tone: 'info', text: `${crew(e.crew)} sabotages the ${module(e.module)}`, ...at(e.crew) };
    case 'crew.sabotagePaused': return { kind: 'boarding', tone: 'warn', text: `${crew(e.crew)} breaks off to fight`, ...at(e.crew) };
    case 'crew.sabotageResumed': return { kind: 'boarding', tone: 'info', text: `${crew(e.crew)} resumes sabotage`, ...at(e.crew) };
    case 'crew.sabotageEnded': {
      const m = module(e.module);
      const text = e.reason === 'destroyed' ? `Enemy ${m} sabotaged` : e.reason === 'downed' ? `${crew(e.crew)} went down on sabotage`
        : e.reason === 'cancelled' ? `${crew(e.crew)} stood down` : `${crew(e.crew)} left the job`;
      return { kind: 'boarding', tone: e.reason === 'destroyed' ? 'good' : e.reason === 'downed' ? 'bad' : 'info', text, ...at(e.crew) };
    }
    case 'crew.recallStarted': {
      const left = e.left.map((l) => `${crew(l.crew)} ${recallReason(l.reason)}`);
      return { kind: 'boarding', tone: left.length ? 'warn' : 'info', text: `Recalling ${who(e.crew)} to the shuttle${left.length ? `; ${left.join(', ')}` : ''}`, ...(shipSubject(sim, e.ship) ? { subject: shipSubject(sim, e.ship)! } : {}) };
    }
    case 'crew.recalled': return { kind: 'boarding', tone: 'good', text: `${who(e.crew)} back aboard`, subject: { kind: 'ship', id: homeShip(sim) } };
    case 'crew.recallFailed': {
      if (!e.crew.length) return null;
      return { kind: 'boarding', tone: 'bad', text: `${e.crew.map(crew).join(', ')} ${recallReason(e.reason)}: still on the enemy ship` };
    }
    case 'crew.leftWithShip': return { kind: 'boarding', tone: 'bad', text: `A boarder was left aboard ${shipName(e.ship)} as it ${e.how === 'fled' ? 'jumped away' : 'was lifted away'}` };
    default: return null;
  }
}
