import { stationKindOf, eastEdge, populateDerelict, populateField, populateOutpost, populateStation, sizeOf, structureSeed } from './populateSpawn';
import { strHash, unit } from './hash';
import { portsAt } from './portIndex';
import { nodeOf, nodeState } from './state';
import type { Sim } from '../sim';
import type { Port } from './ports';

/**
 * Node population (living world, after stage 3): a node's structures exist only as galaxy data until the player first enters it, and then they become real.
 * `populateNode` runs once per node, on the first drop (or at the start of a new game for the start node); afterwards the node's archive owns what it made, so a
 * return visit restores it and never repeats this (`NodeState.populated`). Everything is a function of (galaxy seed, node, structure index), never of the order
 * of visits.
 * - A station structure becomes a generated station (`spawnStation`: crew, security, a trader, the director). Kind and size come from its port: a den is a pirate
 *   station, a depot a navy one, a market the kind its trade profile names (trading or farming); size 1 to 3 is an outpost, a station or a hub. It is bound to its
 *   port's market (`bindStation`), so what the player trades moves the world economy.
 * - An asteroid field becomes a field of loose rocks. A field that is a mining outpost port also gets a surface mining outpost on a big asteroid. A pirate den in a
 *   node with a field is not an orbital station but a dug base hidden in a big asteroid (the existing outpost style for pirates).
 * - A derelict becomes a ruined wreck of the node's faction (or any faction's); a drone nest (a derelict in rogue space) is a heavier ruin full of robots.
 * Layout: west to east in structure order, each at least SLOT_GAP tiles east of everything before it and never nearer the west edge than WEST_MARGIN (the free
 * water the player deploys in), centred on a line with a small hashed offset. The sector grows to hold them, as it does for hubs.
 */

/** Tiles kept clear in the west of the node for the player's ship to deploy. */
export const WEST_MARGIN = 70;
/** Tiles of open space between one structure and the next. */
export const SLOT_GAP = 30;
const MID_Y = 60;
const SALT = { place: 81, station: 91, field: 92, outpost: 93, derelict: 94, dug: 95 } as const;

/** Where the next structure goes: east of everything, centred on the mid line with a hashed offset. */
export function slot(sim: Sim, node: string, index: number): (w: number, h: number) => { x: number; y: number } {
  const x = Math.max(WEST_MARGIN, eastEdge(sim) + SLOT_GAP);
  return (_w, h) => ({ x, y: Math.max(4, Math.round(MID_Y - h / 2 + (unit(sim.seed, strHash(node), index, SALT.place) - 0.5) * 20)) });
}

/**
 * Make the active sector's node real: all of its structures. Returns how many were made. Nothing happens for a node already populated, or when the sector is not
 * the node's. Safe to call for the start node on a fresh game (the player's ship stays where it is: structures go east of it).
 */
export function populateNode(sim: Sim, id: string): number {
  const content = sim.content.galaxy;
  const node = nodeOf(sim, id);
  if (!content || !node || sim.sector.node !== id) return 0;
  const st = nodeState(sim, id);
  if (st.populated) return 0;
  st.populated = true;
  const ports = new Map<number, Port>(portsAt(sim, id).map((p) => [Number(p.id.slice(p.id.indexOf('#') + 1)), p]));
  const hasField = node.structures.some((s) => content.structures[s.def]?.kind === 'asteroids');
  let made = 0;
  const build = (s: (typeof node.structures)[number], i: number): boolean => {
    const def = content.structures[s.def];
    if (!def) return false;
    const port = ports.get(i);
    const at = slot(sim, id, i);
    let ok = false;
    if (def.kind === 'station') {
      const pirate = content.factions[s.owner ?? '']?.kind === 'pirates';
      if (port?.kind === 'den' && hasField) {
        // A den among the rocks is dug into a big asteroid and hidden there.
        ok = populateOutpost(sim, port, 'dug', 'pirate', structureSeed(sim, id, i, SALT.dug), at);
      } else {
        const kind = stationKindOf(sim, port, def.station === 'military', pirate, def.station === 'research');
        ok = populateStation(sim, port, kind, sizeOf(port), structureSeed(sim, id, i, SALT.station), at) !== null;
      }
    } else if (def.kind === 'asteroids') {
      ok = populateField(sim, structureSeed(sim, id, i, SALT.field), at);
      if (port?.kind === 'outpost') ok = populateOutpost(sim, port, 'surface', 'mining', structureSeed(sim, id, i, SALT.outpost), slot(sim, id, i)) || ok;
    } else {
      ok = populateDerelict(sim, node, port?.kind === 'nest', structureSeed(sim, id, i, SALT.derelict), at);
    }
    return ok;
  };
  node.structures.forEach((s, i) => {
    try {
      if (build(s, i)) made++;
    } catch {
      // One structure that fails to build is skipped and the node keeps what it has: it must not abort the others or the tick.
    }
  });
  sim.galaxy.rev++;
  sim.events.emit({ type: 'galaxy.populated', node: id, count: made });
  return made;
}

