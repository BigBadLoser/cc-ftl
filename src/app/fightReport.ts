import { homeShip } from '../sim/index';
import { shipIdOf } from '../sim/regions';
import { AllegianceC, CrewC, ModuleC, ShipC, factionsHostile, type Sim, type SimEvent } from '../sim';
import type { Ship } from '../sim/combat/components';
import { isDormant } from '../sim/combat/dormant';
import { TICK_HZ } from '../sim/time';
import type { UiFightReport, UiFightLine } from '../ui/api';
import type { LogEntry } from './logText';
import { crewSubject, crewTile, shipSubject, tileAt } from './subjects';

/** What the fight report is collected from: the events of one fight, with names read from the sim as they happen (UI-side, read-only). */
interface Tracker {
  start: number;
  hullBefore: number;
  /** The hull as of the last tick of the fight (after a jump away the home ship is a different grid). */
  hullNow: number;
  enemyHull: number | null;
  enemyCrew: number;
  enemy: number;
  /** Read while the enemy still exists: after a jump or a wreck the entity may be gone. */
  enemyName: string;
  outcome: UiFightReport['outcome'];
  lost: UiFightLine[];
  /** Home modules hit, by id: name and tile as of the hit (a jump away lifts the ship's modules out of the world before the fight ends). */
  damaged: Map<number, { name: string; x: number; y: number }>;
  down: Map<number, UiFightLine>;
  dead: UiFightLine[];
  enemyLost: UiFightLine[];
  ammo: Map<string, number>;
  prize: boolean;
  /** The player's ships as the fight began: a capture flips the prize's faction before this frame's events are read. */
  ours: Set<number>;
  /** The player's crew seen during the fight, with names: a jump away detaches them before the frame's last deaths are read. */
  crew: Map<number, string>;
  /** The player's home ship as the fight began: a jump away detaches it before the frame's last shots are read. */
  home: number;
}

