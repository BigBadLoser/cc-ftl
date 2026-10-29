import { AllegianceC, ShipC, type Sim, type SimEvent } from '../sim';
import type { LogEntry } from './logText';

/** What a fight cost, counted from its events: one line for the log when it ends, in place of reading eleven destruction entries. */
export interface FightTally {
  modulesLost: number;
  crewDown: number;
  crewDead: number;
  enemyModules: number;
  enemyCrew: number;
}

export const emptyTally = (): FightTally => ({ modulesLost: 0, crewDown: 0, crewDead: 0, enemyModules: 0, enemyCrew: 0 });

/** Add a tick's events to the running tally. `combat.started` resets it. Read-only on the sim. */
export function tallyFight(sim: Sim, t: FightTally, events: readonly SimEvent[]): FightTally {
  const next = { ...t };
  const mine = (ship: number) => sim.world.get(ship, ShipC)?.faction === 'player';
  const ours = (crew: number) => sim.world.get(crew, AllegianceC)?.faction === 'player';
  for (const e of events) {
    if (e.type === 'combat.started') return tallyFight(sim, emptyTally(), events.slice(events.indexOf(e) + 1));
    if (e.type === 'module.destroyed') next[mine(e.ship) ? 'modulesLost' : 'enemyModules']++;
    else if (e.type === 'crew.downed' && ours(e.crew)) next.crewDown++;
    else if (e.type === 'crew.died') next[ours(e.crew) ? 'crewDead' : 'enemyCrew']++;
  }
  return next;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The after-fight line, or null when nothing was lost or destroyed. */
export function fightSummary(t: FightTally): LogEntry | null {
  const lost: string[] = [];
  if (t.modulesLost) lost.push(`${plural(t.modulesLost, 'module', 'modules')} lost`);
  if (t.crewDead) lost.push(`${plural(t.crewDead, 'crew', 'crew')} dead`);
  if (t.crewDown) lost.push(`${t.crewDown} crew down`);
  const won: string[] = [];
  if (t.enemyModules) won.push(`${plural(t.enemyModules, 'enemy module', 'enemy modules')} destroyed`);
  if (t.enemyCrew) won.push(`${plural(t.enemyCrew, 'enemy crew', 'enemy crew')} killed`);
  if (!lost.length && !won.length) return null;
  return { kind: 'combat', tone: lost.length ? 'bad' : 'good', text: `Fight cost: ${[...lost, ...won].join(', ')}` };
}
