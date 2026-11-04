import { CrewC, ModuleC, PositionC, Struct, homeShip, placementError, type Command, type Sim } from '../sim';
import { isTileWalkable } from '../sim/modules/walk';
import { shipGrid, shipIdOf } from '../sim/regions';

/**
 * `?scenario=drones`: playtest drones (#318). Two drone bays beside the AI core, three drones in storage (two repair, one medic: the
 * Mk I core lets two out at once, so one waits on its pad), a damaged module, a small fire, one crew member downed and one wounded.
 * The bays take the drones from storage on their own, and the drones go to work. Set through debug commands.
 */
export function droneScenarioCommands(sim: Sim): Command[] {
  const ship = homeShip(sim);
  const grid = shipGrid(sim, ship);
  if (!grid) return [];
  const out: Command[] = [];
  // Two bays near the AI core (in the starter's AI room) wherever a 2x1 fits without walling off any floor (a bay is solid to walkers).
  // A ship without a core gets one first (Mk I), placed the same way from its middle.
  const core = sim.world.query(ModuleC).map((id) => sim.world.get(id, ModuleC)).find((m) => !!m && !!sim.content.modules[m.def]?.aiCore && shipIdOf(sim, m) === ship);
  const blocked = new Set<string>();
  const start = sim.world.query(CrewC, PositionC).map((id) => sim.world.get(id, PositionC)).find((p) => !!p && shipIdOf(sim, p) === ship);
  const reach = (): number => {
    if (!start) return 0;
    const seen = new Set<string>([`${start.x},${start.y}`]);
    const q = [{ x: start.x, y: start.y }];
    while (q.length > 0) {
      const t = q.pop() as { x: number; y: number };
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = { x: t.x + dx, y: t.y + dy };
        const k = `${n.x},${n.y}`;
        if (seen.has(k) || blocked.has(k) || !isTileWalkable(sim, grid, n.x, n.y)) continue;
        seen.add(k);
        q.push(n);
      }
    }
    return seen.size;
  };
  let base = reach();
  /** The nearest spot to (cx, cy) a w x h module of `def` fits without walling anything off; its tiles are then taken. */
  const place = (def: string, w: number, h: number, cx: number, cy: number): { x: number; y: number } | null => {
    for (let r = 1; r < 14; r++) {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let x = cx - r; x <= cx + r; x++) {
          if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || placementError(sim, ship, def, x, y, 0)) continue;
          // Open floor along its front (south and east), so no wall hides it in the default view.
          const front = [...Array.from({ length: w }, (_, i) => ({ x: x + i, y: y + h })), ...Array.from({ length: h }, (_, j) => ({ x: x + w, y: y + j }))];
          if (!front.every((t) => isTileWalkable(sim, grid, t.x, t.y))) continue;
          const tiles: string[] = [];
          for (let j = -1; j <= h; j++) for (let i = -1; i <= w; i++) tiles.push(`${x + i},${y + j}`);
          if (tiles.some((k) => blocked.has(k))) continue; // keep a gap to what this scenario already placed
          const own = tiles.filter((_, n) => n % (w + 2) > 0 && n % (w + 2) <= w && n >= w + 2 && n < (w + 2) * (h + 1));
          for (const k of own) blocked.add(k);
          const now = reach();
          if (now < base - own.length) {
            for (const k of own) blocked.delete(k);
            continue;
          }
          base = now;
          return { x, y };
        }
      }
    }
    return null;
  };
  let cx = core?.x ?? Math.floor(grid.x0 + grid.width / 2), cy = core?.y ?? Math.floor(grid.y0 + grid.height / 2);
  if (!core) {
    const at = place('module.aiCore', 2, 2, cx, cy);
    if (at) {
      out.push({ type: 'debug.spawnModule', ship, def: 'module.aiCore', x: at.x, y: at.y, rot: 0 });
      [cx, cy] = [at.x, at.y];
    }
  }
  const spots = [place('module.droneBay', 2, 1, cx, cy), place('module.droneBay', 2, 1, cx, cy)].filter((s): s is { x: number; y: number } => !!s);
  for (const s of spots) out.push({ type: 'debug.spawnModule', ship, def: 'module.droneBay', x: s.x, y: s.y, rot: 0 });
  out.push({ type: 'debug.giveItems', item: 'item.drone_repair', count: 2 });
  out.push({ type: 'debug.giveItems', item: 'item.drone_medic', count: 1 });

  // Hurt crew: the first is downed, the second wounded.
  const crew = sim.world.query(CrewC, PositionC).filter((id) => sim.world.get(id, CrewC)?.species === 'species.human' && shipIdOf(sim, sim.world.get(id, PositionC)) === ship);
  if (crew[0] !== undefined) out.push({ type: 'debug.setCrew', id: crew[0], hp: 0 });
  if (crew[1] !== undefined) out.push({ type: 'debug.setCrew', id: crew[1], hp: 35 });

  // A damaged module (the shield console, else any with hp) and a small fire on a bare floor tile far from the crew.
  const shield = sim.world.query(ModuleC).find((id) => sim.content.modules[sim.world.get(id, ModuleC)?.def ?? '']?.console === 'shields' && shipIdOf(sim, sim.world.get(id, ModuleC)) === ship);
  const m = shield && sim.world.get(shield, ModuleC);
  if (shield && m) out.push({ type: 'debug.setModuleHp', id: shield, hp: Math.round((sim.content.modules[m.def]?.maxHp ?? 100) * 0.4) });
  const floor: { x: number; y: number }[] = [];
  for (let y = grid.y0; y < grid.y0 + grid.height; y++) {
    for (let x = grid.x0; x < grid.x0 + grid.width; x++) if (grid.get('struct', x, y) === Struct.Floor && !grid.get('module', x, y) && !blocked.has(`${x},${y}`)) floor.push({ x, y });
  }
  const fire = floor.find((t) => t.x - grid.x0 === 13 && t.y - grid.y0 === 10) ?? floor[Math.floor(floor.length / 2)];
  if (fire) out.push({ type: 'debug.ignite', ship, x: fire.x, y: fire.y });
  return out;
}
