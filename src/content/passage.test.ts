import { describe, expect, it } from 'vitest';
import { CrewC, PositionC, newGame, type Sim } from '../sim';
import { ConsentC } from '../sim/consent/components';
import { killCrew } from '../sim/crew/death';
import { nodesWithin } from '../sim/galaxy/graph';
import { portsAt } from '../sim/galaxy/portIndex';
import { placementGapError } from '../sim/regions';
import { deserialize, serialize } from '../sim/save';
import { playerCrew } from '../sim/story/world';
import { playerShip } from '../sim/trade/player';
import { CombatC, FTL_CHARGE_SEC } from '../sim';
import { giveItems } from '../sim/story/effects';
import { planStarRoute } from '../sim/galaxy/route';
import { content } from '.';

/** Passage (#173 step 6, slice 4): a passenger back on their feet asks to be taken to a port of their own; the trip is a job, paid on the handover. */

const EVENT = 'event.medical_emergency';
const step = (sim: Sim, n = 1): string[] => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    sim.step();
    for (const e of sim.events.drain()) if (e.type === 'scene.observed') out.push(e.rule);
  }
  return out;
};

/** A galaxy faction with a station, depot or den 1-3 jumps from the start, and that node. */
function origin(sim: Sim): { faction: string; node: string } {
  for (const [node, hops] of nodesWithin(sim, sim.galaxy.current, 3)) {
    if (hops < 1) continue;
    const p = portsAt(sim, node).find((x) => ['station', 'depot', 'den'].includes(x.kind) && x.owner !== 'pirates');
    if (p) return { faction: p.owner, node };
  }
  throw new Error('no port in reach');
}

/** A passenger aboard, carried from the pod event (as the observer hands one on), already on their feet. */
function aboard(seed: number, from?: string): { sim: Sim; crew: number; faction: string } {
  const sim = newGame(seed, content);
  sim.story.goals.skipped = true;
  sim.galaxy.fleets = [];
  const faction = from ?? origin(sim).faction;
  const ship = playerShip(sim);
  const at = sim.world.get(playerCrew(sim)[0]!, PositionC)!;
  const before = new Set(sim.world.query(CrewC));
  sim.enqueue({ type: 'debug.spawnCrew', ship, x: at.x, y: at.y, role: 'role.pilot', faction: 'neutral', lodge: true });
  sim.step();
  const crew = sim.world.query(CrewC).find((c) => !before.has(c))!;
  const g = sim.world.get(ship, ConsentC)!.grants.find((x) => x.crew?.includes(crew))!;
  g.carry = { event: EVENT, origin: faction, purse: 80, fired: [] };
  sim.events.drain();
  return { sim, crew, faction };
}

/** Put the ship at a node and deploy it there. */
function visit(sim: Sim, node: string): void {
  sim.enqueue({ type: 'debug.galaxyTeleport', node });
  step(sim);
  const p = sim.sector.packet!;
  for (let x = 0; x + p.w <= sim.sector.width && sim.sector.state !== 'active'; x += 4) {
    for (let y = 2; y + p.h <= sim.sector.height; y += 4) {
      if (placementGapError(sim, { x, y, w: p.w, h: p.h })) continue;
      sim.enqueue({ type: 'sector.deploy', x, y });
      step(sim);
      break;
    }
  }
  expect(sim.sector.state).toBe('active');
}

const card = (sim: Sim) => sim.galaxy.posted?.[0];
const gone = (sim: Sim, crew: number) => !sim.world.has(crew, CrewC);

