import { PositionC, ShipC, placementError, playerShip, type Command, type Sim } from '../../../sim';
import { playerCrew } from '../../../sim/story/world';
import { nodesWithin } from '../../../sim/galaxy/graph';
import { portsAt } from '../../../sim/galaxy/portIndex';

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

/** A galaxy faction with a port 1-3 jumps away (where a passenger of theirs asks to go), or undefined. */
function nearOrigin(sim: Sim): string | undefined {
  for (const [node, hops] of nodesWithin(sim, sim.galaxy.current, 3)) {
    const p = hops >= 1 ? portsAt(sim, node).find((x) => ['station', 'depot', 'den'].includes(x.kind) && x.owner !== 'pirates') : undefined;
    if (p) return p.owner;
  }
  return undefined;
}

/** The commands of the start: the spare bed, and a neutral passenger on the tile of the first crew member (`carry`: as the pod's patient, on their feet). */
export function medpodCommands(sim: Sim, role = 'role.engineer', carry = false): Command[] {
  const ship = playerShip(sim);
  const at = sim.world.get(playerCrew(sim)[0] ?? 0, PositionC);
  if (!ship || !at) return [];
  const bed = bedSpot(sim, ship);
  return [
    ...(bed ? [{ type: 'debug.spawnModule' as const, ship, x: bed.x, y: bed.y, def: 'module.bed', rot: 0 }] : []),
    {
      type: 'debug.spawnCrew', ship, x: at.x, y: at.y, role, faction: 'neutral', lodge: true,
      ...(carry ? { carry: { event: 'event.medical_emergency', origin: nearOrigin(sim) ?? 'traders', purse: 80 } } : {}),
    },
  ];
}

/** The spare bed alone (the starter ships have one bed per crew member: a passenger needs one of their own). */
export function spareBedCommands(sim: Sim): Command[] {
  return medpodCommands(sim).filter((c) => c.type === 'debug.spawnModule');
}
