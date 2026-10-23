import type { Sim } from '../sim';
import { chase, headHome, retreat, strand } from './agenda';
import { clash, wouldFight, type Clash, type SideResult } from './clash';
import { cargoCap, cargoLoad } from './dock';
import { unit } from './hash';
import { fleetName } from './names';
import { report } from './news';
import { portOf, owe } from './portIndex';
import { portNode } from './ports';
import { leaveWreck } from './wrecks';
import type { Fleet, NewsItem } from './types';

/**
 * NPC-vs-NPC meetings (living world stage 4). When fleets of factions that fight on sight share a node at the end of a turn, or cross on one lane in opposite
 * directions, outside the player's node, the stats mini-sim (clash.ts) decides it - nothing is simulated ship by ship. The player's own node keeps real combat: a fleet
 * there, or one that has just left it, never takes part. Each fleet meets at most one other per turn; fleets go in id order and nodes in id order, so the outcome is a
 * function of the seed, the fleets and the turn.
 *
 * Consequences (`apply`):
 * - A destroyed ship is forgotten, its port owes a replacement (stage 2 rebuilds), and its hull is left as a wreck at the place for the player to find (wrecks.ts);
 *   a fleet with no ship left is gone.
 * - A side that was driven off runs for home (`retreat`); a patrol that drove a pirate off follows it a few hops (`chase`). A side that holds the field hurt, or
 *   both sides of a draw, are stranded and call for help (the stage 2 breakdown path: `damaged`, repaired on their own after a while).
 * - A pirate or raider that won against a fleet with cargo takes it (all of it from a destroyed fleet, half from one that ran), up to its hold, and heads home
 *   to the den's market (`dock.ts` unloads it there).
 * - The news log hears of it (news.ts).
 */

const SALT = { place: 65 } as const;

/** The fleets that took part in a meeting, in the order they were found. */
export interface Meeting {
  a: Fleet;
  b: Fleet;
  /** Where it was settled. */
  node: string;
}

/** Meetings among `fleets` (those that stepped this turn): same node at the end of the turn, or opposite directions on one lane. */
export function findMeetings(sim: Sim, turn: number, fleets: readonly Fleet[]): Meeting[] {
  const cur = sim.galaxy.current;
  const live = fleets.filter((f) => f.ships.length > 0 && f.node !== cur && f.from !== cur).sort((p, q) => p.id - q.id);
  const out: Meeting[] = [];
  const used = new Set<number>();
  const take = (a: Fleet, b: Fleet, node: string): void => {
    out.push({ a, b, node });
    used.add(a.id).add(b.id);
  };
  // Lanes first (the meeting is on the way), then nodes.
  const movers = live.filter((f) => f.moved === turn && f.from !== f.node);
  for (let i = 0; i < movers.length; i++) {
    const a = movers[i] as Fleet;
    for (let j = i + 1; j < movers.length && !used.has(a.id); j++) {
      const b = movers[j] as Fleet;
      if (used.has(b.id) || a.from !== b.node || a.node !== b.from || !wouldFight(sim, a, b)) continue;
      take(a, b, unit(sim.seed, a.id, b.id, turn, SALT.place) < 0.5 ? a.node : b.node);
    }
  }
  const byNode = new Map<string, Fleet[]>();
  for (const f of live) if (!used.has(f.id)) byNode.set(f.node, [...(byNode.get(f.node) ?? []), f]);
  for (const node of [...byNode.keys()].sort()) {
    const here = byNode.get(node) as Fleet[];
    for (let i = 0; i < here.length; i++) {
      const a = here[i] as Fleet;
      for (let j = i + 1; j < here.length && !used.has(a.id); j++) {
        const b = here[j] as Fleet;
        if (!used.has(b.id) && wouldFight(sim, a, b)) take(a, b, node);
      }
    }
  }
  return out;
}

/** Take cargo off the loser for the winner (a pirate), as much as the winner's hold takes. Returns the lines taken. */
function loot(winner: Fleet, loser: Fleet, share: number): { item: string; count: number }[] {
  const taken: { item: string; count: number }[] = [];
  let room = cargoCap(winner) - cargoLoad(winner);
  for (const l of loser.cargo ?? []) {
    const count = Math.min(room, Math.ceil(l.count * share));
    if (count <= 0) continue;
    room -= count;
    taken.push({ item: l.item, count });
    const mine = (winner.cargo ??= []).find((x) => x.item === l.item);
    if (mine) mine.count += count;
    else winner.cargo.push({ item: l.item, count });
  }
  return taken;
}

