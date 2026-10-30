import { AssignmentC, CombatC, CrewC, DeadC, DownedC, HealthC, JobC, ModuleC, PositionC, ShipC, WeaponC, type Sim } from '../sim';
import { footprintTiles } from '../sim/modules/footprint';
import { playerCrewAboard } from '../sim/boarding/aboard';
import { RecallC, SabotageOrderC } from '../sim/boarding/components';
import { FighterC } from '../sim/fight/components';
import { homeShip } from '../sim/index';
import { shipGrid, shipIdOf } from '../sim/regions';
import { VehicleC } from '../sim/vehicles/components';
import type { UiBoarding } from '../ui/api';

/** Plain-data boarding state for the HUD, one entry per hostile ship that holds player crew. Reads the sim only. */
export function buildBoarding(sim: Sim): UiBoarding[] {
  const home = homeShip(sim);
  const out: UiBoarding[] = [];
  for (const id of sim.world.query(ShipC)) {
    const ship = sim.world.get(id, ShipC);
    if (!ship || id === home || ship.faction === 'player') continue;
    const aboard = playerCrewAboard(sim, id);
    // A recalled party stays listed ('returning') while the shuttle flies it home; the recall ends when it docks or stows.
    const flying: number[] = [];
    for (const v of sim.world.query(VehicleC)) {
      const rc = sim.world.get(v, RecallC);
      if (rc && rc.ship === id) for (const c of rc.crew) if (sim.world.has(c, CrewC) && !sim.world.has(c, DeadC) && !aboard.crew.includes(c)) flying.push(c);
    }
    if (!aboard.crew.length && !flying.length) continue;
    const name = (c: number): string => sim.world.get(c, CrewC)?.name ?? 'Crew';
    const returning = new Set<number>();
    for (const v of sim.world.query(VehicleC)) for (const c of sim.world.get(v, RecallC)?.crew ?? []) returning.add(c);
    const party: UiBoarding['party'] = aboard.crew.map((c) => {
      const jobId = sim.world.get(c, AssignmentC)?.jobId;
      const job = jobId ? sim.world.get(jobId, JobC) : undefined;
      const order = sim.world.get(c, SabotageOrderC);
      const h = sim.world.get(c, HealthC);
      const state = sim.world.has(c, DownedC) ? 'down' : returning.has(c) ? 'returning' : job?.kind === 'sabotage' ? 'sabotage'
        : order ? 'paused' : (sim.world.get(c, FighterC)?.mode ?? 'idle') !== 'idle' ? 'fighting' : 'holding';
      return { id: c, name: name(c), hp: h ? Math.round((h.hp / Math.max(1, h.max)) * 100) / 100 : 1, state, module: order?.module ?? job?.target ?? 0 };
    });
    for (const c of flying) party.push({ id: c, name: name(c), hp: 1, state: 'returning', module: 0 });
    // One row per module under attack: it is "active" while any boarder works on it, "paused" when all of them have broken off.
    const sabotage: UiBoarding['sabotage'] = [];
    for (const p of party) {
      const m = p.module ? sim.world.get(p.module, ModuleC) : undefined;
      if (!m || (p.state !== 'sabotage' && p.state !== 'paused' && p.state !== 'fighting')) continue;
      const row = sabotage.find((s) => s.module === p.module) ?? (sabotage.push({
        module: p.module, name: sim.content.modules[m.def]?.name ?? 'Module', hp: Math.round(m.hp), maxHp: sim.content.modules[m.def]?.maxHp ?? m.hp, state: 'paused', crew: [], crewIds: [],
      }), sabotage[sabotage.length - 1]!);
      row.crew.push(p.name);
      row.crewIds.push(p.id);
      if (p.state === 'sabotage') row.state = 'active';
    }
    // Friendly fire: the player's committed aims (ship-wide and per weapon) that land on a room or tile where boarders stand.
    const rooms = new Set(aboard.rooms);
    const grid = shipGrid(sim, id);
    const standing = new Set(aboard.tiles.map((t) => t.y * 100000 + t.x));
    const roomAt = (x: number, y: number): number => (grid?.has('room') && grid.inBounds(x, y) ? grid.get('room', x, y) : 0);
    const fireOn: UiBoarding['fireOn'] = [];
    const aim = (t: { ship: number; moduleId: number; tile?: { x: number; y: number } } | null | undefined, by: string): void => {
      if (!t || t.ship !== id) return;
      const m = t.moduleId ? sim.world.get(t.moduleId, ModuleC) : undefined;
      const def = m && sim.content.modules[m.def];
      const tiles = m && def ? footprintTiles(def, m.x, m.y, m.rot) : t.tile ? [t.tile] : [];
      const hit = new Set<number>();
      for (const tl of tiles) {
        const r = roomAt(tl.x, tl.y);
        for (const p of aboard.crew) {
          const pos = sim.world.get(p, PositionC);
          if (!pos) continue;
          const px = Math.round(pos.toX), py = Math.round(pos.toY);
          if ((r && roomAt(px, py) === r && rooms.has(r)) || (tl.x === px && tl.y === py && standing.has(py * 100000 + px))) hit.add(p);
        }
      }
      if (!hit.size) return;
      const at = def?.name ?? 'a room';
      const seen = fireOn.find((f) => f.at === at);
      if (seen) seen.by = 'Your weapons'; // several guns on one spot are one warning
      else fireOn.push({ by, at, crew: [...hit].map(name) });
    };
    const mine = sim.world.get(home, CombatC);
    aim(mine?.target, 'Your guns');
    for (const w of sim.world.query(WeaponC, ModuleC)) {
      const m = sim.world.get(w, ModuleC);
      if (m && shipIdOf(sim, m) === home) aim(sim.world.get(w, WeaponC)?.target, sim.content.modules[m.def]?.name ?? 'Weapon');
    }
    const docked = sim.world.query(VehicleC).some((v) => {
      const veh = sim.world.get(v, VehicleC);
      return veh?.state === 'docked' && shipIdOf(sim, sim.world.get(veh.dock, ModuleC)) === id && veh.homeShip === home;
    });
    out.push({ ship: id, party, sabotage, fireOn, canRecall: docked && party.some((p) => p.state !== 'returning' && p.state !== 'down')});
  }
  return out;
}