export interface FightReporter {
  /** Feed a tick's events. Returns the finished report (and its one-line summary) on the tick the fight ends, else null. */
  onEvents(events: readonly SimEvent[]): { report: UiFightReport; summary: LogEntry } | null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The alert and log line for a report: "4 modules lost, 2 crew down". Without losses or kills it falls back to the lesser costs (hull, damaged
 * modules, ammo), so any fight that left a mark gets a report. Null when the fight cost nothing either way.
 */
export function fightLine(r: UiFightReport): LogEntry | null {
  const lost: string[] = [];
  if (r.lost.length) lost.push(`${plural(r.lost.length, 'module', 'modules')} lost`);
  if (r.dead.length) lost.push(`${r.dead.length} crew dead`);
  if (r.down.length) lost.push(`${r.down.length} crew down`);
  const won: string[] = [];
  if (r.enemyLost.length) won.push(`${plural(r.enemyLost.length, 'enemy module', 'enemy modules')} destroyed`);
  if (r.enemyCrew) won.push(`${r.enemyCrew} enemy crew killed`);
  if (r.prize) won.push(`${r.prize} captured`);
  if (!lost.length && !won.length) {
    const hull = Math.round((r.hullBefore - r.hullAfter) * 100);
    if (hull > 0) lost.push(`hull −${hull}%`);
    if (r.damaged.length) lost.push(`${plural(r.damaged.length, 'module', 'modules')} damaged`);
    const shots = r.ammo.reduce((n, a) => n + a.n, 0);
    if (!lost.length && !shots) return null;
    if (shots) won.push(r.ammo.map((a) => `${a.n} ${a.name.toLowerCase()}${a.n === 1 ? '' : 's'} spent`).join(', '));
  }
  return { kind: 'combat', tone: lost.length ? 'bad' : 'good', text: `Fight over: ${[...lost, ...won].join(', ')}` };
}

export function createFightReporter(sim: Sim): FightReporter {
  let t: Tracker | null = null;
  const home = () => homeShip(sim);
  const ours = (c: Tracker, crew: number) => c.crew.has(crew) || sim.world.get(crew, AllegianceC)?.faction === 'player';
  const crewName = (c: Tracker, crew: number) => sim.world.get(crew, CrewC)?.name ?? c.crew.get(crew) ?? 'Crew';
  const seeCrew = (c: Tracker) => {
    for (const id of sim.world.query(CrewC, AllegianceC)) if (sim.world.get(id, AllegianceC)?.faction === 'player') c.crew.set(id, sim.world.get(id, CrewC)?.name ?? 'Crew');
  };
  const modName = (def: string) => sim.content.modules[def]?.name ?? 'Module';
  const hull = () => sim.world.get(home(), ShipC)?.integrity ?? 0;
  /** The enemy at the start: a hostile still in the fight by the rule combatStateSystem uses (no wreck, fled ship or dormant den), else 0. */
  const enemyOf = (): number => {
    for (const id of sim.world.query(ShipC)) {
      const s = sim.world.get(id, ShipC);
      if (s && (s.state === 'active' || s.state === 'disabled') && !isDormant(s) && factionsHostile(s.faction, 'player')) return id;
    }
    return 0;
  };
  /** The hull as the fight ends: a jump away has already lifted the ship into the hyperspace packet, so read it there. */
  const finalHull = (c: Tracker): number => {
    const p = sim.sector.state === 'hyperspace' ? sim.sector.packet : undefined;
    const lifted = p?.entities.find((x) => x.id === p.ship)?.c[ShipC.name] as Ship | undefined;
    return lifted?.integrity ?? sim.world.get(c.home, ShipC)?.integrity ?? c.hullNow;
  };
  const fresh = (): Tracker => {
    const c: Tracker = {
      start: sim.tick, hullBefore: hull(), hullNow: hull(), enemyHull: null, enemyCrew: 0, enemy: enemyOf(), enemyName: '', outcome: 'ended', lost: [], damaged: new Map(), down: new Map(), dead: [], enemyLost: [],
      ammo: new Map(), prize: false, ours: new Set(sim.world.query(ShipC).filter((id) => sim.world.get(id, ShipC)?.faction === 'player')), crew: new Map(), home: home(),
    };
    seeCrew(c);
    return c;
  };
  // A save loaded mid-fight: `combat.started` will not come, so track the rest of this one from now.
  if (sim.sector.inCombat) t = fresh();

  function note(e: SimEvent, c: Tracker): void {
    const known = c.enemy;
    noteEvent(e, c);
    if (c.enemy && c.enemy !== known) {
      // Another ship is now the one the report is about (the one an outcome names): its name and hull replace the last one's.
      const s = sim.world.get(c.enemy, ShipC);
      c.enemyName = s?.name ?? '';
      c.enemyHull = s?.integrity ?? null;
    } else if (c.enemy && !c.enemyName) c.enemyName = sim.world.get(c.enemy, ShipC)?.name ?? '';
  }

  function noteEvent(e: SimEvent, c: Tracker): void {
    switch (e.type) {
      case 'module.destroyed': {
        const m = sim.world.get(e.moduleId, ModuleC);
        if (c.ours.has(e.ship)) c.lost.push({ name: modName(e.def), subject: m ? tileAt(m.x, m.y) : shipSubject(sim, e.ship) });
        else { c.enemy ||= e.ship; c.enemyLost.push({ name: modName(e.def), subject: shipSubject(sim, e.ship) }); }
        break;
      }
      case 'projectile.hit':
        if (!c.ours.has(e.ship)) c.enemy ||= e.ship;
        if (e.moduleId > 0 && e.ship === c.home) {
          const m = sim.world.get(e.moduleId, ModuleC);
          if (m) c.damaged.set(e.moduleId, { name: modName(m.def), x: m.x, y: m.y });
        }
        break;
      case 'weapon.fired': {
        if (!c.ours.has(e.ship)) c.enemy ||= e.ship;
        const item = e.ship === c.home ? sim.content.weapons?.[e.weapon]?.ammo : undefined;
        if (item) c.ammo.set(item, (c.ammo.get(item) ?? 0) + 1);
        break;
      }
      case 'crew.downed':
        if (ours(c, e.crew)) c.down.set(e.crew, { name: crewName(c, e.crew), subject: crewSubject(sim, e.crew) });
        break;
      case 'crew.died':
        if (ours(c, e.crew)) {
          c.down.delete(e.crew);
          c.dead.push({ name: crewName(c, e.crew), subject: crewTile(sim, e.crew) });
        } else c.enemyCrew++;
        break;
      case 'ship.destroyed': if (c.ours.has(e.ship)) c.outcome = 'lost'; else { c.enemy = e.ship; c.outcome = 'destroyed'; } break;
      case 'ship.fled': if (!c.ours.has(e.ship)) c.enemy = e.ship; c.outcome = c.ours.has(e.ship) ? 'youFled' : 'fled'; break;
      case 'ship.captured': if (e.by === 'player') { c.enemy = e.ship; c.outcome = 'captured'; c.prize = true; } break;
      case 'ship.disabled': if (!c.ours.has(e.ship) && c.outcome === 'ended') { c.enemy = e.ship; c.outcome = 'disabled'; } break;
      default: break;
    }
  }

  function finish(c: Tracker): UiFightReport {
    const itemName = (id: string) => sim.content.items[id]?.name ?? id;
    const gone = new Set(c.lost.map((l) => l.name + '|' + (l.subject?.kind === 'tile' ? `${l.subject.x},${l.subject.y}` : '')));
    const damaged: UiFightLine[] = [];
    for (const [id, { name, x, y }] of c.damaged) {
      if (gone.has(name + '|' + `${x},${y}`)) continue;
      // Not in the world: lifted with the ship by a jump away (a destroyed one is in `gone`), so it stands as recorded.
      const m = sim.world.get(id, ModuleC);
      if (m && (m.hp <= 0 || shipIdOf(sim, m) !== c.home)) continue;
      damaged.push({ name, subject: tileAt(x, y) });
    }
    const es = c.enemy ? sim.world.get(c.enemy, ShipC) : undefined;
    return {
      outcome: c.outcome, enemy: es?.name ?? (c.enemyName || 'Enemy'), seconds: Math.round((sim.tick - c.start) / TICK_HZ),
      hullBefore: c.hullBefore, hullAfter: c.hullNow, enemyHull: c.outcome === 'destroyed' ? 0 : (es?.integrity ?? c.enemyHull), enemyCrew: c.enemyCrew, lost: c.lost, damaged, down: [...c.down.values()], dead: c.dead, enemyLost: c.enemyLost,
      ammo: [...c.ammo].map(([item, n]) => ({ name: itemName(item), n })), prize: c.prize ? (es?.name ?? 'Prize') : null,
    };
  }

  return {
    onEvents(events) {
      let done: { report: UiFightReport; summary: LogEntry } | null = null;
      for (const e of events) {
        if (e.type === 'combat.started') t = fresh();
        else if (e.type === 'combat.ended') {
          // The player's flee ends the fight by jumping out: the sector is in hyperspace when `combat.ended` comes (see sector/jump.ts).
          if (t && t.outcome === 'ended' && sim.sector.state === 'hyperspace') t.outcome = 'youFled';
          if (t) {
            t.hullNow = finalHull(t);
            const report = finish(t);
            const summary = fightLine(report);
            if (summary) done = { report, summary };
          }
          t = null;
        } else if (t) note(e, t);
      }
      if (t) {
        seeCrew(t);
        t.hullNow = hull();
        const es = t.enemy ? sim.world.get(t.enemy, ShipC) : undefined;
        if (es) t.enemyHull = es.integrity;
        if (t.enemy && !t.enemyName) t.enemyName = sim.world.get(t.enemy, ShipC)?.name ?? '';
      }
      return done;
    },
  };
}
