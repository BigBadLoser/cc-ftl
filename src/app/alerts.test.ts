import { describe, expect, it } from 'vitest';
import { BreakdownC, CrewC, DownedC, ModuleC, NeedsC, PickupC, PositionC, START_NODE, ShipC, galaxyIndex, newGame, type Sim } from '../sim';
import { homeShip } from '../sim/index';
import { BreakMemoryC } from '../sim/crew/breakTypes';
import { SuitC } from '../sim/eva/components';
import { ALERT_INTERVAL_TICKS } from '../sim/tuning';
import { roomTiles } from '../sim';
import { content } from '../content';
import { shipGrid, shipIdOf } from '../sim/regions';
import { AwaySiteC } from '../sim/away/components';
import { Struct } from '../sim/structure';
import type { UiAlert, UiAlertKind } from '../ui/api';
import { createAlerts } from './alerts';
import { deriveAlerts, shortOnPower } from './alertsDerived';
import { wreckShip } from '../sim/combat/wreck';
import { ConsentC, type Carry } from '../sim/consent/components';
import { deserialize, serialize } from '../sim/save';
import { playerShip } from '../sim/trade/player';
import { playerCrew } from '../sim/story/world';

function current(a: ReturnType<typeof createAlerts>): UiAlert[] {
  let out: UiAlert[] = [];
  a.list.subscribe((v) => (out = v))();
  return out;
}

/** A new game with a derelict and one of the player's crew standing on it. */
function awayTeam(): { sim: Sim; crew: number } {
  const sim = newGame(1, content);
  sim.enqueue({ type: 'debug.spawnDerelict', faction: 'faction.civilian', seed: 4, depth: 2, cx: 130, cy: 70, intensity: 0.6, cause: 'decay' });
  sim.step();
  const wreck = sim.world.query(ShipC).find((i) => sim.world.get(i, ShipC)?.faction === 'neutral') as number;
  const g = shipGrid(sim, wreck)!;
  let tile = { x: 0, y: 0 };
  for (let y = g.y0; y < g.y0 + g.height && !tile.x; y++) for (let x = g.x0; x < g.x0 + g.width; x++) if (g.get('struct', x, y) === Struct.Floor) { tile = { x, y }; break; }
  const crew = sim.world.query(CrewC)[0] as number;
  const pos = sim.world.get(crew, PositionC)!;
  pos.x = pos.toX = tile.x;
  pos.y = pos.toY = tile.y;
  return { sim, crew };
}

