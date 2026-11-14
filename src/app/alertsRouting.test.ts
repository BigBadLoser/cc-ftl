import logSrc from './logText.ts?raw';
import boardingSrc from './boardingText.ts?raw';
import { describe, expect, it } from 'vitest';
import { AllegianceC, CrewC, DeadC, DownedC, ModuleC, PositionC, ShipC, newGame, type Sim } from '../sim';
import { homeShip, isOnOurSide } from '../sim/index';
import { AlienC } from '../sim/aliens/components';
import { AwayC } from '../sim/away/components';
import { drawFromStores } from '../sim/items/stock';
import { HackedC } from '../sim/robots/components';
import { shipGrid, shipIdOf } from '../sim/regions';
import { Struct } from '../sim/structure';
import { deserialize, serialize } from '../sim/save';
import { playerCrew } from '../sim/story/world';
import { ALERT_INTERVAL_TICKS } from '../sim/tuning';
import { content } from '../content';
import type { UiAlert, UiAlertKind } from '../ui/api';
import { createAlerts } from './alerts';
import { ALERT_PRIORITY, EVENT_ROUTE } from './eventRoute';
import { createEventLog } from './eventLog';

function current(a: ReturnType<typeof createAlerts>): UiAlert[] {
  let out: UiAlert[] = [];
  a.list.subscribe((v) => (out = v))();
  return out;
}
const kinds = (a: ReturnType<typeof createAlerts>) => current(a).map((x) => x.kind);
const scan = (sim: Sim, al: ReturnType<typeof createAlerts>) => { sim.tick += ALERT_INTERVAL_TICKS; al.sync(); };
const fire = (sim: Sim, room: number) => ({ type: 'fire.started' as const, ship: homeShip(sim), room, x: 1, y: 1 });

describe('event routing table', () => {
  const described = [...new Set([...logSrc.matchAll(/case '([a-zA-Z0-9.]+)'/g), ...boardingSrc.matchAll(/case '([a-zA-Z0-9.]+)'/g)].map((m) => m[1] as string))];

  it('routes every event the log describes, and every urgent route is also logged', () => {
    expect(described.length).toBeGreaterThan(60);
    expect(described.filter((t) => !(t in EVENT_ROUTE))).toEqual([]);
    const urgent = Object.entries(EVENT_ROUTE).filter(([, r]) => r === 'both').map(([t]) => t);
    expect(urgent.filter((t) => !described.includes(t))).toEqual([]);
  });

  it('gives every alert kind a priority, with emergencies above the rest', () => {
    const kindsAll: UiAlertKind[] = Object.keys(ALERT_PRIORITY) as UiAlertKind[];
    for (const k of ['fire.started', 'hull.breach', 'o2.low', 'crew.downed', 'boarders.stranded', 'power.shortage'] as const) expect(ALERT_PRIORITY[k]).toBe(2);
    for (const k of ['crew.asksToJoin', 'galaxy.incomingHostile', 'fight.report'] as const) expect(ALERT_PRIORITY[k]).toBe(0);
    expect(kindsAll.length).toBeGreaterThan(20);
  });

  it('logs the events that used to reach neither', () => {
    const sim = newGame(1, content);
    const log = createEventLog(sim);
    const ship = homeShip(sim);
    const crew = playerCrew(sim)[0] as number;
    log.onEvents([
      { type: 'research.done', ship, project: 'x' }, { type: 'combat.vented', ship }, { type: 'ftl.overcharged', ship, damaged: 1, destroyed: 0, fires: 2 },
      { type: 'crew.knockedDown', crew, by: crew, until: 9 }, { type: 'galaxy.distressSent', node: 'n', due: 5 }, { type: 'galaxy.stalled', node: sim.galaxy.current, need: 3 },
      { type: 'eggsac.disturbed', sac: 1, ship, cause: 'damage' }, { type: 'goal.done', goal: 'g', title: 'Goal' },
    ]);
    let texts: string[] = [];
    log.list.subscribe((l) => (texts = l.map((e) => e.text)))();
    expect(texts).toHaveLength(8);
    expect(texts.join('|')).toContain('Overcharged jump: 1 damaged, 2 fires');
  });
});

