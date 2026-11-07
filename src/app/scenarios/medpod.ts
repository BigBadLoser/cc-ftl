import { CrewC, PositionC, ShipC, placementError, playerShip, type Command, type Sim } from '../../sim';
import { playerCrew } from '../../sim/story/world';
import type { Scenario } from './types';

/** A free spot for one more bed on the player's ship, nearest the middle (the starter ships have one bed per crew member). */
function bedSpot(sim: Sim, ship: number): { x: number; y: number } | null {
  const s = sim.world.get(ship, ShipC);
  if (!s) return null;
  const cx = s.x + s.width / 2, cy = s.y + s.height / 2;
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = s.y; y < s.y + s.height; y++) for (let x = s.x; x < s.x + s.width; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if ((!best || d < best.d) && placementError(sim, ship, 'module.bed', x, y, 0) === null) best = { x, y, d };
  }
  return best;
}

/** The commands of the start: the spare bed, and a neutral passenger on the tile of the first crew member. */
export function medpodCommands(sim: Sim, role = 'role.engineer'): Command[] {
  const ship = playerShip(sim);
  const at = sim.world.get(playerCrew(sim)[0] ?? 0, PositionC);
  if (!ship || !at) return [];
  const bed = bedSpot(sim, ship);
  return [
    ...(bed ? [{ type: 'debug.spawnModule' as const, ship, x: bed.x, y: bed.y, def: 'module.bed', rot: 0 }] : []),
    { type: 'debug.spawnCrew', ship, x: at.x, y: at.y, role, faction: 'neutral', lodge: true },
  ];
}

/**
 * `?scenario=medpod[&role=<role id>]`: the medical pod encounter (#173 step 6), slice 1: a passenger lives aboard (a lodging guest, consent/passage.ts),
 * with a spare bed for them. They sleep, eat and pitch in with hauling and the galley, show in the crew bar's Guests group, and cannot be drafted.
 */
export const medpod: Scenario = ({ sim, params, dispatch, setSpeed, selectCrew }) => {
  setSpeed(1);
  const before = new Set(sim.world.query(CrewC));
  setTimeout(() => {
    for (const cmd of medpodCommands(sim, params.get('role') ?? undefined)) dispatch(cmd);
    setTimeout(() => {
      const guest = sim.world.query(CrewC).find((id) => !before.has(id));
      if (guest !== undefined) selectCrew(guest, true);
    }, 300);
  }, 600);
};
