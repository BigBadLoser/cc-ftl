import { definePreset, flag, num, oneOf, str } from '../types';

/**
 * `?scenario=ambush[&trap|&honest][&signal][&tell=name][&event=trader_swap|derelict_sighting][&help]` (#173, the pirate ambush): the returning pirate, from the
 * signal. The flag that queues it is set, the drive charged and a two-hop trip started; the event opens at the first hop as a signal (the scan and hail are
 * there to use). `&trap` or `&honest` fixes what the seed would roll; `&tell=name` is a trap's slip (default the video lag); `&event=` opens that signal
 * instead (the comms window with another scene); `&signal` stops at the signal window, otherwise the ship answers it, drops out beside the skiff and is
 * deployed, ready. `&warm=<ticks>` (default 10, tests 0) runs the game first; `&settle=<ticks>` (default 20) runs on after the deploy.
 */
export default definePreset({
  doc: 'The returning pirate, from its signal, or dropped out beside the skiff.',
  params: { trap: flag(), honest: flag(), signal: flag(), tell: oneOf('name'), event: str(), help: flag(), warm: num(), settle: num() },
  spec: (p) => {
    const trap = p['trap'] ? true : p['honest'] ? false : undefined;
    const warm = typeof p['warm'] === 'number' ? p['warm'] : 10;
    return {
      ship: { skipGoals: true, clearFleets: true },
      ...(warm ? { node: { warm } } : {}),
      items: { give: { 'item.fuel': 80 } },
      events: {
        flags: { spared_pirate: 1 },
        queue: p['event'] ? `event.${String(p['event'])}` : 'event.pirate_returns',
        trip: { hops: 2 },
        ...(trap === undefined ? {} : { trap }),
        ...(p['tell'] === 'name' ? { tell: 'name' as const } : {}),
        ...(p['signal'] ? {} : { choose: [p['help'] ? 'help' : 'approach'] }),
      },
      ...(p['signal'] ? {} : { steps: [{ ticks: typeof p['settle'] === 'number' ? p['settle'] : 20 }] }),
      ui: { speed: 1 },
    };
  },
});
