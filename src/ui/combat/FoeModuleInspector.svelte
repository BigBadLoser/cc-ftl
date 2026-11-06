<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiFoeModule } from '../api';
  import FloatingWindow from '../FloatingWindow.svelte';
  import ItemIcon from '../ItemIcon.svelte';
  import { Meter } from '../kit';
  import { hullTone } from './hullTone';

  /**
   * Combat: a foe's weapon module, read-only (a left click on it while not aiming). Its name, health and what its upgrade slot carries; no controls.
   * It is the inspector's own window (same id, so the same default spot as the colony inspector); the insets step aside for it, never the other way.
   * What it may show is decided in app/foeModule.ts, so a scanner can gate it there.
   */
  let { api }: { api: UiApi } = $props();
  let sel = $state<number | null>(null);
  let tick = $state(0);
  const m = $derived<UiFoeModule | null>((void tick, api.foeModule(sel)));
  /** The same 60 / 30 bands as the player's hull. */
  const FILL = { green: 'var(--health-good)', amber: 'var(--health-warn)', red: 'var(--health-bad)' } as const;
  const pct = $derived(m ? Math.round((m.hp / Math.max(1, m.maxHp)) * 100) : 0);
  onMount(() => {
    const a = api.selectedModule.subscribe((s) => (sel = s));
    const b = api.snapshot.subscribe((x) => (tick = x.tick));
    return () => (a(), b());
  });
</script>

{#if m}
  <FloatingWindow id="inspector" title="Inspector" min={{ w: 260, h: 140 }} defaultRect={(b) => ({ x: b.left, y: 0, w: 290, h: 0, anchor: 'bottom' })} onClose={() => api.cancel()} testId="foe-inspector" bare pinnable={false} padded>
    <div class="body">
      <div class="name"><b>{m.name}</b><small>{m.ship}</small></div>
      <div class="row"><span class="dim">Health</span><span>{m.hp}/{m.maxHp}</span></div>
      <Meter value={pct / 100} fill={FILL[hullTone(pct)]} height={8} title="Module health" />
      {#if !m.powered}<div class="warn">Offline</div>{/if}
      <div class="sub">Upgrade slot</div>
      <div class="slot" data-testid="foe-upgrade">
        {#if m.upgrade}
          <ItemIcon {api} item={m.upgrade.item} size={30} />
          <span class="txt"><b>{m.upgrade.name}</b><small>{m.upgrade.effects.join(' · ')}</small></span>
        {:else}
          <span class="dim">{m.slot ? 'Empty' : 'No slot'}</span>
        {/if}
      </div>
    </div>
  </FloatingWindow>
{/if}

<style>
  .body { display: flex; flex-direction: column; gap: 6px; }
  .name { display: flex; flex-direction: column; }
  .name small, .txt small { color: var(--dim); font-size: 11px; line-height: 1.2; }
  .row { display: flex; justify-content: space-between; }
  .dim { color: var(--dim); }
  .warn { color: var(--amber); font-size: 12px; }
  .sub { color: var(--dim); font-size: 12px; margin-top: 6px; }
  .slot { display: flex; align-items: center; gap: 8px; min-height: 34px; }
  .txt { display: flex; flex-direction: column; min-width: 0; }
</style>