/** One side's part: ships lost (wrecks, owed rebuilds), then what the survivors do. */
function settleSide(sim: Sim, f: Fleet, r: SideResult, node: string, turn: number): void {
  for (const c of r.lost) {
    leaveWreck(sim, node, c, f.faction, turn);
    owe(sim, f.home, f.faction, f.role, c.size ?? 'small', turn);
  }
  const gone = new Set(r.lost.map((c) => c.id));
  f.ships = f.ships.filter((c) => !gone.has(c.id));
  if (!f.ships.length) return;
  if (r.fate === 'fled') retreat(sim, f, turn);
  else if (r.fate === 'hurt') strand(sim, f, turn);
}

/** Apply a settled meeting: ships, wrecks, rebuilds, flight, loot, chase and news. */
export function apply(sim: Sim, m: Meeting, c: Clash, turn: number): void {
  const { a, b, node } = m;
  const names = [fleetName(a), fleetName(b)] as const;
  settleSide(sim, a, c.a, node, turn);
  settleSide(sim, b, c.b, node, turn);
  const news = (item: Omit<NewsItem, 'id' | 'turn' | 'node'>): void => report(sim, { node, ...item }, turn);
  if (c.kind === 'avoided') return;
  const [w, l] = c.winner === 'b' ? [b, a] : [a, b];
  const nameW = (w === a ? names[0] : names[1]) as string;
  const nameL = (w === a ? names[1] : names[0]) as string;
  const lost = (w === a ? c.b : c.a).lost;
  const loserSide = w === a ? c.b : c.a;
  if (c.kind === 'draw') {
    news({ kind: 'clash', who: names[0] as string, faction: a.faction, foe: names[1] as string, foeFaction: b.faction });
  } else {
    const home = portOf(sim, l.home);
    const raid = w.role === 'patrol' && lost.length > 0 && portNode(l.home) === node && home?.kind === 'den';
    const base = { who: nameW, faction: w.faction, foe: nameL, foeFaction: l.faction };
    if (raid) news({ kind: 'raid', ...base });
    else if (lost.length) news({ kind: 'destroyed', ...base });
    else news({ kind: 'driven', ...base });
    let looted = false;
    // A pirate that won takes what the loser carried: everything if it was destroyed, half if it ran.
    if ((w.role === 'pirate' || w.role === 'raider') && w.ships.length && (l.cargo?.length ?? 0) > 0) {
      const taken = loot(w, l, loserSide.fate === 'destroyed' ? 1 : 0.5);
      if (loserSide.fate === 'fled') l.cargo = (l.cargo ?? []).map((x) => ({ ...x, count: x.count - (taken.find((t) => t.item === x.item)?.count ?? 0) })).filter((x) => x.count > 0);
      const best = taken.reduce<{ item: string; count: number } | null>((p, t) => (!p || t.count > p.count ? t : p), null);
      if (best) news({ kind: 'loot', ...base, item: best.item, count: taken.reduce((n, t) => n + t.count, 0) });
      looted = !!best;
      if (taken.length) headHome(sim, w);
    }
    // A trader lost with nothing worth taking is still a trade route cut (with loot, the loot line says it).
    if (lost.length && l.role === 'trader' && !looted) news({ kind: 'cut', who: nameL, faction: l.faction });
    // A patrol that drove a pirate away follows it.
    if (w.role === 'patrol' && (l.role === 'pirate' || l.role === 'raider') && loserSide.fate === 'fled' && l.ships.length) chase(sim, w, l);
  }
  sim.galaxy.rev++;
}

/** Resolve the meetings of this turn among the fleets that stepped. Fleets with no ship left leave the world. */
export function resolveMeetings(sim: Sim, turn: number, fleets: readonly Fleet[]): void {
  if (fleets.length < 2) return;
  const meetings = findMeetings(sim, turn, fleets);
  if (!meetings.length) return;
  for (const m of meetings) apply(sim, m, clash(sim, m.a, m.b, turn), turn);
  const g = sim.galaxy;
  const alive = g.fleets.filter((f) => f.ships.length > 0);
  if (alive.length !== g.fleets.length) g.fleets = alive;
}

