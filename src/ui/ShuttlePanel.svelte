<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiShuttles } from './api';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();
  let data = $state<UiShuttles>({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [] });
  onMount(() => api.shuttles.subscribe((v) => (data = v)));

  const where = (s: UiShuttles['shuttles'][number]) =>
    s.state === 'stowed' ? 'Parked in bay'
      : s.state === 'docked' ? `Docked at ${s.dockShip ?? 'airlock'}`
        : s.destination === 'hover' ? 'Flying to hover' : s.hoverShip ? `Hovering beside ${s.hoverShip}` : s.destination === 'dock' ? 'Flying to dock' : s.destination === 'bay' ? 'Returning to bay' : 'Hovering';
  const seatsLeft = (s: UiShuttles['shuttles'][number]) => s.capacity + 1 - (s.pilot ? 1 : 0) - s.passengers.length;
  const embark = (crew: number, vehicle: number) => api.dispatch({ type: 'vehicle.embark', crew, vehicle });
  const free = (s: UiShuttles['shuttles'][number]) => data.roster.filter((c) => !c.boarding || c.boarding === s.id);
  const walking = (s: UiShuttles['shuttles'][number]) => data.roster.filter((c) => c.boarding === s.id);
</script>

<aside class="sheet" data-testid="shuttle-panel" aria-label="Shuttles">
  <header>
    <strong>Shuttles</strong>
    <button aria-label="Close shuttle panel" data-testid="shuttle-close" onclick={onClose}>×</button>
  </header>

  {#each data.shuttles as s (s.id)}
    {@const left = seatsLeft(s)}
    <section data-testid="shuttle-{s.id}">
      <h3>
        {s.name} <small data-testid="shuttle-state">{where(s)}</small>
        <button class="mini" title="Center the camera" onclick={() => api.focusShuttle(s.id)}>Find</button>
      </h3>
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
          {#each data.targets as t (t.gridId)}
            <button data-testid="hover-{t.gridId}" onclick={() => api.dispatch({ type: 'vehicle.hover', vehicle: s.id, gridId: t.gridId })}>{t.name}</button>
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
</aside>

<style>
  aside { left: calc(8px + var(--sal)); bottom: calc(8px + var(--sab)); width: 310px; max-height: calc(100vh - var(--hdr) - 24px); overflow-y: auto; }
  header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; color: var(--cyan); }
  header button { min-height: 32px; min-width: 32px; padding: 0 8px; }
  h3 { margin: 4px 0; font-size: 15px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  h3 small { color: var(--dim); font-weight: normal; flex: 1; }
  .mini { min-height: 28px; min-width: 0; padding: 0 8px; font-size: 12px; }
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
  @media (max-width: 600px) { aside { width: auto; left: 0; bottom: 0; max-height: 46vh; z-index: 8; } }
</style>
