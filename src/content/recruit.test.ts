import { describe, expect, it } from 'vitest';
import { CrewC, deserialize, galaxyIndex, newGame, serialize, type Sim } from '../sim';
import { portsAt } from '../sim/galaxy/portIndex';
import { portRecruits, recruitsHere } from '../sim/galaxy/recruit';
import { ensureAround } from '../sim/galaxy/state';
import { RECRUIT_SLOTS, RECRUIT_TURNS } from '../sim/galaxy/tuningRecruit';
import { content } from '.';

/** A game at its start node, which has a trade station (seed 7). */
function atStation(): Sim {
  const sim = newGame(7, content);
  ensureAround(sim, sim.galaxy.current);
  return sim;
}

const hire = (sim: Sim, key: string) => {
  sim.enqueue({ type: 'crew.hire', key });
  sim.step();
  return sim.events.drain();
};
const crewCount = (sim: Sim): number => sim.world.query(CrewC).length;
const rejected = (ev: ReturnType<Sim['events']['drain']>): string[] => ev.flatMap((e) => (e.type === 'command.rejected' && e.command === 'crew.hire' ? [e.reason] : []));

describe('crew for hire', () => {
  it('a trade station posts stable candidates until the window turns over', () => {
    const sim = atStation();
    const a = recruitsHere(sim);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(RECRUIT_SLOTS);
    expect(recruitsHere(sim)).toEqual(a);
    for (const r of a) {
      expect(r.cost).toBeGreaterThanOrEqual(150);
      expect(r.cost).toBeLessThanOrEqual(400);
      expect(sim.content.roles[r.role]).toBeDefined();
    }
    sim.galaxy.turn += RECRUIT_TURNS;
    expect(recruitsHere(sim).map((r) => r.key)).not.toEqual(a.map((r) => r.key));
  });

  it('hiring adds a crew member aboard and takes the credits; the candidate is then gone', () => {
    const sim = atStation();
    const [c] = recruitsHere(sim);
    const crew = crewCount(sim);
    const credits = (sim.trade.credits = 1000);
    const ev = hire(sim, c!.key);
    expect(rejected(ev)).toEqual([]);
    expect(ev.some((e) => e.type === 'crew.hired')).toBe(true);
    expect(crewCount(sim)).toBe(crew + 1);
    expect(sim.trade.credits).toBe(credits - c!.cost);
    const hired = sim.world.query(CrewC).map((id) => sim.world.get(id, CrewC)!).find((x) => x.name === c!.name && x.role === c!.role);
    expect(hired).toBeDefined();
    expect(recruitsHere(sim).some((r) => r.key === c!.key)).toBe(false);
    expect(rejected(hire(sim, c!.key))).toEqual(['noCandidate']);
    expect(crewCount(sim)).toBe(crew + 1);
  });

  it('rejects an unknown candidate, a poor player and a player away from a node', () => {
    const sim = atStation();
    const [c] = recruitsHere(sim);
    expect(rejected(hire(sim, 'nobody'))).toEqual(['noCandidate']);
    sim.trade.credits = c!.cost - 1;
    const crew = crewCount(sim);
    expect(rejected(hire(sim, c!.key))).toEqual(['cantAfford']);
    expect(crewCount(sim)).toBe(crew);
    expect(sim.trade.credits).toBe(c!.cost - 1);
    sim.trade.credits = 1000;
    sim.galaxy.event = { encounter: 0 } as never;
    expect(rejected(hire(sim, c!.key))).toEqual(['notHere']);
  });

  it('survives a save and load, with the hired candidate still gone', () => {
    const sim = atStation();
    const [c] = recruitsHere(sim);
    sim.trade.credits = 1000;
    hire(sim, c!.key);
    const left = recruitsHere(sim).map((r) => r.key);
    const back = deserialize(serialize(sim), content);
    expect(recruitsHere(back).map((r) => r.key)).toEqual(left);
    expect(back.galaxy.recruitLog).toEqual(sim.galaxy.recruitLog);
  });

  it('military stations offer nobody', () => {
    const sim = atStation();
    const mil = [...galaxyIndex(sim.galaxy).nodes.values()].find((n) => n.structures.some((s) => s.def === 'structure.station_military'));
    expect(mil).toBeDefined();
    const ports = portsAt(sim, mil!.id);
    expect(ports.length).toBeGreaterThan(0);
    for (const p of ports) expect(portRecruits(sim, p)).toEqual([]);
  });
});
