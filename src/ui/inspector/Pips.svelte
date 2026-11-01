<script lang="ts" module>
  export type PipKind = 'rolled' | 'xp' | 'trait' | 'lost' | 'below' | null;

  /** The pips of a level made of rolled, XP and trait levels, `lost` of them taken away by traits (shown red at the end). */
  export function pipsOf(rolled: number, xp: number, traitUp: number, lost: number): PipKind[] {
    const seq: PipKind[] = [...Array<PipKind>(Math.max(0, rolled)).fill('rolled'), ...Array<PipKind>(Math.max(0, xp)).fill('xp'), ...Array<PipKind>(Math.max(0, traitUp)).fill('trait')];
    for (let i = seq.length - 1, n = lost; i >= 0 && n > 0; i--, n--) seq[i] = 'lost';
    return seq;
  }
</script>

<script lang="ts">
  /**
   * A skill level as pips, one per level up to `max`: each filled pip coloured by where that level comes from (rolled, XP,
   * trait), `lost` pips red (levels a trait takes away), `below` pips dashed amber (levels the role expects but this one lacks), the rest empty.
   */
  /** `width`: each pip's px; left out, the pips share the row's width. */
  let { cells, max, width, testId }: { cells: PipKind[]; max: number; width?: number; testId?: string } = $props();
</script>

<span class="pips" data-testid={testId}>
  {#each Array.from({ length: max }, (_v, i) => i) as i (i)}<i class={cells[i] ?? ''} class:flex={width === undefined} style:width={width === undefined ? undefined : `${width}px`}></i>{/each}
</span>

<style>
  .pips { display: flex; gap: 3px; }
  i.flex { flex: 1; min-width: 0; }
  i { display: block; height: 10px; box-sizing: border-box; background: var(--track); border: 1px solid var(--line); }
  i.rolled { background: #8b939a; border-color: #8b939a; }
  i.xp { background: var(--cyan); border-color: var(--cyan); }
  i.trait { background: var(--green); border-color: var(--green); }
  i.lost { background: var(--red); border-color: var(--red); }
  i.below { background: transparent; border: 1px dashed var(--amber); }
</style>