describe('alerts', () => {
  it('a fresh game raises no power alert before its first tick (modules are powered when the game starts)', () => {
    for (const ship of ['ship.starter', 'ship.wayfarer', 'ship.prospector']) {
      const sim = newGame(3, content, ship, true, 'rolled');
      expect(shortOnPower(sim, homeShip(sim)), ship).toBe(false);
    }
  });

  it('a passenger asking to join has an alert built from saved state: it comes back after a reload, and goes once answered', () => {
    const sim = newGame(1, content);
    const ship = playerShip(sim);
    const at = sim.world.get(playerCrew(sim)[0]!, PositionC)!;
    const before = new Set(sim.world.query(CrewC));
    sim.enqueue({ type: 'debug.spawnCrew', ship, x: at.x, y: at.y, role: 'role.pilot', faction: 'neutral', lodge: true });
    sim.step();
    const crew = sim.world.query(CrewC).find((c) => !before.has(c))!;
    // Carried, already helped (no card posted here: the test is the ask alone).
    const carry = { event: 'event.medical_emergency', origin: 'traders', purse: 0, fired: [`helpedPerson#n${crew}`] } as Carry;
    sim.world.get(ship, ConsentC)!.grants.find((g) => g.crew?.includes(crew))!.carry = carry;
    carry.asked = true;
    carry.asking = sim.tick; // an ask waiting for an answer, as the save holds it
    const back = deserialize(serialize(sim), content);
    const al = createAlerts(back);
    al.sync();
    const ask = current(al).find((a) => a.kind === 'crew.asksToJoin');
    expect(ask?.actions?.map((x) => [x.label, x.tone])).toEqual([['Accept', 'good'], ['Decline', 'bad']]);
    al.sync();
    expect(current(al).filter((a) => a.kind === 'crew.asksToJoin')).toHaveLength(1);
    back.enqueue({ type: 'jobs.join', crew, accept: false });
    back.step();
    al.sync();
    expect(current(al).some((a) => a.kind === 'crew.asksToJoin')).toBe(false);
  });

  it('a dismissed save-failed alert stays muted until a write succeeds, then a new failure raises it again', () => {
    const al = createAlerts(newGame(1, content));
    expect(al.saveResult(false, 'x')).toBe(true);
    expect(current(al)).toHaveLength(1);
    al.dismiss(current(al)[0]!.id);
    expect(al.saveResult(false, 'x')).toBe(false); // same streak: no new log line, no alert
    expect(current(al)).toEqual([]);
    al.saveResult(true, 'x');
    expect(al.saveResult(false, 'x')).toBe(true);
    expect(current(al)).toHaveLength(1);
  });

  it('posts a clickable save-failed alert that opens the Save page, replaces itself, and clears', () => {
    const al = createAlerts(newGame(1, content));
    al.post({ kind: 'save.failed', key: 'save', text: 'Saving failed', menu: 'save' });
    al.post({ kind: 'save.failed', key: 'save', text: 'Saving failed', menu: 'save' });
    expect(current(al).map((x) => [x.kind, x.menu])).toEqual([['save.failed', 'save']]);
    al.clear('save');
    expect(current(al)).toEqual([]);
  });

  it('raise "is down" for a player crew member down away from the home ship (a derelict)', () => {
    const { sim, crew } = awayTeam();
    const alerts = createAlerts(sim);
    alerts.onEvents([{ type: 'crew.downed', crew }]);
    const list = current(alerts);
    expect(list.map((a) => a.kind)).toEqual(['crew.downed']);
    expect(list[0]?.text).toContain('Down: ');
  });

  it('a site whose shuttle cannot get home raises the stranded alert with its own text, and it clears once a way in is back', () => {
    const { sim, crew } = awayTeam();
    const wreck = shipIdOf(sim, sim.world.get(crew, PositionC));
    sim.world.add(wreck, AwaySiteC, { owner: 'salvage', status: 'open', vehicle: 0, since: 0, block: 'stranded' });
    const alerts = createAlerts(sim);
    alerts.onEvents([{ type: 'away.stranded', ship: wreck, crew: [crew], noHome: true }]);
    expect(current(alerts).map((a) => [a.kind, a.text.split(':')[0]])).toEqual([['away.stranded', 'Shuttle cannot get home']]);
    delete sim.world.get(wreck, AwaySiteC)!.block;
    alerts.sync();
    expect(current(alerts)).toEqual([]);
  });

  describe('alerts built from state', () => {
    /** A condition on a new game: `set` makes it true, `clear` resolves it. */
    interface Case { kind: UiAlertKind; set(sim: Sim, crew: number): void; clear(sim: Sim, crew: number): void }
    const room = (sim: Sim) => {
      const g = shipGrid(sim, homeShip(sim))!;
      const [r, tiles] = [...roomTiles(g)].find(([, t]) => t.length > 2) as [number, number[]];
      const put = (field: string, i: number, v: number) => g.set(field, g.x0 + (i % g.width), g.y0 + Math.floor(i / g.width), v);
      return { g, r, tiles, put };
    };
    let saved: { i: number; v: number } | null = null;
    const cases: Case[] = [
      { kind: 'fire.started', set: (sim) => { const { tiles, put } = room(sim); put('fire', tiles[0]!, 1); }, clear: (sim) => { const { tiles, put } = room(sim); for (const i of tiles) put('fire', i, 0); } },
      {
        kind: 'hull.breach',
        set: (sim) => {
          const { g, tiles, put } = room(sim);
          const s = g.load('struct');
          const i = tiles[0]!;
          saved = { i, v: s[i] as number };
          put('struct', i, Struct.Space);
        },
        clear: (sim) => { room(sim).put('struct', saved!.i, saved!.v); },
      },
      { kind: 'o2.low', set: (sim) => { const { tiles, put } = room(sim); for (const i of tiles) put('o2', i, 3); }, clear: (sim) => { const { tiles, put } = room(sim); for (const i of tiles) put('o2', i, 21); } },
      {
        kind: 'power.shortage',
        set: (sim) => { for (const id of sim.world.query(ModuleC)) { const m = sim.world.get(id, ModuleC)!; if ((sim.content.modules[m.def]?.power ?? 0) < 0 && shipIdOf(sim, m) === homeShip(sim)) { m.powered = false; m.enabled = true; m.hp = Math.max(1, m.hp); return; } } },
        clear: (sim) => { for (const id of sim.world.query(ModuleC)) sim.world.get(id, ModuleC)!.powered = true; },
      },
      { kind: 'crew.downed', set: (sim, c) => sim.world.add(c, DownedC, { bleed: 60, stabilized: false, bed: 0 }), clear: (sim, c) => { sim.world.get(c, DownedC)!.stabilized = true; } },
      { kind: 'suit.airLow', set: (sim, c) => sim.world.add(c, SuitC, { worn: true, air: 1 }), clear: (sim, c) => sim.world.remove(c, SuitC) },
      { kind: 'crew.airUnreachable', set: (sim, c) => sim.world.add(c, PickupC, { since: 0 }), clear: (sim, c) => sim.world.remove(c, PickupC) },
      {
        kind: 'crew.break',
        set: (sim, c) => {
          sim.world.add(c, BreakdownC, { kind: 'panic', tier: 'severe', context: 'fire', until: sim.tick + 900, since: sim.tick, goneSince: 0 });
          sim.world.add(c, BreakMemoryC, { byContext: {}, alertAt: sim.tick });
        },
        clear: (sim, c) => sim.world.remove(c, BreakdownC),
      },
      { kind: 'crew.starving', set: (sim, c) => { const n = sim.world.get(c, NeedsC); if (n) n.hunger = 0; else sim.world.add(c, NeedsC, { rest: 100, hunger: 0 }); }, clear: (sim, c) => { sim.world.get(c, NeedsC)!.hunger = 80; } },
      { kind: 'combat.started', set: (sim) => { sim.sector.inCombat = true; }, clear: (sim) => { sim.sector.inCombat = false; } },
    ];
    for (const c of cases) {
      it(`${c.kind}: present after a reload while true, once, gone when resolved, quiet when dismissed`, () => {
        const sim = newGame(1, content);
        sim.step(); // rooms are indexed on the first tick
        const crew = playerCrew(sim)[0] as number;
        c.set(sim, crew);
        const back = deserialize(serialize(sim), content);
        const al = createAlerts(back);
        const crewBack = playerCrew(back)[0] as number;
        al.sync();
        const of = () => current(al).filter((a) => a.kind === c.kind || (c.kind === 'suit.airLow' && a.kind === 'suit.airOut'));
        expect(of()).toHaveLength(1);
        back.tick += ALERT_INTERVAL_TICKS;
        al.sync();
        expect(of()).toHaveLength(1);
        // Dismissed: stays quiet while the condition holds.
        al.dismiss(of()[0]!.id);
        back.tick += ALERT_INTERVAL_TICKS;
        al.sync();
        expect(of()).toHaveLength(0);
        // Resolved: nothing; true again: back.
        c.clear(back, crewBack);
        back.tick += ALERT_INTERVAL_TICKS;
        al.sync();
        expect(of()).toHaveLength(0);
        c.set(back, crewBack);
        back.tick += ALERT_INTERVAL_TICKS;
        al.sync();
        expect(of()).toHaveLength(1);
        c.clear(back, crewBack);
        back.tick += ALERT_INTERVAL_TICKS;
        al.sync();
        expect(of()).toHaveLength(0);
      });
    }

    it('crew.airUnreachable-style event alert is not doubled by the state scan', () => {
      const sim = newGame(1, content);
      const crew = playerCrew(sim)[0] as number;
      sim.world.add(crew, DownedC, { bleed: 60, stabilized: false, bed: 0 });
      const al = createAlerts(sim);
      al.onEvents([{ type: 'crew.downed', crew }]);
      al.sync();
      expect(current(al).filter((a) => a.kind === 'crew.downed')).toHaveLength(1);
    });

    it('a consumer held offline by fitting work is no power shortage', () => {
      const sim = newGame(1, content);
      sim.step();
      const id = sim.world.query(ModuleC).find((i) => { const m = sim.world.get(i, ModuleC)!; return (sim.content.modules[m.def]?.power ?? 0) < 0 && shipIdOf(sim, m) === homeShip(sim); }) as number;
      const m = sim.world.get(id, ModuleC)!;
      Object.assign(m, { enabled: true, powered: false, hp: Math.max(1, m.hp), offlineUntil: sim.tick + 1000 });
      const al = createAlerts(sim);
      al.sync();
      expect(current(al).filter((a) => a.kind === 'power.shortage')).toHaveLength(0);
    });

    it('a dismissed low-oxygen alert stays quiet through the hysteresis band and a dip back under the raise line', () => {
      const sim = newGame(1, content);
      sim.step();
      const { tiles, put } = room(sim);
      const o2 = (v: number) => { for (const i of tiles) put('o2', i, v); };
      const of = () => current(al).filter((a) => a.kind === 'o2.low');
      o2(3);
      const al = createAlerts(sim);
      al.sync();
      al.dismiss(of()[0]!.id);
      for (const v of [17, 3]) {
        o2(v);
        sim.tick += ALERT_INTERVAL_TICKS;
        al.sync();
        expect(of()).toHaveLength(0);
      }
      o2(21);
      sim.tick += ALERT_INTERVAL_TICKS;
      al.sync();
      o2(3);
      sim.tick += ALERT_INTERVAL_TICKS;
      al.sync();
      expect(of()).toHaveLength(1);
    });

    it('a dismissed state alert is not raised again by its event while the condition holds', () => {
      const sim = newGame(1, content);
      const crew = playerCrew(sim)[0] as number;
      sim.world.add(crew, DownedC, { bleed: 60, stabilized: false, bed: 0 });
      const al = createAlerts(sim);
      al.sync();
      al.dismiss(current(al).find((a) => a.kind === 'crew.downed')!.id);
      al.onEvents([{ type: 'crew.downed', crew }]);
      expect(current(al).filter((a) => a.kind === 'crew.downed')).toHaveLength(0);
    });

    it('a dismissed suit-air-low warning still escalates when the tank runs out, by scan and by event', () => {
      for (const viaEvent of [false, true]) {
        const sim = newGame(1, content);
        const crew = playerCrew(sim)[0] as number;
        sim.world.add(crew, SuitC, { worn: true, air: 1 });
        const al = createAlerts(sim);
        al.sync();
        al.dismiss(current(al).find((a) => a.kind === 'suit.airLow')!.id);
        sim.world.get(crew, SuitC)!.air = 0;
        if (viaEvent) al.onEvents([{ type: 'suit.airOut', crew }]);
        else { sim.tick += ALERT_INTERVAL_TICKS; al.sync(); }
        expect(current(al).filter((a) => a.kind === 'suit.airOut')).toHaveLength(1);
      }
    });

    it('a story lead notice comes back after a reload and goes when the notice is dismissed', () => {
      const sim = newGame(1, content);
      const defs = sim.content.events ?? {};
      const id = Object.keys(defs).find((k) => defs[k]?.lead)!;
      sim.story.notices.push({ id: sim.story.nextId++, event: id, expires: sim.tick + 100000 });
      const back = deserialize(serialize(sim), content);
      const al = createAlerts(back);
      al.sync();
      const lead = current(al).filter((a) => a.kind === 'story.lead');
      expect(lead).toHaveLength(1);
      back.story.notices = [];
      back.tick += ALERT_INTERVAL_TICKS;
      al.sync();
      expect(current(al).some((a) => a.kind === 'story.lead')).toBe(false);
    });

    it('a stranded away site comes back after a reload and clears when a way home is back', () => {
      const { sim, crew } = awayTeam();
      const wreck = shipIdOf(sim, sim.world.get(crew, PositionC));
      sim.world.add(wreck, AwaySiteC, { owner: 'salvage', status: 'open', vehicle: 0, since: 0, block: 'stranded' });
      const back = deserialize(serialize(sim), content);
      const al = createAlerts(back);
      al.sync();
      expect(current(al).map((a) => a.kind)).toEqual(['away.stranded']);
      delete back.world.get(wreck, AwaySiteC)!.block;
      back.tick += ALERT_INTERVAL_TICKS;
      al.sync();
      expect(current(al)).toEqual([]);
    });
  });

  describe('arrival warnings', () => {
    function setup() {
      const sim = newGame(31, content);
      sim.galaxy.fleets = [];
      const index = galaxyIndex(sim.galaxy);
      const edge = (id: string): string => index.adjacent.get(id)!.map((e) => (e.a === id ? e.b : e.a)).sort()[0] as string;
      const a = edge(START_NODE);
      const b = (index.adjacent.get(a) ?? []).map((e) => (e.a === a ? e.b : e.a)).sort().find((n) => n !== START_NODE) as string;
      const add = (faction: string, role: 'trader' | 'pirate', node: string, route: string[]) => {
        const f = { id: sim.galaxy.nextFleet++, faction, role, ships: [{ id: sim.galaxy.nextFleet++, faction, shipgen: 'faction.civilian', seed: 1, depth: 1, since: 0, name: faction === 'pirates' ? 'Rust Jackal' : 'Lucky Margin' }], node, from: node, moved: -1, route, dest: route[route.length - 1] as string, dwell: 0, legs: 0, home: `${START_NODE}#0`, synced: 0 };
        sim.galaxy.fleets.push(f);
        return f;
      };
      return { sim, a, b, add };
    }

    it('says how many turns until a fleet drops out, in danger styling for hostiles, and follows the fleet', () => {
      const { sim, a, b, add } = setup();
      const alerts = createAlerts(sim);
      const pirate = add('pirates', 'pirate', b, [a, START_NODE]);
      sim.galaxy.rev++;
      alerts.syncIncoming();
      let list = current(alerts);
      expect(list).toHaveLength(1);
      expect(list[0]?.kind).toBe('galaxy.incomingHostile');
      expect(list[0]?.text).toBe('Arriving: Rust Jackal, 2 turns');
      const id = list[0]?.id;
      pirate.node = a;
      pirate.route = [START_NODE];
      sim.galaxy.rev++;
      alerts.syncIncoming();
      list = current(alerts);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ id, kind: 'galaxy.incomingHostile' });
      expect(list[0]?.text).toMatch(/, 1 turn$/);
      pirate.node = START_NODE;
      pirate.route = [];
      sim.galaxy.rev++;
      alerts.syncIncoming();
      expect(current(alerts)).toEqual([]);
    });

    it('a friendly fleet raises no alert; a hostile one dismissed stays dismissed for that trip', () => {
      const { sim, a, b, add } = setup();
      const alerts = createAlerts(sim);
      add('traders', 'trader', a, [START_NODE]);
      sim.galaxy.rev++;
      alerts.syncIncoming();
      expect(current(alerts)).toEqual([]);
      const trader = add('pirates', 'pirate', a, [START_NODE]);
      sim.galaxy.rev++;
      alerts.syncIncoming();
      expect(current(alerts).map((x) => x.kind)).toEqual(['galaxy.incomingHostile']);
      expect(current(alerts)[0]?.subject).toEqual({ kind: 'node', id: START_NODE });
      alerts.dismiss(current(alerts)[0]!.id);
      sim.galaxy.rev++;
      alerts.syncIncoming();
      expect(current(alerts)).toEqual([]);
      trader.route = [b];
      sim.galaxy.rev++;
      alerts.syncIncoming();
      expect(current(alerts)).toEqual([]);
      trader.route = [START_NODE];
      sim.galaxy.rev++;
      alerts.syncIncoming();
      expect(current(alerts)).toHaveLength(1); // it changed course and came back: a new trip, a new warning
    });
  });
});

