import {
  CombatC, CrewC, IonC, ModuleC, ShipC, WeaponC, ammoCount, operatorOf, shieldRechargeSec, FTL_CHARGE_SEC, type Sim, type Target,
} from '../sim';
import type { UiCombat, UiConsole, UiShipCombat, UiShipModule, UiWeapon } from '../ui/api';
import { shipIdOf } from '../sim/regions';
import { homeShip } from '../sim/index';

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function label(sim: Sim, t: Target | null): string | null {
  if (!t) return null;
  const ship = sim.world.get(t.ship, ShipC);
  const m = t.moduleId ? sim.world.get(t.moduleId, ModuleC) : undefined;
  const mod = m && sim.content.modules[m.def]?.name;
  return `${ship?.name ?? 'Ship'}${mod ? `: ${mod}` : ''}`;
}

function modulesOf(sim: Sim, shipId: number): UiShipModule[] {
  const out: UiShipModule[] = [];
  for (const id of sim.world.query(ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const def = m && sim.content.modules[m.def];
    if (!m || !def || shipIdOf(sim, m) !== shipId) continue;
    const kind = def.weapon ? 'weapon' : def.shieldGen ? 'shield' : def.engine ? 'engine' : 'other';
    if (kind === 'other' && !def.console) continue;
    out.push({ id, name: def.name, kind, hp: Math.round(m.hp), maxHp: def.maxHp, ion: sim.world.has(id, IonC) });
  }
  return out;
}

function snapOf(sim: Sim, id: number): UiShipCombat | null {
  const ship = sim.world.get(id, ShipC);
  const c = sim.world.get(id, CombatC);
  if (!ship || !c) return null;
  const need = shieldRechargeSec(sim, id);
  const t = c.target;
  return {
    ship: id, name: ship.name, state: ship.state, integrity: round(ship.integrity),
    shield: { layers: c.shield.layers, max: c.shield.max, progress: Number.isFinite(need) ? round(Math.min(1, c.shield.timer / need)) : 0 },
    evasion: round(c.evasion), hold: c.hold, ftl: round(c.ftl, 1), ftlMax: FTL_CHARGE_SEC,
    target: t ? { ship: t.ship, moduleId: t.moduleId, label: label(sim, t) ?? '' } : null,
    modules: modulesOf(sim, id),
  };
}

/** Plain-data combat state for the overlay: the player's weapons, consoles and shields, and the hostile ships. Reads the sim only. */
export function buildCombat(sim: Sim, playerGrid = homeShip(sim)): UiCombat {
  let player: UiCombat['player'] = null;
  const enemies: UiShipCombat[] = [];
  const me = sim.world.get(playerGrid, ShipC);
  for (const id of sim.world.query(ShipC, CombatC)) {
    const s = sim.world.get(id, ShipC);
    const base = snapOf(sim, id);
    if (!s || !base) continue;
    if (id === playerGrid) {
      const weapons: UiWeapon[] = [];
      const consoles: UiConsole[] = [];
      for (const mid of sim.world.query(ModuleC)) {
        const m = sim.world.get(mid, ModuleC);
        const def = m && sim.content.modules[m.def];
        if (!m || !def || shipIdOf(sim, m) !== playerGrid) continue;
        const w = sim.world.get(mid, WeaponC);
        if (w && def.weapon) {
          const ammo = sim.content.weapons?.[def.weapon]?.ammo;
          weapons.push({
            id: mid, name: def.name, charge: round(w.charge), ammo: ammo ? ammoCount(sim, playerGrid, ammo) : null,
            ion: sim.world.has(mid, IonC), powered: m.powered && m.enabled && m.hp > 0, target: label(sim, w.target), targetModuleId: w.target?.moduleId ?? 0,
          });
        }
        if (def.console) {
          const op = operatorOf(sim, mid);
          consoles.push({
            id: mid, kind: def.console, name: def.name, powered: m.powered && m.enabled && m.hp > 0,
            operator: op ? (sim.world.get(op, CrewC)?.name ?? null) : null,
          });
        }
      }
      player = { ...base, weapons, consoles };
    } else if (s.faction === 'hostile' && s.state !== 'fled') enemies.push(base);
  }
  if (me) enemies.sort((a, b) => dist(sim, me, a.ship) - dist(sim, me, b.ship));
  return { inCombat: sim.sector.inCombat, player, enemies };
}

function dist(sim: Sim, me: { x: number; y: number }, ship: number): number {
  const s = sim.world.get(ship, ShipC);
  return s ? Math.hypot(s.x - me.x, s.y - me.y) : Infinity;
}
