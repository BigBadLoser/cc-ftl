import { cutStrip, stripRoom, type BayGeo, type BayPart } from './part';

/** A lane hull's outboard bays by the hangar that are flight ops (`zones.ts`), where the guns do not spread. */
const FLIGHT = 2;

/**
 * A launch lane open out of the stern (PROTOTYPE, #581: its frame, bays and paint are still `Frame.lane`'s): mirrored
 * side hulls, single cabins inboard along the lane, the guns fixed outboard, flight ops by the hangar, escape pods for
 * the plan's hangar (the frame's is at the lane's head).
 */
export const LANE: BayPart = {
  // (Mirrored sides; an annex beside its host on the single-tier side hulls; a hold may take all its bays, and a small
  // room four times its plan: a lane hull's bays run bigger.)
  program: { pods: true, mirror: true, beside: true, holds: true, grow: 4 },
  zones: {
    forward: (b) => !b.row,
    other: (b, k, z) => {
      if (!b.row) return 'systems';
      if (b.row.dir < 0) return 'hab';
      if (z.weapons.has(k)) return 'weapons';
      return z.out.n++ < z.flight ? 'flight' : 'hab';
    },
  },
  // (Inboard of the side corridors from the hangar aft, the two aftmost bays left to hab's rooms (the mess beside the
  // cabins) where the rest hold the beds; too many for the inboard strip (many passengers): the outboard bays from the stern take the rest.)
  strip: (g, beds) => {
    const all = g.bays.flatMap((b, k) => (b.row && b.row.dir < 0 ? [k] : [])), most = Math.ceil(beds / 2);
    const held = all.slice(0, -2), out = outboard(g), short = most - stripRoom(g, all);
    let aft: number[] = [];
    for (let t = 1; short > 0 && t <= out.length && stripRoom(g, aft) < short; t++) aft = out.slice(-t);
    const fits = (ks: number[]): boolean => cutStrip(g, ks, most).reduce((t, r) => t + r.c, 0) >= most;
    return short > 0 ? [...all, ...aft] : all.length > 2 && fits(held) ? held : all;
  },
  mounts: (g, m) => {
    // (Outboard bays four rows deep at least. First the mounts spread the side hull's length, front to stern, flight
    // ops' bays (the pods) in the first gap and hab's (the mess) in the next; else from the stern aft of flight ops' two
    // bays by the hangar, a bay between each, else side by side.)
    const all = outboard(g), ob = all.slice(FLIGHT), deepOf = (ks: number[]): number[] => ks.filter((k) => g.minDepth(k, k + 1) >= 4);
    const pick = (gap: number): number[] => {
      const deep = deepOf(ob), got: number[] = [];
      for (let i = deep.length - 1; i >= 0 && got.length < m; i--) if (got.every((k) => Math.abs(ob.indexOf(k) - ob.indexOf(deep[i] as number)) > gap)) got.push(deep[i] as number);
      return got;
    };
    const spread = (): number[] => {
      const deep = deepOf(all), got: number[] = [], n = all.length;
      for (let i = 0; i < m && n > 1; i++) {
        const want = Math.round((i * (n - 1)) / (m - 1));
        const k = deep.filter((d) => !got.includes(d)).sort((u, v) => Math.abs(all.indexOf(u) - want) - Math.abs(all.indexOf(v) - want))[0];
        if (k !== undefined) got.push(k);
      }
      // (Each gap two bays at least: a pods room or the mess.)
      const s2 = [...got].sort((u, v) => u - v);
      return s2.every((k, i) => i === 0 || all.indexOf(k) - all.indexOf(s2[i - 1] as number) >= 3) ? s2 : [];
    };
    const tries: { at: number[]; flight: number }[] = [];
    for (const how of ['spread', 1, 0] as const) {
      const at = (how === 'spread' ? spread() : pick(how)).sort((u, v) => u - v);
      if (how !== 0 && at.length < m) continue;
      // (Flight ops' bays: the first gap, spread; else the two by the hangar.)
      const flight = how === 'spread' ? all.indexOf(at[1] as number) - all.indexOf(at[0] as number) - 1 : FLIGHT;
      tries.push({ at: ob.length >= m && at.length === m ? at : [], flight });
    }
    return tries;
  },
};

/** The outboard bays (out from a side corridor to the hull). */
const outboard = (g: BayGeo): number[] => g.bays.flatMap((b, k) => (b.row && b.row.dir > 0 ? [k] : []));
