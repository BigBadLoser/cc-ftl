import { describe, expect, it } from 'vitest';
import { CombatC, FTL_CHARGE_SEC, START_NODE, galaxyIndex, newGame, playerShip } from '../sim';
import { content } from '../content';
import { giveItems } from '../sim/story/effects';
import { playerCrew } from '../sim/story/world';
import { podRows } from './podSnapshot';

/** The pod scan is read during the transit decision, while the ship is packed in hyperspace: the crew's medicine still counts. */
describe('pod scan', () => {
  it('a medic aboard reads the bleed to the second, in hyperspace too', () => {
    const sim = newGame(5, content);
    sim.story.goals.skipped = true;
    sim.galaxy.fleets = [];
    sim.enqueue({ type: 'debug.setCrew', id: playerCrew(sim)[0]!, xp: { medicine: 500 } });
    sim.step();
    giveItems(sim, 'item.fuel', 80);
    const combat = sim.world.get(playerShip(sim), CombatC);
    if (combat) combat.ftl = FTL_CHARGE_SEC;
    sim.story.queue.push({ event: 'event.medical_emergency', due: 0, force: true });
    const next = (galaxyIndex(sim.galaxy).adjacent.get(START_NODE) ?? []).map((e) => (e.a === START_NODE ? e.b : e.a)).sort()[0]!;
    sim.enqueue({ type: 'galaxy.jump', ship: playerShip(sim), route: [next] });
    for (let i = 0; i < 90000 && sim.galaxy.travel?.phase !== 'story'; i++) sim.step();
    expect(sim.sector.state).toBe('hyperspace');
    const pod = sim.galaxy.signal!.pods![0]!;
    const injury = podRows(sim, pod).find((r) => r.label === 'Injury')!.value;
    expect(injury).toMatch(/^Bleeding out: about \d+ s/);
  });
});
