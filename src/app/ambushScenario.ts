import { galaxyIndex, playerShip, type Command, type Sim } from '../sim';

/**
 * `?scenario=ambush` (#173, the pirate ambush): the returning pirate, played from the signal. The flag that queues it is set, the drive charged and
 * a two-hop trip started; the event opens at the first hop as a signal (the scan and hail are there to use). `&trap` or `&honest` fixes what the
 * seed would roll (`debug.ambush`); `&tell=name` (a trap's slip: the name; default the video lag), `&event=trader_swap` or `&event=derelict_sighting` opens that signal instead (to look at the comms window with another scene); `&signal` stops at the signal window, otherwise the ship drops out beside the skiff and is deployed, ready.
 * `?scenario=freighter` (#173, the distress freighter) is the same start for `event.distress_call`: `&raiders=none|here|coming` fixes its raiders (default
 * what the seed and danger give: none at the start), `&help` hails it and offers help before dropping out (the party goes aboard once deployed).
 * Same style as the other debug starts: plain commands, each step waiting for the sim to get there.
 */
export function startAmbushScenario(
  sim: Sim, dispatch: (cmd: Command) => void, setSpeed: () => void, opts: { trap: boolean | null; signal: boolean; event?: string; tell?: 'name' | 'lag'; raiders?: 'none' | 'here' | 'coming'; help?: boolean },
): void {
  const when = (ready: () => boolean, then: () => void): void => void (ready() ? then() : setTimeout(() => when(ready, then), 150));
  const adjacent = (id: string): string[] => (galaxyIndex(sim.galaxy).adjacent.get(id) ?? []).map((e) => (e.a === id ? e.b : e.a)).sort();
  when(() => sim.tick >= 10 && sim.sector.state === 'active', () => {
    const route: string[] = [];
    let at = sim.galaxy.current;
    for (let i = 0; i < 2; i++) {
      const next = adjacent(at).find((n) => n !== sim.galaxy.current && !route.includes(n));
      if (!next) break;
      route.push(next);
      at = next;
    }
    dispatch({ type: 'story.setFlag', flag: 'spared_pirate', value: 1 });
    dispatch({ type: 'debug.giveItems', item: 'item.fuel', count: 80 });
    dispatch({ type: 'debug.chargeFtl' });
    dispatch({ type: 'galaxy.jump', ship: playerShip(sim), route });
    setSpeed();
    // The trip's first hop: the event is fired into it, so it opens as a signal.
    when(() => sim.galaxy.travel?.phase === 'hop', () => {
      const event = opts.event ?? 'event.pirate_returns';
      dispatch({ type: 'story.fire', event });
      when(() => sim.galaxy.signal?.event === event, () => {
        if (opts.trap !== null && event === 'event.pirate_returns') dispatch({ type: 'debug.ambush', trap: opts.trap, ...(opts.tell ? { tell: opts.tell } : {}) });
        if (opts.raiders) dispatch({ type: 'debug.sceneArrivals', mode: opts.raiders });
        if (opts.signal) return;
        if (opts.help) {
          dispatch({ type: 'story.choose', choice: 'help' });
        } else dispatch({ type: 'story.choose', choice: 'approach' });
        setSpeed(); // the decision paused the game; answered here, not in its window, so the speed is put back here too
        when(() => sim.sector.state === 'deploying', () => {
          const spots = [[100, 60], [20, 50], [150, 40], [60, 120], [30, 130], [300, 200], [200, 20], [350, 100]] as const;
          const deploy = (i: number): void => {
            const p = spots[i];
            if (!p || sim.sector.state !== 'deploying') return;
            dispatch({ type: 'sector.deploy', x: p[0], y: p[1] });
            setTimeout(() => deploy(i + 1), 250);
          };
          deploy(0);
        });
      });
    });
  });
}
