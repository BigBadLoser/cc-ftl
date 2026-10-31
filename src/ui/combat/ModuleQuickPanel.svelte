<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiModule } from '../api';
  import Icon from '../Icon.svelte';
  import { ActionButton, Frame } from '../kit';
  import { placePanel, type Rect } from './panelPlace';

  /**
   * Combat only: your ship is in the main view and a module of it is clicked. Shows its name and health and the one damage-control lever,
   * Priority repair (the full inspector is hidden during a fight). Esc (the controller's deselect) closes it.
   */
  let { api, ship }: { api: UiApi; ship: number } = $props();
  let mods = $state<UiModule[]>([]);
  let sel = $state<number | null>(null);
  const m = $derived(mods.find((x) => x.id === sel && x.ship === ship));
  const pct = $derived(m ? Math.round((m.hp / Math.max(1, m.maxHp)) * 100) : 0);

  let el: HTMLElement | undefined = $state();
  let shown = $state(false);
  /** HUD pieces and the top-right column the panel must not cover. */
  const AVOID = ['[data-testid=combat-strip]', '[data-testid=enemy-card]', '.insetdock', '.incoming', '.rcol', '.mid'];

  onMount(() => {
    const a = api.modules.subscribe((v) => (mods = v));
    const b = api.selectedModule.subscribe((s) => (sel = s));
    // Every frame: re-anchor beside the module's screen bounds (it follows pan, zoom and the inset's resize), straight onto the element's transform.
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!el || sel === null) return;
      const rect = api.moduleScreenRect(sel);
      const size = { w: el.offsetWidth, h: el.offsetHeight };
      const obstacles: Rect[] = [];
      for (const q of AVOID) for (const n of document.querySelectorAll(q)) {
        const r = n.getBoundingClientRect();
        if (r.width && r.height) obstacles.push({ x0: r.left, y0: r.top, x1: r.right, y1: r.bottom });
      }
      const at = rect && size.w ? placePanel(rect, size, { w: innerWidth, h: innerHeight }, obstacles) : null;
      if (at) el.style.transform = `translate(${Math.round(at.x)}px, ${Math.round(at.y)}px)`;
      if (!!at !== shown) shown = !!at;
    };
    raf = requestAnimationFrame(frame);
    return () => (a(), b(), cancelAnimationFrame(raf));
  });
</script>

{#if m}
  <div class="quick" class:hidden={!shown} bind:this={el} data-testid="module-quick">
    <Frame title={m.name}>
      <div class="body">
        <div class="row"><span class="dim">Health</span><span>{m.hp}/{m.maxHp}</span></div>
        <div class="bar" class:low={pct < 40}><i style:width="{pct}%"></i></div>
        {#if m.hp < m.maxHp}
          <ActionButton
            tone={m.repairFirst ? 'amber' : 'plain'}
            title={m.repairFirst ? 'First in the repair queue (click to undo)' : 'Crew repair this before anything else'}
            testid="dc-priority"
            onclick={() => api.dispatch({ type: 'module.priorityRepair', id: m.id, on: !m.repairFirst })}
          ><Icon name="chevUp" size={16} />Priority repair</ActionButton>
        {:else}
          <div class="dim ok">Undamaged</div>
        {/if}
      </div>
    </Frame>
  </div>
{/if}

<style>
  .quick { position: fixed; left: 0; top: 0; z-index: 6; pointer-events: auto; width: 220px; background: var(--panel); will-change: transform; }
  .quick.hidden { visibility: hidden; pointer-events: none; }
  .body { display: flex; flex-direction: column; gap: 6px; padding: 10px; }
  .row { display: flex; justify-content: space-between; }
  .dim { color: var(--dim); }
  .ok { text-align: center; }
  .bar { height: 6px; background: var(--panel-3); }
  .bar > i { display: block; height: 100%; background: var(--hp); }
  .bar.low > i { background: #ff5a2d; }
</style>
