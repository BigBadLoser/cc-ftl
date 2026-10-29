import {
  CombatC, CrewC, IonC, ModuleC, ShipC, WeaponC, ammoCount, isDormant, operatorOf, shieldRechargeSec, weaponsIdleReason, FTL_CHARGE_SEC,
  type Combat, type Sim, type Target,
} from '../sim';
import type { UiEnemyWeapon, UiCombat, UiConsole, UiShipCombat, UiShipModule, UiWeapon } from '../ui/api';
import { HEAT_MAX } from '../sim/combat/heatTuning';
import { shieldsDown } from '../sim/combat/heat';
import { TICK_HZ } from '../sim/time';
import { shipIdOf } from '../sim/regions';
import { factionsHostile } from '../sim/combat/factions';
import { commitCharge } from '../sim/combat/commit';
import { homeShip } from '../sim/index';

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function label(sim: Sim, t: Target | null): string | null {
  if (!t) return null;
  const ship = sim.world.get(t.ship, ShipC);
  const m = t.moduleId ? sim.world.get(t.moduleId, ModuleC) : undefined;
  const mod = m && sim.content.modules[m.def]?.name;
  return `${ship?.name ?? 'Ship'}${mod ? `: ${mod}` : t.tile ? `: tile ${t.tile.x - (ship?.x ?? 0)}, ${t.tile.y - (ship?.y ?? 0)}` : ''}`;
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

function enemyWeapons(sim: Sim, shipId: number): UiEnemyWeapon[] {
  const out: UiEnemyWeapon[] = [];
  for (const id of sim.world.query(WeaponC, ModuleC)) {
    const m = sim.world.get(id, ModuleC);
    const w = sim.world.get(id, WeaponC);
    const def = m && sim.content.modules[m.def];
    const wd = def?.weapon ? sim.content.weapons?.[def.weapon] : undefined;
    if (!m || !w || !def || !wd || shipIdOf(sim, m) !== shipId) continue;
    out.push({
      id, name: def.name, charge: round(w.charge), commitAt: round(commitCharge(wd.chargeSec)), committed: !!w.commit,
      stalled: !m.powered || m.hp <= 0 || sim.world.has(id, IonC),
    });
  }
  return out;
}

function heatOf(c: Combat): UiShipCombat['heat'] {
  const sec = (ticks: number): number => round(ticks / TICK_HZ, 1);
  const oc = (o: { left: number; cooldown: number }) => ({ left: sec(o.left), cooldown: sec(o.cooldown) });
  const h = c.heat;
  return {
    value: round(h.value, 1), max: HEAT_MAX, lockout: sec(h.lockout), venting: sec(h.vent), cooling: shieldsDown(c) || h.vent > 0,
    overcharge: { weapons: oc(h.overcharge.weapons), shields: oc(h.overcharge.shields), engines: oc(h.overcharge.engines) },
  };
}

function snapOf(sim: Sim, id: number): UiShipCombat | null {
  const ship = sim.world.get(id, ShipC);
  const c = sim.world.get(id, CombatC);
  if (!ship || !c) return null;
  const need = shieldRechargeSec(sim, id);
  const t = c.target;
  return {
    ship: id, name: ship.name, x: ship.x, y: ship.y, state: ship.state, integrity: round(ship.integrity),
    shield: { layers: c.shield.layers, max: c.shield.max, progress: Number.isFinite(need) ? round(Math.min(1, c.shield.timer / need)) : 0 },
    heat: heatOf(c),
    evasion: round(c.evasion), hold: c.hold, ftl: round(c.ftl, 1), ftlMax: FTL_CHARGE_SEC,
    target: t ? { ship: t.ship, moduleId: t.moduleId, label: label(sim, t) ?? '', ...(t.tile ? { tile: t.tile } : {}) } : null,
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
            ion: sim.world.has(mid, IonC), powered: m.powered && m.enabled && m.hp > 0, target: label(sim, w.target), targetModuleId: w.target?.moduleId ?? 0, targetTile: w.target?.tile ?? null,
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
      player = { ...base, weapons, consoles, idle: weaponsIdleReason(sim, playerGrid) };
    } else if (factionsHostile(s.faction, 'player') && s.state !== 'fled') {
      // The same test as the sim's combat state (combatStateSystem): every faction at war with the player (hostile, and the
      // rogue AI and aliens, at war with everyone). Listing only 'hostile' left the panel empty in a fight with a rogue ship.
      enemies.push(isDormant(s) ? { ...base, dormant: true } : { ...base, charges: enemyWeapons(sim, id) });
    }
  }
  if (me) enemies.sort((a, b) => dist(sim, me, a.ship) - dist(sim, me, b.ship));
  // A ship in hyperspace or waiting to deploy is not in any fight, whatever is archived or placed in the empty sector.
  if (sim.sector.state !== 'active') return { inCombat: false, player: null, enemies: [] };
  return { inCombat: sim.sector.inCombat, player, enemies };
}

function dist(sim: Sim, me: { x: number; y: number }, ship: number): number {
  const s = sim.world.get(ship, ShipC);
  return s ? Math.hypot(s.x - me.x, s.y - me.y) : Infinity;
}
