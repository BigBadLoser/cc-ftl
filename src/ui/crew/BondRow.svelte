<script lang="ts">
  import type { UiApi } from '../api';
  import type { UiSocialRow } from '../crewDetailApi';
  import DivergingBar from './DivergingBar.svelte';
  import Face from './Face.svelte';

  /** A closed bond row: portrait, name, mutual / one-sided, the stacked pair of opinion bars and a caret. */
  let { api, row, open, onToggle }: { api: UiApi; row: UiSocialRow; open: boolean; onToggle: () => void } = $props();
</script>

<button class="row {row.section}" aria-expanded={open} data-testid="bond-row" onclick={onToggle}>
  <Face {api} id={row.id} />
  <span class="name">{row.name}</span>
  {#if row.tag}<span class="tag" class:one={row.tag === 'one-sided'}>{row.tag}</span>{/if}
  <span class="bars"><DivergingBar thin value={row.mine} label="{row.myName} thinks of {row.name}" /><DivergingBar thin value={row.theirs} label="{row.name} thinks of {row.myName}" /></span>
  <span class="car">{open ? '▴' : '▸'}</span>
</button>

<style>
  .row { display: flex; align-items: center; gap: 8px; width: 100%; padding: 4px 8px; height: 38px; min-height: 0; margin-bottom: 4px; background: #0a1522; border: 1px solid var(--line); border-left: 3px solid var(--dim); color: var(--text); text-align: left; box-sizing: border-box; }
  .row.friends { border-left-color: var(--green); }
  .row.rivals { border-left-color: var(--red); }
  .row:hover { border-color: var(--cyan); }
  .name { font-size: 14px; }
  .tag { font-size: 12px; color: var(--dim); }
  .tag.one { color: var(--amber); }
  .bars { margin-left: auto; width: 90px; display: grid; gap: 2px; }
  .car { width: 10px; color: var(--dim); font-size: 11px; }
</style>
