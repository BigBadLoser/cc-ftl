import { describe, expect, it } from 'vitest';
import { newGame, type Sim } from '../../sim';
import { content } from '../../content';
import { InspectionC } from '../../sim/inspect/types';
import { deriveAlerts } from '../alertsDerived';
import { inspectCommands, inspectStation } from './inspect';

function start(opts: { clean?: boolean; eva?: boolean } = {}): Sim {
  const sim = newGame(3, content);
  for (let i = 0; i < 20; i++) sim.step();
  sim.enqueue({ type: 'debug.spawnStation', kind: 'station.trading', size: 'outpost', seed: 4, owner: 'navy' });
  sim.step();
  const station = inspectStation(sim);
  expect(station).toBeDefined();
  for (const cmd of inspectCommands(sim, station!, opts)) sim.enqueue(cmd);
  sim.step();
  return sim;
}

const inspection = (sim: Sim) => sim.world.query(InspectionC).map((id) => ({ id, insp: sim.world.get(id, InspectionC)! }))[0];

describe('?scenario=inspect', () => {
  it('sends inspectors; once they wait, the urgent alert names the lead and carries the three answers as commands', () => {
    const sim = start();
    const { id, insp } = inspection(sim)!;
    for (let i = 0; i < 6000 && insp.phase !== 'settle'; i++) sim.step();
    expect(insp.phase).toBe('settle');
    const alert = [...deriveAlerts(sim, () => false).values()].find((a) => a.kind === 'inspect.waiting');
    expect(alert?.text).toBe('Inspector waiting: fine or bribe');
    expect(alert?.subject).toEqual({ kind: 'crew', id: insp.crew[0] });
    expect(alert?.actions?.map((a) => a.command)).toEqual([
      { type: 'inspect.settle', inspection: id, choice: 'fine' },
      { type: 'inspect.settle', inspection: id, choice: 'bribe' },
      { type: 'inspect.settle', inspection: id, choice: 'refuse' },
    ]);
    sim.enqueue(alert!.actions![0]!.command);
    sim.step();
    expect([...deriveAlerts(sim, () => false).values()].some((a) => a.kind.startsWith('inspect.'))).toBe(false);
  });

  it('&eva: with the airlocks off the party waits on the hull and the alert says they cannot board', () => {
    const sim = start({ eva: true });
    const { insp } = inspection(sim)!;
    for (let i = 0; i < 4000 && !insp.blocked; i++) sim.step();
    const alert = [...deriveAlerts(sim, () => false).values()].find((a) => a.kind === 'inspect.blocked');
    expect(alert?.subject).toEqual({ kind: 'crew', id: insp.crew[0] });
  });
});
