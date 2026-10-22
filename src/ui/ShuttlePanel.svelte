<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiShuttles } from './api';
  import PanelHead from './PanelHead.svelte';
  import PodList from './PodList.svelte';
  import type { UiMining } from './api';

  let { api, onBack }: { api: UiApi; onBack: () => void } = $props();
  let data = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [] });
  let mining = $state<UiMining>({ asteroids: [], pods: [] });
  onMount(() => {
    const u = [api.shuttles.subscribe((v) => (data = v)), api.mining.subscribe((v) => (mining = v))];
    return () => u.forEach((f) => f());
  });

  const where = (s: UiShuttles['shuttles'][number]) =>
    s.state === 'stowed' ? 'Parked in bay'
      : s.state === 'docked' ? `Docked at ${s.dockShip ?? 'airlock'}`
        : s.destination === 'hover' ? 'Flying to hover' : s.hoverShip ? `Hovering beside ${s.hoverShip}` : s.destination === 'dock' ? 'Flying to dock' : s.destination === 'bay' ? 'Returning to bay' : 'Hovering';
  const seatsLeft = (s: UiShuttles['shuttles'][number]) => s.capacity + 1 - (s.pilot ? 1 : 0) - s.passengers.length;
  const embark = (crew: number, vehicle: number) => api.dispatch({ type: 'vehicle.embark', crew, vehicle });
  const free = (s: UiShuttles['shuttles'][number]) => data.roster.filter((c) => !c.boarding || c.boarding === s.id);
  const walking = (s: UiShuttles['shuttles'][number]) => data.roster.filter((c) => c.boarding === s.id);
</script>

