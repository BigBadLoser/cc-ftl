import type { FleetRole, GalaxyContent, GalaxyFactionDef, PortKind, StructureDef } from './defs';
import { strHash, unit } from './hash';
import type { NodeData } from './types';

/**
 * Home ports. Every NPC ship belongs to one. A port is a structure of a node that a faction fields ships from, derived (not stored) from the
 * generated node, so it costs nothing in a save:
 * - a station of a pirate faction is a `den`, a military station of a government a `depot`, any other station a `station`;
 * - an asteroid field in a faction's territory (owned by it) is a mining `outpost`, if the faction fields miners;
 * - a derelict in a rogue faction's territory is a drone `nest`.
 * Its `kind` fixes the role of its ships (den: pirates, depot: patrols, outpost: miners, nest: raiders) except plain stations, which draw roles
 * from the owner's groups (a market also hosts free traders, see roster.ts); its `size` (1 to 3: a coin flip, +1 in a hub sector) and kind set how many groups it fields (`PortKindDef.groups`).
 * A port that loses ships owes replacements (`GalaxyState.ports`): one every `PortKindDef.rebuildTurns`, built by rebuild.ts.
 */
export interface Port {
  /** `<node id>#<index of the structure in the node>`. */
  id: string;
  node: string;
  kind: PortKind;
  size: 1 | 2 | 3;
  /** The galaxy faction that fields its ships. */
  owner: string;
  /** The role every group of this port has, or null (a plain station draws from the owner's role weights). */
  role: FleetRole | null;
  /** A market: free traders keep ships here whoever owns it (`TRADE_GUESTS`). */
  trade: boolean;
  /** The station type of a station structure (`StructureDef.station`; a station with none counts as a trade station), else absent. Decides which jobs it offers and takes in (jobOffers.ts). */
  station?: 'trade' | 'military' | 'research';
}

/** What a port's jobs go by: its station type, or 'den' for a pirate den. Bounties and surveys are handed in at a port of the class that issued them (and the same owner). Null for outposts and nests. */
export const stationClass = (port: Port): string | null => (port.kind === 'den' ? 'den' : port.station ?? null);

/** The role a port kind fixes, or null. */
const KIND_ROLE: Record<PortKind, FleetRole | null> = { station: null, den: 'pirate', depot: 'patrol', outpost: 'miner', nest: 'raider' };

/** The node a port id belongs to. */
export const portNode = (id: string): string => id.slice(0, id.indexOf('#'));

/** What kind of port a structure is for its owner, or null when it is none. */
function kindOf(def: StructureDef, owner: GalaxyFactionDef): PortKind | null {
  const groups = owner.fleet?.groups;
  if (!groups) return null;
  if (def.kind === 'station') {
    if (owner.kind === 'pirates') return groups.pirate ? 'den' : null;
    if (owner.kind === 'government' && def.station === 'military') return groups.patrol ? 'depot' : null;
    return 'station';
  }
  if (def.kind === 'asteroids') return groups.miner ? 'outpost' : null;
  return owner.kind === 'rogue' && groups.raider ? 'nest' : null;
}

/** The ports of a node (`hub`: its sector is a hub, so its ports are bigger). */
export function portsOf(seed: number, content: GalaxyContent, node: NodeData, hub: boolean): Port[] {
  const out: Port[] = [];
  node.structures.forEach((s, i) => {
    const def = content.structures[s.def];
    const ownerId = s.owner ?? (def?.kind === 'derelict' ? node.faction : null);
    const owner = ownerId ? content.factions[ownerId] : undefined;
    if (!def || !ownerId || !owner) return;
    const kind = kindOf(def, owner);
    if (!kind) return;
    const id = `${node.id}#${i}`;
    const size = Math.min(3, 1 + (unit(seed, strHash(id), 71) < 0.5 ? 1 : 0) + (hub ? 1 : 0)) as 1 | 2 | 3;
    out.push({
      id, node: node.id, kind, size, owner: ownerId, role: KIND_ROLE[kind], trade: !!def.services?.includes('trade'),
      ...(def.kind === 'station' ? { station: def.station ?? 'trade' } : {}),
    });
  });
  return out;
}
