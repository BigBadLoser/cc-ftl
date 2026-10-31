import type { UiShuttleAirlock, UiShuttleCrew, UiShuttles } from '../api';

/** What the BOARD picker offers against one enemy ship: each choice says whether it can be picked and why not. */
export interface BoardShuttle { id: number; name: string; seats: number; reason: string | null }
export interface BoardCrew { id: number; name: string; role: string; hp: number; reason: string | null }
export interface BoardPlan {
  shuttles: BoardShuttle[];
  /** Working, free airlocks of the enemy ship. */
  airlocks: UiShuttleAirlock[];
  /** Crew who can walk to the (first) usable shuttle's bay: the home ship's crew. */
  crew: BoardCrew[];
  /** Why the BOARD button is disabled (null = it opens). */
  blocker: string | null;
}

const shuttleReason = (s: UiShuttles['shuttles'][number]): string | null =>
  s.state !== 'stowed' ? (s.state === 'docked' ? 'Away: docked' : 'Away') : s.ferry ? 'On a cargo run' : s.pilot || s.passengers.length ? 'Crew already aboard' : null;
const crewReason = (c: UiShuttleCrew): string | null => (c.down ? 'Down' : c.boarding ? 'Heading to a shuttle' : null);

/** Pure: the picker's options from the shuttle snapshot and the enemy's ship id. */
export function boardPlan(data: UiShuttles, enemy: number, home: number): BoardPlan {
  const shuttles = data.shuttles.map((s) => ({ id: s.id, name: s.name, seats: s.capacity + 1, reason: shuttleReason(s) }));
  const airlocks = data.airlocks.filter((a) => a.shipId === enemy && a.working && !a.busy);
  const crew = data.roster.filter((c) => c.ship === home).map((c) => ({ id: c.id, name: c.name, role: c.role, hp: c.hp, reason: crewReason(c) }));
  const ready = shuttles.some((s) => !s.reason);
  const able = crew.filter((c) => !c.reason).length;
  const blocker = shuttles.length === 0 ? 'No shuttle' : !ready ? 'No shuttle in the bay' : airlocks.length === 0 ? 'No reachable airlock' : able < 1 ? 'No crew free to go' : null;
  return { shuttles, airlocks, crew, blocker };
}
