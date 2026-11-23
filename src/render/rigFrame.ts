import { TICK_HZ } from '../sim/time';

/**
 * The surgical rig's operation animation (#311), played from the surgery job's progress like the stasis wheel's load (render/stasisLoad.ts): the frame clock
 * runs at `RIG_FPS` frames per second of work, so it pauses with the game and runs at game speed.
 *
 * The timeline: `deploy` over the first frames and `stow` over the last; between them three stages (cut, open, close; each a loop) with the one-shot `swap.cut` and
 * `swap.open` between them. The middle's stage time is split evenly. A stage's loop repeats in its share; the frames left over hold the loop's frame 0 (the rest
 * pose the swap starts from) just before the swap, and the close stage holds it before stow. A job too short for the one-shots and one loop of each stage is
 * compressed: every phase is sampled over a share of the time proportional to its length (a little snapping is fine there).
 */
export const RIG_FPS = 8;

export const RIG_PHASES = ['deploy', 'cut', 'swap.cut', 'open', 'swap.open', 'close', 'stow'] as const;
export type RigPhase = (typeof RIG_PHASES)[number];
/** Frames per phase, read from the atlas (`frameCount`). */
export type RigCounts = Readonly<Record<RigPhase, number>>;
/** `idle` is the folded rig (no operation in progress). */
export interface RigFrame { phase: RigPhase | 'idle'; frame: number }

const IDLE: RigFrame = { phase: 'idle', frame: 0 };
const LOOPS = ['cut', 'open', 'close'] as const;

/** The frame clock's tick for a job's progress (sim ticks). */
export const rigTick = (progress: number): number => Math.floor((Math.max(0, progress) / TICK_HZ) * RIG_FPS);

/** The phase and frame of the operation at `progress` of `work` (sim ticks). No progress, or no work, is the idle rig. */
export function rigFrame(progress: number, work: number, counts: RigCounts): RigFrame {
  const total = Math.floor((work / TICK_HZ) * RIG_FPS);
  if (progress <= 0 || total <= 0) return IDLE;
  const t = Math.min(rigTick(progress), total - 1);
  const c = counts;
  const natural = c.deploy + c.stow + c['swap.cut'] + c['swap.open'];
  const stageTotal = total - natural;
  const share = Math.floor(stageTotal / 3);
  if (share >= Math.max(c.cut, c.open, c.close)) {
    // Segments in order, each [phase, length]; a stage is its loop repeated, then held. The close stage takes the rounding.
    const segs: [RigPhase, number][] = [['deploy', c.deploy], ['cut', share], ['swap.cut', c['swap.cut']], ['open', share], ['swap.open', c['swap.open']], ['close', stageTotal - 2 * share], ['stow', c.stow]];
    let at = 0;
    for (const [phase, len] of segs) {
      if (t < at + len) {
        const local = t - at;
        const loop = (LOOPS as readonly string[]).includes(phase) ? c[phase] : 0;
        if (!loop) return { phase, frame: Math.min(local, c[phase] - 1) };
        return { phase, frame: local < Math.floor(len / loop) * loop ? local % loop : 0 };
      }
      at += len;
    }
    return { phase: 'stow', frame: c.stow - 1 };
  }
  // Too short: each phase gets a share of the time proportional to its frames, and is sampled across it.
  const sum = RIG_PHASES.reduce((s, p) => s + c[p], 0);
  for (const phase of RIG_PHASES) {
    const end = phase === 'stow' ? total : Math.floor((cumulative(c, phase) * total) / sum);
    const start = Math.floor((cumulative(c, phase) - c[phase]) * total / sum);
    if (t < end || phase === 'stow') {
      const span = Math.max(1, end - start);
      return { phase, frame: Math.min(c[phase] - 1, Math.floor(((t - start) * c[phase]) / span)) };
    }
  }
  return IDLE;
}

function cumulative(c: RigCounts, upTo: RigPhase): number {
  let n = 0;
  for (const p of RIG_PHASES) { n += c[p]; if (p === upTo) break; }
  return n;
}

/** The sprite id of frame `frame` of `base`: frame 0 has no suffix. */
export const frameId = (base: string, frame: number): string => (frame ? `${base}.f${frame}` : base);