describe('passage', () => {
  it('once up, the passenger posts one passage card to a port of their faction, fare by distance', () => {
    const { sim, crew, faction } = aboard(7);
    step(sim, 40);
    const c = card(sim)!;
    expect(c).toMatchObject({ kind: 'passage', crew, issuer: faction });
    expect(c.refused).toBeUndefined();
    const hops = nodesWithin(sim, sim.galaxy.current, 3).get(c.to!)!;
    expect(hops).toBeGreaterThanOrEqual(1);
    expect(c.reward).toBe(50 + 45 * hops);
    expect(c.due).toBe(sim.galaxy.turn + 6 + 3 * hops);
    expect(portsAt(sim, c.to!).some((p) => p.owner === faction)).toBe(true);
    step(sim, 100);
    expect(sim.galaxy.posted).toHaveLength(1);
  });

  it('accepted and flown to the destination: handed over, the fare paid, the delivered rule fired, gone from the ship', () => {
    const { sim, crew } = aboard(7);
    step(sim, 40);
    const c = card(sim)!;
    sim.enqueue({ type: 'jobs.accept', key: c.key });
    step(sim);
    expect(sim.galaxy.posted).toEqual([]);
    expect(sim.galaxy.jobs.find((j) => j.id === c.id)?.kind).toBe('passage');
    // Saved and loaded mid-trip: the job and the passenger carry over.
    const back = deserialize(serialize(sim), content);
    visit(back, c.to!);
    const credits = back.trade.credits;
    let rules: string[] = [];
    const seen: string[] = [];
    for (let i = 0; i < 20 * 400 && !gone(back, crew); i++) {
      back.step();
      for (const e of back.events.drain()) {
        if (e.type === 'scene.observed') rules.push(e.rule);
        if (e.type === 'job.shuttleSent') seen.push(`sent:${e.via}`);
      }
    }
    expect(seen.some((x) => x.startsWith('sent:'))).toBe(true); // a shuttle takes them over, not a hand across
    rules = rules.concat(step(back, 40));
    expect(gone(back, crew)).toBe(true);
    expect(back.galaxy.jobs.some((j) => j.id === c.id)).toBe(false);
    expect(back.trade.credits).toBe(credits + c.reward);
    expect(rules.filter((r) => r === 'personDelivered')).toHaveLength(1);
    expect(back.world.get(playerShip(back), ConsentC)?.grants.some((g) => g.crew?.includes(crew)) ?? false).toBe(false);
  });

  it('refused: the passenger gets off at the next port, no fare', () => {
    const { sim, crew } = aboard(7);
    step(sim, 40);
    const c = card(sim)!;
    sim.enqueue({ type: 'jobs.refuse', key: c.key });
    step(sim);
    expect(card(sim)?.refused).toBe(true);
    const credits = sim.trade.credits;
    visit(sim, c.to!);
    let rules: string[] = [];
    for (let i = 0; i < 20 * 400 && !gone(sim, crew); i++) rules = rules.concat(step(sim));
    expect(gone(sim, crew)).toBe(true);
    step(sim, 40);
    expect(sim.galaxy.posted).toEqual([]);
    expect(sim.trade.credits).toBe(credits);
    expect(rules).not.toContain('personDelivered');
  });

  it('accepted then abandoned: the broken-contract cost with their faction, and they get off at the next port', () => {
    const { sim, crew, faction } = aboard(7);
    step(sim, 40);
    const c = card(sim)!;
    sim.enqueue({ type: 'jobs.accept', key: c.key });
    step(sim);
    const rep = sim.story.reputation[faction] ?? 0;
    sim.enqueue({ type: 'jobs.abandon', id: c.id });
    step(sim);
    expect(sim.story.reputation[faction]).toBe(rep - 1);
    expect(card(sim)).toMatchObject({ crew, refused: true, reward: 0 });
    expect(gone(sim, crew)).toBe(false);
  });

  it('dies aboard with the passage accepted: the job fails', () => {
    const { sim, crew, faction } = aboard(7);
    step(sim, 40);
    const c = card(sim)!;
    sim.enqueue({ type: 'jobs.accept', key: c.key });
    step(sim);
    const rep = sim.story.reputation[faction] ?? 0;
    killCrew(sim, crew);
    step(sim, 40);
    expect(sim.galaxy.jobs.some((j) => j.id === c.id)).toBe(false);
    expect(sim.story.reputation[faction]).toBe(rep - 1);
  });

  it('runs out on a hop (the ship packed in hyperspace): the passenger still gets a refused card and gets off at the next port', () => {
    const { sim, crew, faction } = aboard(7);
    step(sim, 40);
    const c = card(sim)!;
    sim.enqueue({ type: 'jobs.accept', key: c.key });
    step(sim);
    const job = sim.galaxy.jobs.find((j) => j.id === c.id)!;
    job.due = sim.galaxy.turn; // the hop's turn takes it past due
    const rep = sim.story.reputation[faction] ?? 0;
    giveItems(sim, 'item.fuel', 40);
    const combat = sim.world.get(playerShip(sim), CombatC);
    if (combat) combat.ftl = FTL_CHARGE_SEC;
    const route = planStarRoute(sim.galaxy, sim.galaxy.current, c.to!, { known: false })!.path.slice(1);
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route });
    let packed = false;
    for (let i = 0; i < 20 * 600 && sim.sector.state !== 'deploying'; i++) {
      step(sim);
      if (sim.sector.state === 'hyperspace' && !sim.galaxy.jobs.some((j) => j.id === c.id)) packed = true;
      if (sim.galaxy.travel?.phase === 'arrived') sim.enqueue({ type: 'galaxy.drop' });
      // Pass up any signal on the way.
      const active = sim.story.active ? sim.content.events?.[sim.story.active.event] : undefined;
      const pass = active?.choices?.find((x) => !x.outcome?.effects?.some((e) => e.type === 'scene') && !x.remote && !x.cost && !x.requires && !x.check);
      if (pass) sim.enqueue({ type: 'story.choose', choice: pass.id });
    }
    expect(packed).toBe(true); // it failed while the ship was a packet
    expect(sim.story.reputation[faction]).toBe(rep - 1);
    expect(card(sim)).toMatchObject({ crew, refused: true, reward: 0 });
    visit(sim, c.to!);
    for (let i = 0; i < 20 * 400 && !gone(sim, crew); i++) step(sim);
    expect(gone(sim, crew)).toBe(true);
  });
});
