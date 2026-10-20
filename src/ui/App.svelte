<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiCombat, UiCutaway, UiPrize, UiSnapshot, UiToolState, UiTrade } from './api';
  import CombatPanel from './CombatPanel.svelte';
  import PrizePanel from './PrizePanel.svelte';
    import TradeList from './TradeList.svelte';
  import TradeWindow from './TradeWindow.svelte';
  import DebugPanel from './DebugPanel.svelte';
  import SelectionPanel from './SelectionPanel.svelte';
  import CrewBar from './CrewBar.svelte';
  import PriorityGrid from './PriorityGrid.svelte';
  import ToolBar from './ToolBar.svelte';
  import AlertList from './AlertList.svelte';
  import BuildModules from './BuildModules.svelte';
  import OverlayPicker from './OverlayPicker.svelte';
  import StatsChips from './StatsChips.svelte';
  import StockDrawer from './StockDrawer.svelte';
  import ErrorOverlay from './ErrorOverlay.svelte';
  import StoryModal from './StoryModal.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import './theme.css';

  let { api }: { api: UiApi } = $props();

  let canvas: HTMLCanvasElement;
  let debug = $state(false);
  let stockOpen = $state(false);
  let priorities = $state(false);
  let selCrew = $state<number | null>(null);
  let toast = $state<string | null>(null);
  let snap = $state<UiSnapshot | undefined>(undefined);
  let combat = $state<UiCombat>({ inCombat: false, player: null, enemies: [] });
  let combatOpen = $state(false);
  let wasInCombat = false;
  let prizeOpen = $state(false);
  let tradeOpen = $state(false);
  /** Partner (ship or station entity id) whose trade window is open, or null. */
  let tradeWith = $state<number | null>(null);
  let trade = $state<UiTrade>({ credits: 0, partners: [], deals: [] });
  let prizes = $state<UiPrize[]>([]);

  let cutaway = $state<UiCutaway>('auto');
  let tool = $state<UiToolState>({ tool: 'select', build: 'wall', moduleDef: null, rot: 0 });
  $effect(() => {
    document.documentElement.toggleAttribute('data-combat', combat.inCombat && combatOpen);
  });
  const phone = () => window.matchMedia('(max-width: 600px)').matches;
  const cutLabel: Record<UiCutaway, string> = { auto: 'Cutaway', up: 'Up', down: 'Low' };
  const cutNext: Record<UiCutaway, UiCutaway> = { auto: 'up', up: 'down', down: 'auto' };
  function cycleWalls() {
    cutaway = cutNext[cutaway];
    api.setCutaway(cutaway);
  }

  onMount(() => {
    const unsubs = [
      api.snapshot.subscribe((s) => (snap = s)),
      api.selectedCrew.subscribe((c) => (selCrew = c)),
      api.toast.subscribe((t) => (toast = t)),
      api.trade.subscribe((v) => (trade = v)),
      api.prizes.subscribe((v) => {
        if (v.length > prizes.length) {
          prizeOpen = true; // a ship was just taken
          api.selectCrew(null);
        }
        prizes = v;
        if (!v.length) prizeOpen = false;
      }),
      api.tool.subscribe((t) => (tool = t)),
      api.combat.subscribe((c) => {
        combat = c;
        // The overlay opens by itself when a fight starts; closing it is the player's call until the next fight.
        if (c.inCombat && !wasInCombat) combatOpen = true;
        wasInCombat = c.inCombat;
      }),
    ];
    api.attachCanvas(canvas);
    return () => unsubs.forEach((u) => u());
  });

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === ' ') {
      e.preventDefault();
      api.togglePause();
    } else if (e.key === '1' || e.key === '2' || e.key === '3') api.setSpeed(Number(e.key) as 1 | 2 | 3);
    else if (e.key === '`') debug = !debug;
    else if (e.key === 'Escape') {
      if (stockOpen) stockOpen = false;
      else api.selectCrew(null);
    }
  }

  const speeds: { label: string; icon: IconName; speed: 0 | 1 | 2 | 3 }[] = [
    { label: 'Pause', icon: 'pause', speed: 0 },
    { label: '1×', icon: 'play', speed: 1 },
    { label: '2×', icon: 'fast', speed: 2 },
    { label: '3×', icon: 'faster', speed: 3 },
  ];
</script>

<svelte:window onkeydown={onKey} />

<canvas bind:this={canvas}></canvas>

