<script lang="ts">
  /**
   * The starmap's side drawer (right on desktop, a bottom sheet on phones). Docked: the picked node's sector info, the fuel info,
   * the route hop by hop, and Jump (which opens the confirm step in place when the jump would leave something behind). In hyperspace:
   * the progress along the route and "Drop from hyperspace".
   */
  import Icon from './Icon.svelte';
  import PanelHead from './PanelHead.svelte';
  import type { UiJumpWarnings, UiStarCluster, UiStarFaction, UiStarmap, UiStarNode, UiStarRoute, UiStarSector } from './starmapApi';
  import { dangerColor, toneColor } from './starmapStyle';

  let { map, node, sector, cluster, factions, route, nodes, fleeing = false, warnings = null, taking, onGo, onConfirm, onCancel, onToggle, onDrop, onClear }: {
    map: UiStarmap; node: UiStarNode | null; sector: UiStarSector | null; cluster: UiStarCluster | null; factions: UiStarFaction[];
    route: UiStarRoute | null; nodes: Map<string, UiStarNode>;
    /** Flee-target mode: the button flees (a one-hop trip away from the fight) instead of jumping. */
    fleeing?: boolean;
    /** The confirm step: what the jump would leave behind (null = not confirming) and which docked shuttles come along. */
    warnings?: UiJumpWarnings | null; taking: Set<number>;
    onGo: () => void; onConfirm: () => void; onCancel: () => void; onToggle: (id: number) => void; onDrop: () => void; onClear: () => void;
  } = $props();

  const travel = $derived(map.travel);
  const owner = $derived(node?.faction ? factions.find((f) => f.id === node.faction) ?? null : null);
  const nameOf = (id: string): string => {
    const n = nodes.get(id);
    return n?.known ? n.name : 'Uncharted';
  };
  const legs = $derived(travel ? travel.route.slice(1).map((id, i) => ({ id, done: i < travel.at, now: i === travel.at && travel.phase === 'hop' })) : []);
  const afterRoute = $derived(route ? map.fuel - route.fuel : map.fuel);
  const title = $derived(travel ? 'In hyperspace' : node ? (node.known ? node.name : 'Unexplored') : 'Course');
  const sub = $derived(travel ? `Turn ${map.turn}` : [sector?.known ? sector.name : null, `Danger ${node?.danger ?? 0}`].filter(Boolean).join(' · '));
  const label = $derived(fleeing ? 'Flee here' : route && route.hops > 1 ? `Jump (${route.hops} hops)` : 'Jump');
  const dropNote = $derived(
    travel?.phase === 'noFuel' ? `Out of fuel for the next hop (needs ${travel.need}). Drop here or refuel.`
    : travel?.phase === 'arrived' ? 'You have reached the end of the route.'
    : travel?.stopping ? `Dropping out at ${nameOf(travel.route[travel.at + 1] as string)} when the hop ends.`
    : 'Mid-hop, you drop out at the next node.',
  );
</script>

