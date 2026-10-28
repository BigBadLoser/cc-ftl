<script lang="ts">
  import { onMount } from 'svelte';
  import { WORK_CATEGORIES, type WorkCategory } from '../sim';
  import type { UiApi, UiCrew } from './api';
  import FloatingWindow from './FloatingWindow.svelte';
  import { centerTop } from './floatingWindow';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
  let crew = $state<UiCrew[]>([]);
  onMount(() => api.crew.subscribe((v) => (crew = v)));

  const SHORT: Record<WorkCategory, string> = {
    firefighting: 'Dmg', medical: 'Med', operating: 'Ops', repair: 'Fix', construction: 'Build', hauling: 'Haul', refining: 'Refine', crafting: 'Craft', research: 'Sci', cooking: 'Cook', patrol: 'Watch',
  };
  const HELP: Partial<Record<WorkCategory, string>> = { firefighting: 'Damage control: put out fires and seal hull breaches', refining: 'Refine: raw ore into materials (refinery)', crafting: 'Craft: materials into items (fabricator, workbench, galley)', research: 'Science: work the active research project (research module)' };
  /** Patrols are posted only by NPC ship directors (stations): no column for the player's crew. */
  const SHOWN = WORK_CATEGORIES.filter((c) => c !== 'patrol');
  /** 1 -> 2 -> 3 -> 4 -> off -> 1 */
  const next = (v: number) => (v + 1) % 5;
  const cycle = (c: UiCrew, cat: WorkCategory) =>
    api.dispatch({ type: 'crew.setPriority', id: c.id, category: cat, value: next(c.priorities[cat]) });
</script>

<FloatingWindow id="priorities" title="Priorities" icon="person" min={{ w: 360, h: 200 }} defaultRect={(b) => ({ ...centerTop(b, 640), anchor: 'bottom' })} {onClose} testId="priority-grid" closeTestId="priority-close" padded>
  <div class="scroll">
    <table>
      <thead>
        <tr>
          <th></th>
          {#each SHOWN as cat (cat)}<th title={HELP[cat] ?? cat}>{SHORT[cat]}</th>{/each}
          <th></th>
        </tr>
      </thead>
      <tbody>
        {#each crew as c (c.id)}
          <tr>
            <th class="who" scope="row">{c.name}</th>
            {#each SHOWN as cat (cat)}
              <td>
                <button
                  class="cell" class:changed={c.priorities[cat] !== c.defaults[cat]} class:off={c.priorities[cat] === 0}
                  data-testid="prio-{c.id}-{cat}" title="{HELP[cat] ?? cat}: role default {c.defaults[cat] || 'off'}" onclick={() => cycle(c, cat)}
                >{c.priorities[cat] || ''}</button>
              </td>
            {/each}
            <td><button class="reset" onclick={() => api.dispatch({ type: 'crew.resetPriorities', id: c.id })}>Reset to role</button></td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="hint">Tap to cycle 1 (highest) to 4, then off. Dotted cells differ from the role default.</p>
</FloatingWindow>

<style>
  .scroll { overflow-x: auto; }
  table { border-collapse: separate; border-spacing: 2px; }
  th { font-size: 11px; font-weight: normal; color: var(--dim); padding: 0 2px; }
  .who { text-align: left; font-size: 13px; color: var(--text); position: sticky; left: 0; background: var(--panel); padding-right: 6px; white-space: nowrap; }
  .cell { width: 42px; padding: 0; font-weight: 700; font-size: 16px; }
  .cell.off { color: var(--dim); }
  .cell.changed { border: 1px dotted var(--cyan); box-shadow: inset 0 0 0 1px #0e4a56; }
  .reset { font-size: 11px; padding: 0 8px; white-space: nowrap; }
  .hint { margin: 6px 0 0; color: var(--dim); font-size: 12px; }
</style>