<header>
  <!-- Centre: the always-relevant crew and resources. Right: time. View options live in the bottom-right dock. -->
  <span class="acts">
    {#if trade.partners.length}
      <button class="tile" class:on={tradeOpen} title="Trade" aria-label="Trade" data-testid="trade-open" onclick={() => { tradeOpen = !tradeOpen; if (tradeOpen) { api.selectCrew(null); if (phone()) combatOpen = false; } }}><Icon name="trade" size={20} /></button>
    {/if}
    {#if prizes.length}
      <button class="tile" class:on={prizeOpen} title="Prizes" aria-label="Prizes" data-testid="prize-open" onclick={() => { prizeOpen = !prizeOpen; if (prizeOpen) { api.selectCrew(null); if (phone()) combatOpen = false; } }}><Icon name="prize" size={20} /></button>
    {/if}
    {#if combat.inCombat && !combatOpen}
      <button class="tile fight" title="Combat" aria-label="Combat" data-testid="combat-open" onclick={() => { combatOpen = true; if (phone()) prizeOpen = false; }}><Icon name="combat" size={20} /></button>
    {/if}
  </span>
  <span class="mid">
    <CrewBar {api} />
    <StatsChips {api} {stockOpen} onStock={() => (stockOpen = !stockOpen)} />
  </span>
  <span class="time">
    <span class="tick">T {snap?.tick ?? 0}</span>
    <span class="speeds">
      {#each speeds as s (s.speed)}
        <button class="tile" class:on={snap?.speed === s.speed} title={s.label} aria-label={s.speed === 0 ? 'Pause' : `Speed ${s.label}`} onclick={() => api.setSpeed(s.speed)}><Icon name={s.icon} size={18} /></button>
      {/each}
    </span>
  </span>
</header>

{#if stockOpen}
  <StockDrawer {api} onClose={() => (stockOpen = false)} />
{/if}
{#if debug && snap}
  <DebugPanel {api} {snap} />
{/if}
{#if combat.inCombat && combatOpen}
  <CombatPanel {api} {combat} onClose={() => (combatOpen = false)} onHail={(ship) => { tradeWith = ship; }} />
{/if}
<ToolBar {api}>
    <button class="tile" class:on={cutaway !== 'auto'} title="Walls: {cutLabel[cutaway]}" aria-label="Walls" onclick={cycleWalls}><Icon name="walls" size={18} /></button>
    <OverlayPicker {api} />
    <button class="tile" class:on={debug} title="Debug" aria-label="Debug" onclick={() => (debug = !debug)}><Icon name="debug" size={18} /></button>
</ToolBar>
{#if priorities}
  <PriorityGrid {api} onClose={() => (priorities = false)} />
{:else if tool.tool === 'build' && tool.build === 'module'}
  <BuildModules {api} />
{:else if selCrew === null && tradeOpen && tradeWith === null}
  <TradeList {api} onClose={() => (tradeOpen = false)} onOpen={(ship) => (tradeWith = ship)} />
{:else if selCrew === null && prizeOpen}
  <PrizePanel {api} onClose={() => (prizeOpen = false)} />
{:else}
  <SelectionPanel {api} onPriorities={() => (priorities = true)} />
{/if}
{#if toast}<div class="toast" role="status" data-testid="toast">{toast}</div>{/if}
<AlertList {api} />
{#if tradeWith !== null}
  <TradeWindow {api} partner={tradeWith} onClose={() => (tradeWith = null)} />
{/if}
<StoryModal {api} />
<ErrorOverlay {api} />

<style>
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
  header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 3; pointer-events: none;
    display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; gap: 8px;
    padding: calc(8px + var(--sat)) calc(8px + var(--sar)) 0 calc(8px + var(--sal));
  }
  header > * { pointer-events: auto; }
  .toast { position: fixed; left: 50%; top: calc(var(--hdr) + 100px + var(--sat)); transform: translateX(-50%); max-width: calc(100vw - 32px); padding: 8px 14px; background: var(--panel); border: 1px solid var(--cyan); pointer-events: none; z-index: 9; }
  /* The phone sheet leaves a transparent window for the enemy view; keep other overlays out of it. */
  @media (max-width: 600px) { :global(html[data-combat] .alerts), :global(html[data-combat] .tools), :global(html[data-combat] nav) { display: none; } }
  .fight { border-color: var(--red); color: var(--red); }
  .acts { grid-column: 1; justify-self: start; display: grid; grid-template-columns: repeat(3, 40px); gap: 2px; }
  .mid { grid-column: 2; display: flex; gap: 6px; align-items: start; min-width: 0; }
  .time { grid-column: 3; justify-self: end; display: grid; gap: 2px; justify-items: end; }
  .tick { font: 600 13px/1 var(--head-font); color: var(--dim); letter-spacing: 0.05em; padding: 3px 6px; background: var(--panel); border: 1px solid var(--line); }
  .speeds { display: flex; gap: 2px; }
  @media (max-width: 600px) {
    /* Row 1: tick and speed. Row 2: resources. Row 3: crew. */
    header { grid-template-columns: 1fr auto; gap: 4px; padding-top: calc(4px + var(--sat)); }
    .acts { grid-column: 1; grid-row: 1; grid-auto-flow: column; grid-template-columns: none; grid-auto-columns: 36px; }
    .acts :global(button.tile), .speeds :global(button.tile) { width: 36px; height: 36px; }
    .mid { grid-column: 1 / -1; grid-row: 2; flex-direction: column-reverse; gap: 4px; }
    .time { grid-column: 2; grid-row: 1; grid-template-columns: auto auto; align-items: center; }
    .tick { display: none; }
  }
</style>
