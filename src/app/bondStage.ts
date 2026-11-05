import { opinionOf, personOf, type Sim } from '../sim';
import { bondBoth, bondTo } from '../sim/crew/bonds';
import { TICK_HZ } from '../sim/time';

/**
 * Debug staging (`?hook`, `__cc.stage.bondHistory(a, b)`): give a pair a few dated reasons in both directions, mixed good and bad,
 * the oldest hours back, so the Social tab's timeline can be shot full. Entities in, nothing returned.
 */
export function stageBondHistory(sim: Sim, a: number, b: number): void {
  const events: { who: 'a' | 'b' | 'both'; id: string; d: number; agoSec: number; at?: string }[] = [
    { who: 'both', id: 'fought', d: 30, agoSec: 7200 },
    { who: 'b', id: 'rescued', d: 18, agoSec: 3600 },
    { who: 'a', id: 'chat', d: 6, agoSec: 2400 },
    { who: 'a', id: 'tantrum', d: -4, agoSec: 720 },
  ];
  for (const e of events) {
    if (e.who === 'both') bondBoth(sim, a, b, e.d, e.id);
    else bondTo(sim, e.who === 'a' ? a : b, e.who === 'a' ? b : a, e.d, e.id);
    const tick = Math.round(sim.tick - e.agoSec * TICK_HZ);
    for (const [from, to] of [[a, b], [b, a]] as const) {
      const r = opinionOf(sim, personOf(sim, from), personOf(sim, to))?.reasons.find((x) => x.id === e.id);
      if (r && (e.who === 'both' || (e.who === 'a') === (from === a))) r.tick = tick;
    }
  }
}