<div data-testid="shuttle-panel" aria-label="Shuttles">
  <PanelHead icon="shuttle" title="Shuttles" {onBack} />

  {#each data.shuttles as s (s.id)}
    {@const left = seatsLeft(s)}
    <section data-testid="shuttle-{s.id}">
      <h3>
        {s.name} <small data-testid="shuttle-state">{where(s)}</small>
        <button class="mini" title="Center the camera" onclick={() => api.focusShuttle(s.id)}>Find</button>
      </h3>
      {#if s.trade}<div class="trade" data-testid="shuttle-trade">Trade run for {s.trade.partner}: {s.trade.status}</div>{/if}
      <div class="bar hp"><i style:width="{Math.round((s.hp / Math.max(1, s.maxHp)) * 100)}%"></i></div>

      <div class="crew">
        <div class="slot" class:empty={!s.pilot}>
          <span class="lbl">Pilot</span>
          <span>{s.pilot ? `${s.pilot.name} (${s.pilot.role})` : 'none'}</span>
          {#if s.pilot && s.boardable}
            <button class="mini" onclick={() => s.pilot && api.dispatch({ type: 'vehicle.disembark', vehicle: s.id, crew: s.pilot.id })}>Leave</button>
          {/if}
        </div>
        {#each s.passengers as p (p.id)}
          <div class="slot">
            <span class="lbl">Crew</span><span>{p.name} ({p.role})</span>
            {#if s.boardable}<button class="mini" onclick={() => api.dispatch({ type: 'vehicle.disembark', vehicle: s.id, crew: p.id })}>Leave</button>{/if}
          </div>
        {/each}
        <div class="seats">{s.capacity + 1 - left}/{s.capacity + 1} aboard</div>
      </div>

      {#if s.boardable && left > 0}
        <div class="sub">{s.pilot ? 'Send aboard' : 'Choose the pilot first (first one in flies it)'}{walking(s).length ? ` (${walking(s).length} on the way)` : ''}</div>
        <div class="chips" data-testid="embark-list">
          {#each free(s) as c (c.id)}
            <button class:on={c.boarding === s.id} disabled={c.boarding === s.id || (!s.pilot && walking(s).length > 0)} data-testid="embark-{c.id}" onclick={() => embark(c.id, s.id)}>
              {c.name}<small>{c.role}</small>
            </button>
          {/each}
        </div>
      {/if}

      <div class="btns">
        {#if s.state === 'stowed'}
          <button disabled={!s.pilot} data-testid="shuttle-launch" onclick={() => api.dispatch({ type: 'vehicle.launch', vehicle: s.id })}>Launch</button>
        {/if}
        {#if s.state === 'docked'}
          <button disabled={!s.pilot} data-testid="shuttle-undock" onclick={() => api.dispatch({ type: 'vehicle.undock', vehicle: s.id })}>Undock</button>
        {/if}
        {#if s.state !== 'stowed'}
          <button data-testid="shuttle-return" onclick={() => api.dispatch({ type: 'vehicle.return', vehicle: s.id })}>Return to bay</button>
        {/if}
        {#if s.canEva}
          <button data-testid="shuttle-eva" onclick={() => api.dispatch({ type: 'eva.out', vehicle: s.id })}>Crew out (EVA, {s.suits} suits)</button>
        {/if}
        {#if s.boardable && (s.passengers.length || s.pilot)}
          <button data-testid="shuttle-disembark" onclick={() => api.dispatch({ type: 'vehicle.disembark', vehicle: s.id })}>Passengers out</button>
        {/if}
      </div>

      {#if s.state !== 'docked' && s.pilot}
        <div class="sub">Hover beside (EVA)</div>
        <div class="chips" data-testid="hover-list">
          {#each data.targets as t (t.ship)}
            <button data-testid="hover-{t.ship}" onclick={() => api.dispatch({ type: 'vehicle.hover', vehicle: s.id, ship: t.ship })}>{t.name}</button>
          {:else}
            <span class="none">No other ship in the sector.</span>
          {/each}
        </div>
      {/if}
      {#if s.state !== 'docked'}
        <div class="sub">Dock at</div>
        <div class="chips" data-testid="dock-list">
          {#each data.airlocks as a (a.id)}
            <button disabled={!a.working || a.busy || (s.state === 'stowed' && !s.pilot)} data-testid="dock-{a.id}" onclick={() => api.dispatch({ type: 'vehicle.dock', vehicle: s.id, airlock: a.id })}>
              {a.ship}<small>{a.working ? (a.busy ? 'taken' : `airlock ${a.x},${a.y}`) : 'offline'}</small>
            </button>
          {:else}
            <span class="none">No other ship's airlock in range.</span>
          {/each}
        </div>
      {/if}
    </section>
  {:else}
    <p class="none">No shuttle yet.{data.bays.some((b) => b.empty) ? ' A bay is free: stow a shuttle item from storage.' : ' Build a vehicle bay to hold one.'}</p>
  {/each}

  {#each data.bays.filter((b) => b.empty) as b (b.id)}
    <button class="assign" data-testid="assign-{b.id}" onclick={() => api.dispatch({ type: 'vehicle.assign', bay: b.id })}>Fit a shuttle from storage</button>
  {/each}
  {#if mining.pods.length}
    <section data-testid="shuttle-pods">
      <h3>Mining pods <small>select an asteroid to send one</small></h3>
      <PodList {api} {mining} />
    </section>
  {/if}
</div>

<style>
  h3 { margin: 4px 0; font-size: 15px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  h3 small { color: var(--dim); font-weight: normal; flex: 1; }
  .mini { min-height: 28px; min-width: 0; padding: 0 8px; font-size: 12px; }
  .trade { color: var(--amber); font-size: 12px; margin: 2px 0 4px; }
  .hp > i { background: #4cd964; }
  .crew { margin: 8px 0; display: grid; gap: 4px; }
  .slot { display: flex; align-items: center; gap: 8px; }
  .slot > span:nth-child(2) { flex: 1; }
  .slot.empty > span:nth-child(2) { color: var(--dim); }
  .lbl { color: var(--dim); width: 3em; }
  .seats { color: var(--dim); font-size: 12px; }
  .sub { color: var(--dim); font-size: 12px; margin: 8px 0 4px; }
  .chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .chips button { display: grid; gap: 0; text-align: left; padding: 2px 10px; min-height: 36px; }
  .chips small { color: var(--dim); font-size: 11px; }
  .btns { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
  .none { color: var(--dim); margin: 4px 0; }
  .assign { width: 100%; margin-top: 8px; }
</style>
