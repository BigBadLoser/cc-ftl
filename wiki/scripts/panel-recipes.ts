// Live panels for the guides (<GamePanel>): each recipe starts a real game headless, sets a scene up with the game's own
// debug-scenario commands, runs it a few seconds and keeps what a UI panel would be handed, built by the game's own
// snapshot functions (src/app/*Snapshot.ts). The wiki build saves the results (capture-panels.ts); pages read them through
// src/lib/panels.ts, typed by these functions' return types, so a changed panel shape fails the check.
// Runs in Node at build time only: nothing here reaches the browser.
import { content } from '../../src/content/index.ts';
import { newGame, type Sim } from '../../src/sim/index.ts';
import { droneScenarioCommands } from '../../src/app/droneScenario.ts';
import { buildModuleList } from '../../src/app/moduleSnapshot.ts';

/** A seeded new game, run `warm` seconds, then `commands`, then `secs` more. */
function scene(seed: number, commands: (sim: Sim) => Parameters<Sim['enqueue']>[0][], secs: number, warm = 1): Sim {
  const sim = newGame(seed, content);
  const step = (s: number) => { for (let i = 0; i < s * 20; i++) { sim.step(); sim.events.drain(); } };
  step(warm);
  for (const c of commands(sim)) sim.enqueue(c);
  step(secs);
  return sim;
}

function must<T>(value: T | undefined | null, what: string): T {
  if (value == null) throw Error('Panel recipe found no ' + what);
  return value;
}

export const panels = {
  /** The module inspector on a drone bay: one repair drone out sealing a hull breach, one docked. */
  droneBay: () => {
    const sim = scene(7, (s) => droneScenarioCommands(s, false, true), 4);
    return must(buildModuleList(sim).find((m) => m.def === 'module.droneBay'), 'drone bay');
  },
};