describe('alert cap priority', () => {
  it('emergencies keep their slots: low-priority alerts give way first and cannot push an emergency out', () => {
    const sim = newGame(1, content);
    const al = createAlerts(sim);
    for (let i = 0; i < 6; i++) al.post({ kind: 'fight.report', key: `r${i}`, text: 'report', report: true });
    al.onEvents([fire(sim, 1), fire(sim, 2)]);
    expect(kinds(al).filter((k) => k === 'fire.started')).toHaveLength(2);
    expect(current(al)).toHaveLength(6);
    al.onEvents([3, 4, 5, 6, 7, 8].map((r) => fire(sim, r)));
    expect(kinds(al).filter((k) => k === 'fire.started')).toHaveLength(6);
    expect(kinds(al)).not.toContain('fight.report');
    al.post({ kind: 'fight.report', key: 'late', text: 'report', report: true });
    expect(kinds(al).every((k) => k === 'fire.started')).toBe(true);
  });

  it('a state-born emergency takes the slot of a lower alert when the list is full', () => {
    const sim = newGame(1, content);
    const al = createAlerts(sim);
    for (let i = 0; i < 6; i++) al.post({ kind: 'fight.report', key: `r${i}`, text: 'report', report: true });
    const crew = playerCrew(sim)[0] as number;
    sim.world.add(crew, DownedC, { bleed: 60, stabilized: false, bed: 0 });
    al.sync();
    expect(kinds(al)).toContain('crew.downed');
    expect(current(al)).toHaveLength(6);
  });
});

