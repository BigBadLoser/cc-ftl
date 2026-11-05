import { galaxyIndex, playerShip, type Command, type Sim } from '../sim';

/**
 * `?scenario=ambush` (#173, the pirate ambush): the returning pirate, played from the signal. The flag that queues it is set, the drive charged and
 * a two-hop trip started; the event opens at the first hop as a signal (the scan and hail are there to use). `&trap` or `&honest` fixes what the
 * seed would roll (`debug.ambush`); `&signal` stops at the signal window, otherwise the ship drops out beside the skiff and is deployed, ready.
 * Same style as the other debug starts: plain commands, each step waiting for the sim to get there.
 */
export function startAmbushScenario(
  sim: Sim, dispatch: (cmd: Command) => void, setSpeed: () => void, opts: { trap: boolean | null; signal: boolean },
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
      dispatch({ type: 'story.fire', event: 'event.pirate_returns' });
      when(() => sim.galaxy.signal?.event === 'event.pirate_returns', () => {
        if (opts.trap !== null) dispatch({ type: 'debug.ambush', trap: opts.trap });
        if (opts.signal) return;
        dispatch({ type: 'story.choose', choice: 'approach' });
        when(() => sim.sector.state === 'deploying', () => {
          const spots = [[100, 60], [20, 50], [150, 40], [60, 120], [30, 130]] as const;
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