<aside class="sheet drawer" data-testid="starmap-drawer">
  <PanelHead icon="map" {title} {sub} onBack={travel ? undefined : onClear} backIcon="close" backTitle="Close drawer" backTestId="starmap-card-close" />

  {#if travel}
    <section>
      <h4>Progress</h4>
      <div class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={travel.route.length - 1} aria-valuenow={travel.at}><i style={`width: ${(travel.at / Math.max(1, travel.route.length - 1)) * 100}%`}></i></div>
      <ol class="legs" data-testid="starmap-progress">
        <li class="done"><Icon name="station" size={14} /><span>{nameOf(travel.route[0] as string)}</span><small>start</small></li>
        {#each legs as l (l.id)}
          <li class:done={l.done} class:now={l.now}><Icon name={l.done ? 'station' : l.now ? 'fast' : 'target'} size={14} /><span>{nameOf(l.id)}</span><small>{l.done ? 'passed' : l.now ? 'under way' : ''}</small></li>
        {/each}
      </ol>
    </section>
    <section>
      <h4>Fuel</h4>
      <div class="cells">
        <span class="cell" class:bad={map.fuel < 2} title="Fuel left"><Icon name="fuel" size={18} /><b>{map.fuel}</b></span>
        <span class="cell" title="FTL charge"><Icon name="bolt" size={18} /><b>{map.charge}/{map.chargeMax}</b><small>s</small></span>
      </div>
    </section>
    <p class="note" class:warn={travel.phase === 'noFuel'}>{dropNote}</p>
    <button class="go" onclick={onDrop} disabled={travel.stopping} data-testid="starmap-drop"><Icon name="back" size={18} />Drop from hyperspace</button>
  {:else if node}
    <section>
      <h4>Sector</h4>
      <div class="row"><b>{sector?.known ? sector.name : 'Uncharted sector'}</b>{#if cluster?.revealed}<span class="dim">{cluster.name}, {cluster.typeLabel}</span>{/if}</div>
      <div class="row">
        <span class="chip" style={`color: ${dangerColor(node.danger)}`}>Danger {node.danger}</span>
        {#if node.known}
          {#if owner}<span class="chip" style={`color: ${toneColor(owner.tone)}`}>{owner.name}</span><span class="chip tier {owner.tier}">{owner.tier}</span>{:else}<span class="dim">Open space</span>{/if}
        {/if}
      </div>
      {#if node.known}
        <div class="row">{node.structures.length ? node.structures.join(', ') : 'Empty space'}</div>
        {#if node.resources.length}<div class="row dim">Resources: {node.resources.join(', ')}</div>{/if}
        {#if node.hostiles}<div class="row warn" data-testid="starmap-hostiles"><Icon name="alert" size={14} />{node.hostiles} hostile ship{node.hostiles > 1 ? 's' : ''} present</div>{/if}
        {#if node.others}<div class="row dim">{node.others} other ship{node.others > 1 ? 's' : ''} in the area</div>{/if}
      {/if}
    </section>
    {#if node.current}
      <p class="note here">Your ship is here.</p>
    {:else if route}
      <section>
        <h4>Fuel</h4>
        <div class="cells" data-testid="starmap-route">
          <span class="cell" title="Fuel now"><Icon name="fuel" size={18} /><b>{map.fuel}</b></span>
          <span class="cell" class:bad={!route.fuelOk} title="Fuel the whole route burns"><Icon name="fuel" size={18} /><b>-{route.fuel}</b></span>
          <span class="cell" class:bad={afterRoute < 0} title="Fuel left after the route"><Icon name="fuel" size={18} /><b>{afterRoute}</b><small>left</small></span>
          <span class="cell" class:bad={!route.chargeOk} title="FTL charge needed to enter hyperspace (spent once)"><Icon name="bolt" size={18} /><b>{route.nextCharge}</b><small>s</small></span>
        </div>
        {#if !route.fuelOk}<p class="note warn">Not enough fuel for the whole route: the trip will stop where the fuel runs out.</p>{/if}
      </section>
      <section>
        <h4>Route</h4>
        <ol class="legs">
          {#each route.legs as l, i (l.to)}
            <li><span class="n">{i + 1}</span><span>{nameOf(l.to)}</span><small><Icon name="fuel" size={11} />{l.fuel}{l.gate ? ' · gate' : l.kind === 'hyperlane' ? ' · hyperlane' : ''}</small></li>
          {/each}
        </ol>
      </section>
      {#if warnings}
        <section class="confirm" data-testid="starmap-confirm">
          <h4>Before you jump</h4>
          {#if warnings.crew.length}<p class="note warn"><Icon name="person" size={14} />Left behind: {warnings.crew.join(', ')}.</p>{/if}
          {#if warnings.vehicles.length}<p class="note warn"><Icon name="shuttle" size={14} />Not aboard: {warnings.vehicles.join(', ')}.</p>{/if}
          {#each warnings.hostileDocked as d (d.id)}
            <label class="take"><input type="checkbox" checked={taking.has(d.id)} onchange={() => onToggle(d.id)} data-testid="starmap-take" />Take docked {d.name} along (else it is cut loose)</label>
          {/each}
          <div class="two">
            <button onclick={onCancel}>Cancel</button>
            <button class="go" onclick={onConfirm} data-testid="starmap-confirm-go"><Icon name={fleeing ? 'evasion' : 'fast'} size={18} />Confirm</button>
          </div>
        </section>
      {:else}
        <button class="go" disabled={!!route.blocker} onclick={onGo} data-testid="starmap-jump"><Icon name={fleeing ? 'evasion' : 'fast'} size={18} />{label}</button>
        {#if route.blocker}<p class="note dim">{route.blocker}</p>{:else}<p class="note dim">Tap the node again to go.</p>{/if}
      {/if}
    {:else if node.known}
      <p class="note dim">No known route.</p>
    {/if}
  {/if}
</aside>

<style>
  /* Solid under the near-opaque panel colour, so map labels never ghost through the text. */
  .drawer { position: absolute; z-index: 12; display: grid; gap: 8px; align-content: start; overflow-y: auto; box-sizing: border-box; background: linear-gradient(var(--panel), var(--panel)), var(--bg); }
  section { display: grid; gap: 4px; }
  h4 { margin: 0; font: 600 12px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--cyan); }
  .row { font-size: 13px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .dim { color: var(--dim); }
  .warn { color: var(--red); }
  .here { color: var(--cyan); }
  .note { margin: 0; font-size: 12px; display: flex; gap: 6px; align-items: center; }
  .chip { font: 600 12px var(--head-font); letter-spacing: 0.06em; text-transform: uppercase; padding: 2px 6px; border: 1px solid currentColor; }
  .tier.hostile { color: var(--red); } .tier.friendly { color: var(--green); } .tier.neutral { color: var(--dim); }
  .cells { display: flex; gap: 4px; flex-wrap: wrap; }
  .cell { display: flex; align-items: center; gap: 6px; padding: 6px 8px; min-height: 20px; background: var(--panel-2); border: 1px solid var(--line); color: var(--cyan); }
  .cell b { color: var(--text); font-weight: 600; }
  .cell small { color: var(--dim); font-size: 11px; }
  .cell.bad { border-color: var(--red); color: var(--red); }
  .legs { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; }
  .legs li { display: flex; align-items: center; gap: 8px; padding: 4px 8px; background: var(--panel-2); border: 1px solid var(--line); font-size: 13px; color: var(--dim); }
  .legs li span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text); }
  .legs li small { display: inline-flex; align-items: center; gap: 4px; color: var(--dim); font-size: 11px; }
  .legs li.done { color: var(--cyan); }
  .legs li.now { border-color: var(--cyan); background: var(--panel-3); color: var(--cyan); }
  .n { font: 600 12px var(--head-font); color: var(--cyan); min-width: 12px; }
  .confirm { padding: 8px; border: 1px solid var(--amber); background: var(--panel-2); }
  .take { display: flex; gap: 8px; align-items: center; font-size: 13px; min-height: 32px; }
  .take input { width: 20px; height: 20px; accent-color: var(--cyan); }
  .two { display: flex; gap: 6px; }
  .two button { flex: 1; }
  button { display: flex; align-items: center; justify-content: center; gap: 8px; font: 600 15px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .go { border-color: var(--cyan); background: var(--panel-3); color: var(--text); }
  .go:disabled { opacity: 0.4; }
  .bar { height: 8px; }
  @media (min-width: 601px) { .drawer { top: 0; right: 0; bottom: 0; width: 340px; border-width: 0 0 0 1px; } }
  @media (max-width: 600px) { .drawer { left: 0; right: 0; bottom: 0; } }
</style>