describe('new urgent alerts', () => {
  it('own ship disabled raises and clears; an enemy ship disabled does not', () => {
    const sim = newGame(1, content);
    const home = homeShip(sim);
    const al = createAlerts(sim);
    al.onEvents([{ type: 'ship.disabled', ship: home }]);
    expect(current(al)).toHaveLength(0); // the ship is not actually disabled
    sim.world.get(home, ShipC)!.state = 'disabled';
    al.onEvents([{ type: 'ship.disabled', ship: home }]);
    expect(kinds(al)).toEqual(['ship.disabled']);
    sim.world.get(home, ShipC)!.state = 'active';
    al.sync();
    expect(current(al)).toHaveLength(0);
    const other = sim.world.query(ShipC).find((i) => i !== home)!;
    al.onEvents([{ type: 'ship.disabled', ship: other ?? 0 }]);
    expect(current(al)).toHaveLength(0);
  });

  it('a disabled ship is no alert while every able crew member is away on purpose, but is once anyone is left home or power is out', () => {
    const sim = newGame(1, content);
    sim.step();
    const home = homeShip(sim);
    const crew = playerCrew(sim);
    expect(crew.length).toBeGreaterThan(1);
    sim.world.get(home, ShipC)!.state = 'disabled';
    for (const c of crew) sim.world.add(c, AwayC, { site: 5, vehicle: 6, cat: 'patrol' });
    const al = createAlerts(sim);
    al.onEvents([{ type: 'ship.disabled', ship: home }]);
    scan(sim, al);
    expect(kinds(al)).not.toContain('ship.disabled');
    sim.world.remove(crew[1] as number, AwayC); // one is home again, and the ship is still disabled
    scan(sim, al);
    expect(kinds(al)).toContain('ship.disabled');
    // Everyone away but the power is out: still an emergency.
    sim.world.add(crew[1] as number, AwayC, { site: 5, vehicle: 6, cat: 'patrol' });
    const al2 = createAlerts(sim);
    for (const id of sim.world.query(ModuleC)) { const m = sim.world.get(id, ModuleC)!; if ((sim.content.modules[m.def]?.power ?? 0) > 0) m.hp = 0; }
    scan(sim, al2);
    expect(kinds(al2)).toContain('ship.disabled');
  });

  it('a destroyed shuttle with crew aboard raises until they are safe; an empty one or an enemy one does not', () => {
    const sim = newGame(1, content);
    const al = createAlerts(sim);
    const crew = playerCrew(sim)[0] as number;
    sim.world.add(crew, DownedC, { bleed: 60, stabilized: false, bed: 0 });
    al.onEvents([{ type: 'vehicle.destroyed', vehicle: 99, state: 'flying', x: 0, y: 0, faction: 'player', aboard: [], away: [] }]);
    al.onEvents([{ type: 'vehicle.destroyed', vehicle: 98, state: 'flying', x: 0, y: 0, faction: 'hostile', aboard: [crew], away: [] }]);
    expect(current(al)).toHaveLength(0);
    al.onEvents([{ type: 'vehicle.destroyed', vehicle: 97, state: 'docked', x: 0, y: 0, faction: 'player', aboard: [crew], away: [] }]);
    expect(kinds(al)).toEqual(['vehicle.lost']);
    sim.world.get(crew, DownedC)!.stabilized = true;
    al.sync();
    expect(kinds(al)).not.toContain('vehicle.lost');
    // The away party of a lost shuttle counts while it is out.
    sim.world.add(crew, AwayC, { site: 5, vehicle: 96, cat: 'patrol' });
    al.onEvents([{ type: 'vehicle.destroyed', vehicle: 96, state: 'flying', x: 0, y: 0, faction: 'player', aboard: [], away: [crew] }]);
    expect(kinds(al)).toContain('vehicle.lost');
    sim.world.remove(crew, AwayC);
    al.sync();
    expect(kinds(al)).not.toContain('vehicle.lost');
  });

  it('a torn or hacked AI core raises only on the player ship', () => {
    const sim = newGame(1, content);
    const home = homeShip(sim);
    const al = createAlerts(sim);
    const other = sim.world.query(ShipC).find((i) => i !== home) ?? 0;
    al.onEvents([{ type: 'core.torn', ship: other }]);
    expect(current(al)).toHaveLength(0);
    al.onEvents([{ type: 'core.torn', ship: home }]);
    expect(kinds(al)).toEqual(['core.lost']);
    expect(current(al)[0]?.text).toContain('torn out');
  });

  it('a hacked core is derived from state, comes back after a reload and clears once it is free', () => {
    const sim = newGame(1, content);
    const home = homeShip(sim);
    const core = sim.world.query(ModuleC).find((i) => sim.content.modules[sim.world.get(i, ModuleC)!.def]?.aiCore && shipIdOf(sim, sim.world.get(i, ModuleC)) === home);
    if (core === undefined) return; // this start has no AI core
    sim.world.add(core, HackedC, { by: 'rogue', tick: 0, hacker: 0 });
    const back = deserialize(serialize(sim), content);
    const al = createAlerts(back);
    al.sync();
    expect(kinds(al)).toEqual(['core.lost']);
    back.world.remove(core, HackedC);
    scan(back, al);
    expect(current(al)).toHaveLength(0);
  });

  describe('reactor fuel', () => {
    const reactor = (sim: Sim) => {
      const id = sim.world.query(ModuleC).find((i) => { const m = sim.world.get(i, ModuleC)!; return !!sim.content.modules[m.def]?.fuel && shipIdOf(sim, m) === homeShip(sim); })!;
      return { m: sim.world.get(id, ModuleC)!, def: sim.content.modules[sim.world.get(id, ModuleC)!.def]! };
    };
    it('warns when the store runs low with none in the stores, goes urgent at empty, and clears when refilled', () => {
      const sim = newGame(1, content);
      sim.step();
      const { m, def } = reactor(sim);
      const al = createAlerts(sim);
      m.fuel = def.fuel!.refillBelow - 1;
      al.sync();
      expect(kinds(al)).not.toContain('fuel.low'); // stores still hold fuel: crew refill it
      while (drawFromStores(sim, homeShip(sim), def.fuel!.item, 99) > 0);
      scan(sim, al);
      expect(kinds(al)).toContain('fuel.low');
      m.fuel = 0;
      scan(sim, al);
      expect(kinds(al).filter((k) => k === 'fuel.out' || k === 'fuel.low')).toEqual(['fuel.out']);
      const back = deserialize(serialize(sim), content);
      const al2 = createAlerts(back);
      al2.sync();
      expect(kinds(al2)).toContain('fuel.out');
      reactor(back).m.fuel = def.fuel!.store;
      scan(back, al2);
      expect(kinds(al2).some((k) => k === 'fuel.out' || k === 'fuel.low')).toBe(false);
    });
  });
});

