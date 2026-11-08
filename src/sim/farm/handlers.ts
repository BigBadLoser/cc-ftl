import type { Command } from '../commands';
import { ModuleC } from '../modules/components';
import type { Sim } from '../sim';
import { TICK_HZ } from '../time';
import { PlotC } from './components';
import { growTicks } from './crops';

type FarmCommandType = 'plot.setCrop' | 'debug.setPlot';
type Handler<T extends FarmCommandType> = (sim: Sim, cmd: Extract<Command, { type: T }>) => void;

function reject(sim: Sim, command: string, reason: string): void {
  sim.events.emit({ type: 'command.rejected', command, reason });
}

export const farmHandlers: { [T in FarmCommandType]: Handler<T> } = {
  // Pick what a bed sows next (null: nothing). A crop already in the soil is not disturbed; the pick takes effect once it is harvested.
  'plot.setCrop': (sim, cmd) => {
    const plot = sim.world.get(cmd.moduleId, PlotC);
    if (!plot || !sim.world.has(cmd.moduleId, ModuleC)) return reject(sim, cmd.type, 'noPlot');
    if (cmd.crop !== null && !sim.content.crops?.[cmd.crop]) return reject(sim, cmd.type, 'badCrop');
    plot.crop = cmd.crop;
  },
  'debug.setPlot': (sim, cmd) => {
    const plot = sim.world.get(cmd.moduleId, PlotC);
    const crop = sim.content.crops?.[cmd.crop];
    if (!plot || !crop) return reject(sim, cmd.type, plot ? 'badCrop' : 'noPlot');
    plot.planted = cmd.crop;
    plot.ready = !!cmd.ready;
    plot.grown = cmd.ready ? growTicks(crop) : Math.round((cmd.grown ?? 0) * TICK_HZ);
  },
};
