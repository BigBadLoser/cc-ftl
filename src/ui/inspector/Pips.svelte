<script lang="ts">
  /**
   * A skill level as pips, one per level up to `max`: each filled pip coloured by where that level comes from (rolled, XP,
   * trait), `below` pips dashed amber (levels the role expects but this one lacks), the rest empty.
   */
  export type PipKind = 'rolled' | 'xp' | 'trait' | 'below' | null;
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
  i.below { background: transparent; border: 1px dashed var(--amber); }
</style>