describe('a beaten ship waits for the answer', () => {
  it('raises "<ship> surrendered" with both answers and no "Under attack" alert beside it', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 20, y: 90 });
    for (let i = 0; i < 10; i++) sim.step();
    const alerts = createAlerts(sim);
    alerts.onEvents(sim.events.drain());
    alerts.sync();
    expect(current(alerts).map((a) => a.kind)).toContain('combat.started');
    const enemy = sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)!.faction === 'hostile')!;
    sim.enqueue({ type: 'debug.surrender', ship: enemy });
    for (let i = 0; i < 40; i++) sim.step();
    expect(sim.world.get(enemy, ShipC)!.yielded).toBe(true);
    expect(sim.sector.inCombat).toBe(true); // the fight holds until the answer
    alerts.onEvents(sim.events.drain());
    alerts.sync();
    const kinds = current(alerts).map((a) => a.kind);
    expect(kinds).toContain('ship.yielded');
    expect(kinds).not.toContain('combat.started');
    const a = current(alerts).find((x) => x.kind === 'ship.yielded')!;
    expect(a.text).toBe(`${sim.world.get(enemy, ShipC)!.name} surrendered`);
    expect(a.actions?.map((x) => x.label)).toEqual(['Take prisoners', 'Let them go']);
  });

  it('is no longer offered once the ship is destroyed before the answer', () => {
    const sim = newGame(1, content);
    sim.enqueue({ type: 'debug.spawnEnemy', template: 'ship.raider', x: 20, y: 90 });
    for (let i = 0; i < 10; i++) sim.step();
    const enemy = sim.world.query(ShipC).find((id) => sim.world.get(id, ShipC)!.faction === 'hostile')!;
    sim.enqueue({ type: 'debug.surrender', ship: enemy });
    for (let i = 0; i < 40; i++) sim.step();
    expect(deriveAlerts(sim, () => false).has(`sy${enemy}`)).toBe(true);
    wreckShip(sim, enemy);
    expect(deriveAlerts(sim, () => false).has(`sy${enemy}`)).toBe(false);
  });
});
