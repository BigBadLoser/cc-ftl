import { describe, expect, it } from 'vitest';
import { BedOwnerC, CrewC, newGame } from '../../sim';
import { lodgingHere } from '../../sim/consent/guests';
import { content } from '../../content';
import { medpodCommands } from './medpod';

describe('?scenario=medpod', () => {
  it('puts a passenger aboard with a spare bed, and they take it', () => {
    const sim = newGame(3, content);
    sim.step();
    const before = new Set(sim.world.query(CrewC));
    const cmds = medpodCommands(sim);
    expect(cmds.map((c) => c.type)).toEqual(['debug.spawnModule', 'debug.spawnCrew']);
    for (const cmd of cmds) sim.enqueue(cmd);
    for (let i = 0; i < 60; i++) sim.step();
    const guest = sim.world.query(CrewC).find((id) => !before.has(id))!;
    expect(lodgingHere(sim, guest)?.by).toBe('passage');
    expect(sim.world.get(guest, BedOwnerC)?.bed).toBeGreaterThan(0);
  });
});
