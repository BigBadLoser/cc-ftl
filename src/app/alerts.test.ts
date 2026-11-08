import { describe, expect, it } from 'vitest';
import { CrewC, PositionC, START_NODE, ShipC, galaxyIndex, newGame, type Sim } from '../sim';
import { content } from '../content';
import { shipGrid, shipIdOf } from '../sim/regions';
import { AwaySiteC } from '../sim/away/components';
import { Struct } from '../sim/structure';
import type { UiAlert } from '../ui/api';
import { createAlerts } from './alerts';
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
