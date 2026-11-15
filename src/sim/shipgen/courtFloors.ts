import { Finish, type FinishKind } from '../structure';
import { footprintTiles } from '../modules/footprint';
import type { Layout } from './layout';

/** Modules a plaza pays with market tile round them (stalls, tables, galleys). */
const MARKET_PIECES: readonly string[] = ['module.cargo_container', 'module.mess_table', 'module.galley', 'module.storage_pallet'];
/** Modules a garden beds with soil round them (planters, tree beds, hydroponics). */
const SOIL_PIECES: readonly string[] = ['module.planter_large', 'module.tree_large', 'module.hydroponics'];

/**
 * Paves the station courts (rooms of role plaza, garden, drill) with floor finishes, once they are furnished: a plaza in
 * walkway paving with market tile round its stalls, a garden in walkway paving with soil round its beds and trees, a drill
 * hall in tread plate. Looks only. Floor tiles only (doors and walls keep the plain deck).
 */
export function paintCourts(lay: Layout): void {
  const base: Partial<Record<string, FinishKind>> = { plaza: Finish.Walk, garden: Finish.Walk, drill: Finish.Tread };
  const around = (room: number, pieces: readonly string[], kind: FinishKind): void => {
    for (const m of lay.modules) {
      const def = lay.defs[m.def];
      if (!def || !pieces.includes(m.def)) continue;
      for (const t of footprintTiles(def, m.x, m.y, m.rot)) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = t.x + dx, y = t.y + dy;
          if (lay.inBounds(x, y) && lay.roomOf[y * lay.w + x] === room && lay.cells[y * lay.w + x] === '_') lay.finish[y * lay.w + x] = kind;
        }
      }
    }
  };
  lay.roles.forEach((role, room) => {
    const kind = base[role];
    if (kind === undefined) return;
    for (let i = 0; i < lay.cells.length; i++) if (lay.roomOf[i] === room && lay.cells[i] === '_') lay.finish[i] = kind;
    if (role === 'plaza') around(room, MARKET_PIECES, Finish.Market);
    else if (role === 'garden') around(room, SOIL_PIECES, Finish.Soil);
  });
}