describe('who a down alert is for', () => {
  it('a downed enemy boarder or prisoner on the home ship raises nothing; a downed friend does', () => {
    const sim = newGame(1, content);
    sim.step();
    const home = homeShip(sim);
    const at = sim.world.get(playerCrew(sim)[0] as number, PositionC)!;
    const before = new Set(sim.world.query(CrewC));
    sim.enqueue({ type: 'debug.spawnCrew', ship: home, x: at.x, y: at.y, role: 'role.pilot', faction: 'hostile' });
    sim.step();
    const enemy = sim.world.query(CrewC).find((c) => !before.has(c))!;
    expect(sim.world.get(enemy, AllegianceC)?.faction).toBe('hostile');
    sim.world.add(enemy, DownedC, { bleed: 60, stabilized: false, bed: 0 });
    expect(isOnOurSide(sim, enemy)).toBe(false);
    const al = createAlerts(sim);
    al.onEvents([{ type: 'crew.downed', crew: enemy }]);
    al.sync();
    expect(current(al)).toHaveLength(0);
    const friend = playerCrew(sim)[0] as number;
    sim.world.add(friend, DownedC, { bleed: 60, stabilized: false, bed: 0 });
    scan(sim, al);
    expect(kinds(al)).toEqual(['crew.downed']);
  });
});

describe('ongoing alerts from state', () => {
  it('creatures aboard survives a reload and clears when the creatures are dead', () => {
    const sim = newGame(1, content);
    const crew = playerCrew(sim)[0] as number;
    sim.world.get(crew, AllegianceC)!.faction = 'alien';
    sim.world.add(crew, AlienC, { ship: homeShip(sim), homeX: 0, homeY: 0 });
    const back = deserialize(serialize(sim), content);
    const al = createAlerts(back);
    al.sync();
    expect(kinds(al)).toEqual(['creatures.aboard']);
    back.world.add(crew, DeadC, { tick: back.tick });
    scan(back, al);
    expect(current(al)).toHaveLength(0);
  });

  it('boarders left on a hostile ship survive a reload, and clear when they are brought home', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnDerelict', faction: 'faction.civilian', seed: 4, depth: 2, cx: 130, cy: 70, intensity: 0.6, cause: 'decay' });
    sim.step();
    const wreck = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)?.faction === 'neutral') as number;
    sim.world.get(wreck, ShipC)!.faction = 'hostile';
    sim.world.get(wreck, ShipC)!.state = 'active';
    const g = shipGrid(sim, wreck)!;
    let tile = { x: 0, y: 0 };
    for (let y = g.y0; y < g.y0 + g.height && !tile.x; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Floor) { tile = { x, y }; break; }
    const crew = playerCrew(sim)[0] as number;
    const pos = sim.world.get(crew, PositionC)!;
    pos.x = pos.toX = tile.x;
    pos.y = pos.toY = tile.y;
    const back = deserialize(serialize(sim), content);
    const al = createAlerts(back);
    al.sync();
    expect(kinds(al)).toEqual(['boarders.stranded']);
    const home = back.world.get(playerCrew(back)[0] as number, PositionC)!;
    const h = shipGrid(back, homeShip(back))!;
    home.x = home.toX = h.x0 + 1;
    home.y = home.toY = h.y0 + 1;
    scan(back, al);
    expect(current(al)).toHaveLength(0);
  });
});

describe('hazards on other player ships', () => {
  it('a fire on a captured ship raises its own alert (keyed by ship) and clears; a hostile ship raises none', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnDerelict', faction: 'faction.civilian', seed: 4, depth: 2, cx: 130, cy: 70, intensity: 0.6, cause: 'decay' });
    sim.step();
    const prize = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)?.faction === 'neutral') as number;
    const g = shipGrid(sim, prize)!;
    const room = Array.from(g.load('room') as ArrayLike<number>).findIndex((r) => r > 0);
    expect(room).toBeGreaterThanOrEqual(0);
    const x = g.x0 + (room % g.width);
    const y = g.y0 + Math.floor(room / g.width);
    g.set('fire', x, y, 1);
    const al = createAlerts(sim);
    Object.assign(sim.world.get(prize, ShipC)!, { faction: 'hostile', state: 'active' });
    scan(sim, al);
    expect(current(al).filter((a) => a.kind === 'fire.started')).toHaveLength(0);
    sim.world.get(prize, ShipC)!.faction = 'player';
    scan(sim, al);
    expect(current(al).filter((a) => a.kind === 'fire.started')).toHaveLength(1);
    g.set('fire', x, y, 0);
    scan(sim, al);
    expect(current(al).filter((a) => a.kind === 'fire.started')).toHaveLength(0);
  });
});
