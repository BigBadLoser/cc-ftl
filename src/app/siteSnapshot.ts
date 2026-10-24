import { CrewC, ShipC, siteIds, siteStatus, type Sim, type SiteBlock, type SiteStatus } from '../sim';
import { shipGrid } from '../sim/regions';
import type { UiSite } from '../ui/api';

const nameOf = (sim: Sim, item: string): string => sim.content.items[item]?.name ?? item;
const crewName = (sim: Sim, id: number): string => sim.world.get(id, CrewC)?.name ?? 'Crew';

/** The words for a block ("Missing 6 metal", "Nobody can reach the site"). */
export function blockText(sim: Sim, b: SiteBlock): string {
  switch (b.kind) {
    case 'noBuilder': return 'No builder free: nobody is set to construct';
    case 'siteUnreachable': return 'Nobody can reach the site';
    case 'noStock': return `Missing ${b.count} ${nameOf(sim, b.item).toLowerCase()}`;
    case 'stockUnreachable': return `Nobody can reach the ${nameOf(sim, b.item).toLowerCase()}`;
    case 'crewInWay': return 'Waiting for crew to step off the site';
  }
}

function uiSite(sim: Sim, s: SiteStatus): UiSite {
  const g = shipGrid(sim, s.ship);
  const waiting = s.materials.some((m) => m.missing > 0);
  return {
    id: s.id, ship: s.ship, def: s.def, name: sim.content.modules[s.def]?.name ?? s.def, x: s.x, y: s.y,
    local: { x: s.x - (g?.x0 ?? 0), y: s.y - (g?.y0 ?? 0) }, w: s.w, h: s.h,
    frac: Math.round(s.frac * 1000) / 1000, etaSec: s.etaSec === null ? null : Math.ceil(s.etaSec),
    state: s.block ? 'blocked' : waiting ? 'waiting' : 'building',
    reason: s.block ? blockText(sim, s.block) : '',
    materials: s.materials.map((m) => ({ ...m, name: nameOf(sim, m.item) })),
    builders: s.builders.map((id) => ({ id, name: crewName(sim, id) })),
    haulers: [...new Set(s.haulers)].map((id) => ({ id, name: crewName(sim, id) })),
  };
}

/** Plain-data list of the player's module construction sites. Reads the sim, never mutates it. */
export function buildSites(sim: Sim): UiSite[] {
  const out: UiSite[] = [];
  for (const id of siteIds(sim)) {
    const s = siteStatus(sim, id);
    if (s && sim.world.get(s.ship, ShipC)?.faction === 'player') out.push(uiSite(sim, s));
  }
  return out;
}
