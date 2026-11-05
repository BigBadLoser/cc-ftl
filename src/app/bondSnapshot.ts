import { CrewC, DeadC, PositionC, entityOf, friendsOf, galaxyIndex, mainReason, opinionOf, personOf, rivalsOf, type Opinion, type Sim } from '../sim';
import { shipIdOf } from '../sim/regions';
import type { UiBond, UiBonds, UiOpinionHover } from '../ui/crewDetailApi';
import { bondReasonText, bondWord } from './bondText';

/** Place names for a node id as the log prints them (undefined: an unnamed place is left out of the line). */
type PlaceName = (node: string) => string | undefined;

/** The name of a charted node ("Ithra"); deep space and unexplored nodes have none. */
export const placeNamer = (sim: Sim): PlaceName => (node) => (sim.galaxy.discovered[node] !== undefined ? galaxyIndex(sim.galaxy).nodes.get(node)?.name : undefined);

function lineOf(op: Opinion, place: PlaceName): string {
  const r = mainReason(op);
  const word = bondWord(op.score, op.kind);
  return r ? `${word}: ${bondReasonText(r.id, r.at ? place(r.at) : undefined)}` : word;
}

function bondOf(sim: Sim, person: number, op: Opinion, place: PlaceName): UiBond {
  const id = entityOf(sim, person);
  return { id, name: sim.bonds.names[person] ?? 'Crew', score: Math.round(op.score), kind: op.kind ?? null, line: lineOf(op, place) };
}

/** The living friends and rivals of a crew member, strongest first. A person who has died is not listed. */
export function buildBonds(sim: Sim, id: number, place: PlaceName = placeNamer(sim)): UiBonds {
  const pid = personOf(sim, id);
  const living = (b: { person: number }): boolean => { const e = entityOf(sim, b.person); return !!e && sim.world.has(e, CrewC) && !sim.world.has(e, DeadC); };
  if (!pid) return { friends: [], rivals: [] };
  return {
    friends: friendsOf(sim, pid).filter(living).map((b) => bondOf(sim, b.person, b.op, place)),
    rivals: rivalsOf(sim, pid).filter(living).map((b) => bondOf(sim, b.person, b.op, place)),
  };
}

/** What `watched` thinks of the crew member standing at (x, y) on `ship`, if there is one (and they have an opinion). */
export function opinionAt(sim: Sim, watched: number, ship: number, x: number, y: number, place: PlaceName = placeNamer(sim)): UiOpinionHover | null {
  const me = personOf(sim, watched);
  if (!me) return null;
  for (const o of sim.world.query(CrewC, PositionC)) {
    if (o === watched || sim.world.has(o, DeadC)) continue;
    const p = sim.world.get(o, PositionC)!;
    if (Math.round(p.x) !== x || Math.round(p.y) !== y || shipIdOf(sim, p) !== ship) continue;
    const op = opinionOf(sim, me, personOf(sim, o));
    if (!op || (op.kind === undefined && Math.abs(op.score) < 10)) return null;
    return { ...bondOf(sim, personOf(sim, o), op, place), tone: op.score >= 10 ? 'good' : op.score <= -10 ? 'bad' : 'plain' };
  }
  return null;
}
