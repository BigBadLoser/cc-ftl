<script lang="ts">
  import GameSession from './GameSession.svelte';
  import GoalsCard from './GoalsCard.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import SelectBox from './SelectBox.svelte';
  import { onMount } from 'svelte';
  import { TICK_HZ } from '../sim/time';
  import type { UiStarmap, UiDeploy } from './starmapApi';
  import type { UiApi, UiCombat, UiCrew, UiCutaway, UiPrize, UiSnapshot, UiToolState } from './api';
  import CombatPanel from './CombatPanel.svelte';
  import NavStrip from './NavStrip.svelte';
  import ShipOverview from './ShipOverview.svelte';
  import TradeWindow from './TradeWindow.svelte';
  import StationPanel from './StationPanel.svelte';
  import DebugPanel from './DebugPanel.svelte';
  import SelectionPanel from './SelectionPanel.svelte';
  import CrewBar from './CrewBar.svelte';
  import PriorityGrid from './PriorityGrid.svelte';
  import ToolBar from './ToolBar.svelte';
  import AlertList from './AlertList.svelte';
  import StrandedBanner from './StrandedBanner.svelte';
  import EventLog from './EventLog.svelte';
  import BuildCatalog from './BuildCatalog.svelte';
  import OverlayPicker from './OverlayPicker.svelte';
  import NodeStrip from './NodeStrip.svelte';
  import StockDrawer from './StockDrawer.svelte';
  import JobsPanel from './JobsPanel.svelte';
  import ResearchOverlay from './ResearchOverlay.svelte';
  import JobsTracker from './JobsTracker.svelte';
  import ErrorOverlay from './ErrorOverlay.svelte';
  import StoryModal from './StoryModal.svelte';
  import StarmapView from './StarmapView.svelte';
  import DeployPicker from './DeployPicker.svelte';
  import EventPanel from './EventPanel.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import { isPinned } from './floatingWindow';
  import { closeOutside, outsideTap, type ClosablePanel } from './outsideClick';
  import './theme.css';

  let { api }: { api: UiApi } = $props();

  let canvas: HTMLCanvasElement;
  let debug = $state(false);
  let stockOpen = $state(false);
  let jobsOpen = $state(false);
  let researchOpen = $state(false);
  /** The home ship has a research module: the nav strip shows the research button. */
  let hasLab = $state(false);
  let jobCount = $state(0);
  let priorities = $state(false);
  let toast = $state<string | null>(null);
  let snap = $state<UiSnapshot | undefined>(undefined);
  let combat = $state<UiCombat>({ inCombat: false, player: null, enemies: [] });
  let foes = $state<UiCrew[]>([]);
  let combatOpen = $state(false);
  let wasInCombat = false;
  let overviewOpen = $state(false);
  let mapOpen = $state(false);
  /** The ship fleeing: the starmap was opened from the combat panel to pick the target. */
  let fleeShip = $state<number | null>(null);
  let sliding = $state(false);
  /** The starmap's status (hyperspace trip) and the deploy picker's data, kept fresh even while the map is closed. */
  let star = $state<UiStarmap | null>(null);
  let deploy = $state<UiDeploy | null>(null);
  $effect(() => {
    if (deploy) mapOpen = false; // dropped out: the picker takes over, and the map stays closed once deployed
    else if (star?.state === 'hyperspace') mapOpen = true; // in hyperspace the map is the view
  });
  const mapLocked = $derived(star?.state === 'hyperspace');
  let selShip = $state<number | null>(null);
  /** Partner (ship or station entity id) whose trade window is open, or null. */
  let tradeWith = $state<number | null>(null);
  let prizes = $state<UiPrize[]>([]);
  /** Station entity ids in the node. "Hail station" in a selected station's inspector opens its panel; selecting anything else closes it. */
  let stations = $state<number[]>([]);
  let stationOpen = $state<number | null>(null);
  $effect(() => {
    if (stationOpen !== null && (selShip !== stationOpen || !stations.includes(stationOpen))) stationOpen = null;
  });

  let cutaway = $state<UiCutaway>('auto');
  /** Draw the player ship's roof and hull exterior (view from outside). */
  let roofOn = $state(false);
  let tool = $state<UiToolState>({ tool: 'select', build: 'module', moduleDef: null, rot: 0 });
  $effect(() => {
    document.documentElement.toggleAttribute('data-combat', combat.inCombat && combatOpen);
  });
  let narrow = $state(window.matchMedia('(max-width: 600px)').matches);
  let rcolH = $state(0);
  $effect(() => {
    document.documentElement.style.setProperty('--rcol-h', `${rcolH}px`);
  });
  const phone = () => window.matchMedia('(max-width: 600px)').matches;
  const cutLabel: Record<UiCutaway, string> = { auto: 'Cutaway', up: 'Up', down: 'Low' };
  const cutNext: Record<UiCutaway, UiCutaway> = { auto: 'up', up: 'down', down: 'auto' };
  function toggleRoof() {
    roofOn = !roofOn;
    api.setRoofPlayer(roofOn);
  }
  function cycleWalls() {
    cutaway = cutNext[cutaway];
    api.setCutaway(cutaway);
  }

  onMount(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const onMq = () => (narrow = mq.matches);
    mq.addEventListener('change', onMq);
    const unsubs = [
      () => mq.removeEventListener('change', onMq),
      api.snapshot.subscribe((s) => (snap = s)),
      api.jobs.subscribe((j) => (jobCount = j.active.length)),
      api.research.subscribe((r) => { hasLab = r.labs > 0; if (!hasLab) researchOpen = false; }),
      api.toast.subscribe((t) => (toast = t)),
      api.starmap.subscribe((m) => (star = m)),
      api.deploy.subscribe((d) => (deploy = d)),
      api.selectedShip.subscribe((g) => (selShip = g)),
      api.trade.subscribe((t) => {
        const ids = t.partners.filter((p) => p.station).map((p) => p.id);
        if (ids.join() !== stations.join()) stations = ids;
      }),
      api.prizes.subscribe((v) => {
        if (v.length > prizes.length) {
          const fresh = v.find((x) => !prizes.some((o) => o.ship === x.ship));
          if (fresh) api.selectShip(fresh.ship); // a ship was just taken: show it
        }
        prizes = v;
      }),
      api.tool.subscribe((t) => (tool = t)),
      // Hostile crew where the player's crew are (boarders, aliens on a derelict) light the combat button too.
      api.hostiles.subscribe((v) => (foes = v)),
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

  /**
   * Panels the outside click knows about. A click on the world (or a modal's backdrop) closes every open one that is not `sticky`:
   * combat and the build catalog (while in build mode) stay, as do the goals card, alerts, top bars and toolbar (never listed).
   * A pinned window (floatingWindow.ts) stays open too. The selection inspector is not here: the world tap itself selects or deselects, in the same click;
   * a pinned inspector just stays up, empty, when the selection clears.
   */
  const panels: ClosablePanel[] = [
    { id: 'overview', sticky: false, pinned: () => isPinned('overview'), isOpen: () => overviewOpen, close: () => (overviewOpen = false) },
    { id: 'jobs', sticky: false, pinned: () => isPinned('jobs'), isOpen: () => jobsOpen, close: () => (jobsOpen = false) },
    { id: 'stock', sticky: false, pinned: () => isPinned('stock'), isOpen: () => stockOpen, close: () => (stockOpen = false) },
    { id: 'priorities', sticky: false, pinned: () => isPinned('priorities'), isOpen: () => priorities, close: () => (priorities = false) },
    { id: 'station', sticky: false, pinned: () => isPinned('station'), isOpen: () => stationOpen !== null, close: () => (stationOpen = null) },
    { id: 'trade', sticky: false, isOpen: () => tradeWith !== null, close: () => (tradeWith = null) },
    { id: 'combat', sticky: true, isOpen: () => combat.inCombat && combatOpen, close: () => (combatOpen = false) },
    { id: 'build', sticky: true, isOpen: () => tool.tool === 'build', close: () => {} },
  ];
  const outside = outsideTap(() => closeOutside(panels));

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === ' ') {
      e.preventDefault();
      api.togglePause();
    } else if (e.key === '1' || e.key === '2' || e.key === '3') api.setSpeed(Number(e.key) as 1 | 2 | 3);
    else if (e.key === '`') debug = !debug;
    else if (e.key === 'm') { if (!mapLocked) { fleeShip = null; mapOpen = !mapOpen; } }
    else if (e.key === 'Escape') {
      // A pinned window ignores Esc.
      if (researchOpen) researchOpen = false;
      else if (jobsOpen && !isPinned('jobs')) jobsOpen = false;
      else if (stockOpen && !isPinned('stock')) stockOpen = false;
      else if (overviewOpen && !isPinned('overview')) overviewOpen = false;
      else api.selectCrew(null);
    }
  }

  const speeds: { label: string; icon: IconName; speed: 0 | 1 | 2 | 3 }[] = [
    { label: 'Pause', icon: 'pause', speed: 0 },
    { label: '1×', icon: 'play', speed: 1 },
    { label: '2×', icon: 'fast', speed: 2 },
    { label: '3×', icon: 'faster', speed: 3 },
  ];
  /** Game time played as m:ss (h:mm:ss from an hour), from sim ticks. */
  function clock(tick: number): string {
    const t = Math.floor(tick / TICK_HZ);
    const m = Math.floor(t / 60) % 60;
    const ss = String(t % 60).padStart(2, '0');
    return t >= 3600 ? `${Math.floor(t / 3600)}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  }
</script>

{#snippet time()}
  <span class="time sec">
    <span class="tick" title="Starmap turn (one per hop, and one every 3 minutes of game time) and game time played" data-testid="clock">Turn {star?.turn ?? 0} · {clock(snap?.tick ?? 0)}</span>
    <span class="speeds">
      {#each speeds as s (s.speed)}
        <button class="tile" class:on={snap?.speed === s.speed} title={s.label} aria-label={s.speed === 0 ? 'Pause' : `Speed ${s.label}`} onclick={() => api.setSpeed(s.speed)}><Icon name={s.icon} size={18} /></button>
      {/each}
    </span>
  </span>
{/snippet}

<svelte:window onkeydown={onKey} onpointerdowncapture={(e) => outside.onDown(e)} onpointerupcapture={(e) => outside.onUp(e)} onpointercancelcapture={(e) => outside.onCancel(e)} />

<canvas bind:this={canvas} data-world></canvas>
<SelectBox {api} />
<ContextMenu {api} />

<header>
  <!-- Left: global screens. Centre: crew and what else is in the node. Right: the event log, then time, then notifications. -->
  <NavStrip
    {mapOpen} {mapLocked} onMap={() => { fleeShip = null; mapOpen = !mapOpen; }}
    {overviewOpen} {stockOpen} prioritiesOpen={priorities} hostile={combat.enemies.some((e) => !e.dormant) || foes.length > 0} combatOpen={combat.inCombat && combatOpen}
    {jobsOpen} {jobCount} onJobs={() => (jobsOpen = !jobsOpen)}
    {hasLab} {researchOpen} onResearch={() => (researchOpen = !researchOpen)}
    onOverview={() => (overviewOpen = !overviewOpen)}
    onCrew={() => (priorities = !priorities)}
    onStock={() => (stockOpen = !stockOpen)}
    onCombat={() => { if (combat.inCombat) { combatOpen = !combatOpen; if (phone()) priorities = false; } }}
  />
  <span class="mid">
    <CrewBar {api} />
    <NodeStrip {api} selected={selShip} />
  </span>
  {#if narrow}{@render time()}{/if}
</header>

{#if overviewOpen}
  <ShipOverview {api} {stockOpen} onStock={() => (stockOpen = !stockOpen)} onClose={() => (overviewOpen = false)} />
{/if}
{#if researchOpen}
  <ResearchOverlay {api} onClose={() => (researchOpen = false)} />
{/if}
{#if jobsOpen}
  <JobsPanel {api} onClose={() => (jobsOpen = false)} />
{/if}
{#if stockOpen}
  <StockDrawer {api} onClose={() => (stockOpen = false)} />
{/if}
{#if debug && snap}
  <DebugPanel {api} {snap} />
{/if}
{#if combat.inCombat && combatOpen}
  <CombatPanel {api} {combat} onClose={() => (combatOpen = false)} onFlee={(ship) => { if (star?.event) api.dispatch({ type: 'combat.flee', ship }); else { fleeShip = ship; mapOpen = true; } }} onHail={(ship) => { tradeWith = ship; }} />
{/if}
<ToolBar {api}>
    <button class="tile" class:on={cutaway !== 'auto'} title="Walls: {cutLabel[cutaway]}" aria-label="Walls" onclick={cycleWalls}><Icon name="walls" size={18} /></button>
    <button class="tile" class:on={roofOn} aria-pressed={roofOn} title="Roof: {roofOn ? 'on (outside view)' : 'off'}" aria-label="Roof" data-testid="toggle-roof" onclick={toggleRoof}><Icon name="roof" size={18} /></button>
    <OverlayPicker {api} />
    <button class="tile" class:on={debug} title="Debug" aria-label="Debug" onclick={() => (debug = !debug)}><Icon name="debug" size={18} /></button>
</ToolBar>
{#if priorities}
  <PriorityGrid {api} onClose={() => (priorities = false)} />
{:else if tool.tool === 'build'}
  <BuildCatalog {api} />
{:else}
  <SelectionPanel {api} onResearch={() => (researchOpen = true)} onPriorities={() => (priorities = true)} onTrade={(ship) => (tradeWith = ship)} onStation={(ship) => (stationOpen = ship)} />
{/if}
{#if toast}<div class="toast" role="status" data-testid="toast">{toast}</div>{/if}

{#if stationOpen !== null}
  <StationPanel {api} station={stationOpen} onClose={() => (stationOpen = null)} />
{/if}
{#if tradeWith !== null}
  <TradeWindow {api} partner={tradeWith} onClose={() => (tradeWith = null)} />
{/if}
{#if star?.event && !deploy && !mapOpen}<EventPanel {api} event={star.event} result={star.result} />{/if}
{#if deploy}<DeployPicker {api} {deploy} />{:else if mapOpen}<StarmapView {api} flee={fleeShip} onClose={() => { if (mapLocked) return; mapOpen = false; sliding = false; fleeShip = null; }} onSlide={(on) => (sliding = on)} />{/if}
<StoryModal {api} hold={sliding} />
<ErrorOverlay {api} />
<GameSession {api} />

<!-- Top right: one column. Log and time controls (desktop; on phone the time sits in the header) in one frame; the tutorial goals, the accepted-jobs tracker, then alerts, stack below as separate cards. -->
<div class="rcol" bind:clientHeight={rcolH}>
  <div class="frame">
    <EventLog {api} />
    {#if !narrow}{@render time()}{/if}
  </div>
  <div class="cards">
    <GoalsCard {api} />
    <JobsTracker {api} onOpen={() => (jobsOpen = true)} />
  </div>
  <StrandedBanner {api} />
  <AlertList {api} />
</div>

<style>
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
  header {
    position: fixed; top: 0; left: 0; right: 0; z-index: 3; pointer-events: none;
    display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; gap: 8px;
    /* The right padding keeps the header's content clear of the fixed top-right column (.rcol, 260px wide), so nothing slides under the clock. */
    padding: calc(8px + var(--sat)) calc(16px + var(--sar) + min(260px, 100vw - 110px)) 0 calc(8px + var(--sal));
  }
  /* Desktop: a third column, as wide as the top-right column, balances the nav strip so the crew bar sits centred on the screen
     when it fits. Where it does not, the side columns keep their minimum and it centres in the free space between them. */
  @media (min-width: 601px) {
    header { grid-template-columns: minmax(auto, 1fr) minmax(0, auto) minmax(auto, 1fr); padding-right: calc(8px + var(--sar)); }
    header::after { content: ''; grid-column: 3; grid-row: 1; width: calc(16px + var(--sar) + min(260px, 100vw - 110px)); justify-self: end; }
    header > :global(.strip) { grid-row: 1; }
    header > .mid { grid-row: 1; justify-self: center; }
  }
  header > :global(*) { pointer-events: auto; }
  .toast { position: fixed; left: 50%; top: calc(var(--hdr) + 100px + var(--sat)); transform: translateX(-50%); max-width: calc(100vw - 32px); padding: 8px 14px; background: var(--panel); border: 1px solid var(--cyan); pointer-events: none; z-index: 9; }
  /* The phone sheet leaves a transparent window for the enemy view; keep other overlays out of it. */
  @media (max-width: 600px) { :global(html[data-combat] .alerts), :global(html[data-combat] .tools), :global(html[data-combat] nav) { display: none; } }
  header > :global(.strip) { grid-column: 1; justify-self: start; }
  .mid { grid-column: 2; justify-self: start; max-width: 100%; display: flex; gap: 6px; align-items: start; min-width: 0; }
  /* The top-right frame: log and time in a single box divided by a hairline; alerts hang below it. */
  .rcol { position: fixed; z-index: 4; top: calc(var(--sat) + 8px); right: calc(8px + var(--sar)); width: min(260px, calc(100vw - 110px)); display: flex; flex-direction: column; gap: 4px; }
  /* An expanded alert (hover or tap) draws over the combat panel below it. */
  .rcol:has(:global(.alert:hover)), .rcol:has(:global(.alert:focus-within)) { z-index: 8; }
  /* Goals and jobs stack as one group under the log. */
  .cards { display: flex; flex-direction: column; gap: 4px; }
  .frame { background: var(--panel); border: 1px solid var(--line-hi); }
  .frame > :global(.sec + .sec) { border-top: 1px solid var(--line); }
  .time { display: flex; align-items: center; gap: 0; }
  .tick { flex: 1; font: 600 13px/1 var(--head-font); color: var(--dim); letter-spacing: 0.05em; padding: 0 8px; }
  .speeds { display: flex; }
  .speeds :global(button.tile) { border: 0; border-left: 1px solid var(--line); background: transparent; width: 36px; height: 36px; }
  .speeds :global(button.tile:hover) { background: var(--panel-3); }
  .speeds :global(button.tile.on) { background: var(--panel-3); box-shadow: inset 0 0 0 1px var(--cyan); }
  @media (max-width: 600px) {
    /* Row 1: tick and speed. Row 2: resources. Row 3: crew. */
    header { grid-template-columns: auto 1fr; gap: 4px; padding: calc(4px + var(--sat)) calc(8px + var(--sar)) 0 calc(8px + var(--sal)); }
    .rcol { right: auto; left: calc(8px + var(--sal)); top: calc(var(--hdr) + var(--sat) + 6px); width: calc(100vw - 62px - var(--sar)); }
    .frame:not(:has(.sec)) { display: none; }
    header .time { background: var(--panel); border: 1px solid var(--line-hi); }
    .mid { grid-column: 1 / -1; grid-row: 2; flex-direction: column-reverse; gap: 4px; }
    header > :global(.strip) { grid-row: 1; }
    header .time { grid-column: 2; grid-row: 1; justify-self: end; }
    .tick { display: none; }
  }
</style>
