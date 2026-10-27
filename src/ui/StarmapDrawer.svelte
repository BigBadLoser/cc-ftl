<script lang="ts">
  /**
   * The starmap's side drawer (right on desktop, a bottom sheet on phones). Docked: the picked node's sector info, the fuel info,
   * the route hop by hop, and Jump (which opens the confirm step in place when the jump would leave something behind). In hyperspace:
   * the progress along the route and "Drop from hyperspace".
   */
  import FtlCharge from './FtlCharge.svelte';
  import Icon from './Icon.svelte';
  import type { UiFtl } from './api';
  import PanelHead from './PanelHead.svelte';
  import StarmapEncounter from './StarmapEncounter.svelte';
  import type { UiEncounterChoice, UiJumpWarnings, UiStarCluster, UiStarFaction, UiStarmap, UiStarNode, UiStarRoute, UiStarSector } from './starmapApi';
  import { dangerColor, toneColor } from './starmapStyle';

  let { map, node, sector, cluster, factions, route, nodes, fleeing = false, warnings = null, taking, ftl = null, onGo, onQueue, onOvercharge, onCharge, onCancelCharge, onConfirm, onCancel, onToggle, onDrop, onClear, onRespond }: {
    map: UiStarmap; node: UiStarNode | null; sector: UiStarSector | null; cluster: UiStarCluster | null; factions: UiStarFaction[];
    route: UiStarRoute | null; nodes: Map<string, UiStarNode>;
    /** Flee-target mode: the button flees (a one-hop trip away from the fight) instead of jumping. */
    fleeing?: boolean;
    /** The confirm step: what the jump would leave behind (null = not confirming) and which docked shuttles come along. */
    warnings?: UiJumpWarnings | null; taking: Set<number>;
    /** The FTL drive and its order; Charge FTL / Cancel; "Jump when charged" queues the plotted route behind the charge. */
    ftl?: UiFtl | null; onQueue: () => void; onOvercharge: () => void; onCharge: () => void; onCancelCharge: () => void;
    onGo: () => void; onConfirm: () => void; onCancel: () => void; onToggle: (id: number) => void; onDrop: () => void; onClear: () => void; onRespond: (id: number, choice: UiEncounterChoice['choice']) => void;
  } = $props();

  const travel = $derived(map.travel);
  const owner = $derived(node?.faction ? factions.find((f) => f.id === node.faction) ?? null : null);
  const nameOf = (id: string): string => {
    const n = nodes.get(id);
    return n?.known ? n.name : 'Uncharted';
  };
  const legs = $derived(travel ? travel.route.slice(1).map((id, i) => ({ id, done: i < travel.at, now: i === travel.at && travel.phase === 'hop' })) : []);
  const traffic = $derived(node ? map.fleets.filter((f) => f.node === node.id) : []);
  const blocked = $derived(travel?.phase === 'interdicted' || travel?.phase === 'event' || travel?.phase === 'story');
  const recent = $derived(map.result && map.encounters.length === 0 && map.turn - map.result.turn <= 3 ? map.result : null);
  const title = $derived(travel ? (travel.phase === 'interdicted' ? 'Interdicted' : travel.phase === 'story' ? 'Signal received' : 'In hyperspace') : node ? (node.known ? node.name : 'Unexplored') : 'Course');
  const sub = $derived(travel ? `Turn ${map.turn}` : `Danger ${node?.danger ?? 0}`);
  const label = $derived(fleeing ? 'Flee here' : route && route.hops > 1 ? `Jump (${route.hops} hops)` : 'Jump');
  const dropNote = $derived(
    travel?.phase === 'noFuel' ? `Out of fuel for the next hop (needs ${travel.need}). Drop here or refuel.`
    : travel?.phase === 'arrived' ? 'You have reached the end of the route.'
    : travel?.phase === 'story' ? 'Travel is held until you answer the signal.'
    : travel?.phase === 'interdicted' ? 'Travel is halted until you answer the interdiction.'
    : travel?.stopping ? `Dropping out at ${nameOf(travel.route[travel.at + 1] as string)} when the hop ends.`
    : 'Mid-hop, you drop out at the next node.',
  );
</script>

<aside class="sheet drawer" data-testid="starmap-drawer">
  <PanelHead icon="map" {title} {sub} onBack={travel ? undefined : onClear} backIcon="close" backTitle="Close drawer" backTestId="starmap-card-close" />

  {#if travel}
    {#each map.encounters.filter((x) => x.kind !== 'interdict') as e (e.id)}
      <StarmapEncounter encounter={e} onChoose={onRespond} />
    {/each}
    {#if recent}<p class="note result {recent.tone}" data-testid="starmap-result"><Icon name={recent.tone === 'red' ? 'alert' : 'chevUp'} size={14} />{recent.text}</p>{/if}
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
    <button class="go" onclick={onDrop} disabled={travel.stopping || blocked} data-testid="starmap-drop">Drop from hyperspace</button>
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
        {#each node.jobs ?? [] as j, i (i)}<div class="row job" class:bounty={j.kind === 'bounty'} data-testid="starmap-job">{j.label}</div>{/each}
        {#if node.hints?.length}<div class="row stock" data-testid="starmap-hints" title="Notable stock here"><span class="dim">Stock</span>{#each node.hints as h (h)}<span class="chip">{h}</span>{/each}</div>{/if}
        {#if node.market}
          <div class="row market" data-testid="starmap-market" title="Prices follow the port's stock: cheap where plentiful, dear where scarce">
            <span class="dim">Market</span>
            {#each node.market.cheap as g (g)}<span class="good cheap"><Icon name="chevDown" size={11} />{g}</span>{/each}
            {#each node.market.dear as g (g)}<span class="good dear"><Icon name="chevUp" size={11} />{g}</span>{/each}
            {#if !node.market.cheap.length && !node.market.dear.length}<span class="dim">prices steady</span>{/if}
          </div>
        {/if}
        {#if node.hostiles}<div class="row warn" data-testid="starmap-hostiles"><Icon name="alert" size={14} />{node.hostiles} hostile ship{node.hostiles > 1 ? 's' : ''} present</div>{/if}
        {#if traffic.length}
          <ul class="traffic" data-testid="starmap-traffic">
            {#each traffic as f (f.id)}
              <li class:hostile={f.hostile} title={`${f.heading}. Home: ${f.home}`}>
                <i style={`background: ${toneColor(f.tone)}`}></i>
                <span><b>{f.name}</b> <small>{f.faction} {f.role.toLowerCase()}</small></span>
                <small class="sub">{f.heading.endsWith(f.home) ? f.heading : `${f.heading} · home ${f.home}`}</small>
                {#if f.cargo}<small class="sub cargo" data-testid="starmap-cargo">Carrying {f.cargo}</small>{/if}
              </li>
            {/each}
          </ul>
        {/if}
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
          <span class="cell" class:bad={!route.fuelOk} title="Fuel the whole route burns"><Icon name="fuel" size={18} /><b>{route.fuel}</b><small>burn</small></span>
          {#if route.fuelShort > 0}
            <span class="cell bad" title="Fuel missing for the whole route" data-testid="starmap-fuel-short"><Icon name="fuel" size={18} /><b>{route.fuelShort}</b><small>short</small></span>
          {:else}
            <span class="cell" title="Fuel left after the route" data-testid="starmap-fuel-left"><Icon name="fuel" size={18} /><b>{map.fuel - route.fuel}</b><small>left</small></span>
          {/if}
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
        <button class="go" disabled={!!route.blocker || (!!route.overweight && !fleeing)} onclick={onGo} data-testid="starmap-jump"><Icon name={fleeing ? 'evasion' : 'fast'} size={18} />{label}</button>
        {#if route.blocker}<p class="note dim">{route.blocker}</p>{:else if !route.overweight || fleeing}<p class="note dim">Tap the node again to go.</p>{/if}
        {#if route.overweight && !fleeing}
          <p class="note warn" data-testid="starmap-overweight">Overweight: hull {route.overweight.tiles} / {route.overweight.capacity}. The engines can't jump this much hull.</p>
          <button class="overcharge" disabled={!!route.blocker && route.chargeOk} onclick={onOvercharge} data-testid="starmap-overcharge"><Icon name="bolt" size={18} />Overcharge{route.chargeOk ? '' : ' when charged'}</button>
          <p class="note warn" data-testid="starmap-overcharge-risk">Risks engine damage, a lost engine and fires in the engine room.</p>
        {/if}
        {#if !route.chargeOk && !fleeing && !ftl?.queued && !route.overweight}
          <button class="queue" disabled={!!ftl?.blocker} onclick={onQueue} data-testid="starmap-queue"><Icon name="bolt" size={18} />Jump when charged</button>
        {/if}
        <FtlCharge {ftl} testid="starmap-ftl" {onCharge} onCancel={onCancelCharge} />
      {/if}
    {:else if node.known}
      <p class="note dim">No known route.</p>
    {/if}
  {/if}
</aside>

<style>
  /* Solid under the near-opaque panel colour, so map labels never ghost through the text. */
  .drawer { position: absolute; z-index: 12; display: grid; gap: 8px; align-content: start; overflow-x: hidden; overflow-y: auto; box-sizing: border-box; grid-template-columns: minmax(0, 1fr); background: linear-gradient(var(--panel), var(--panel)), var(--bg); }
  section { display: grid; gap: 4px; }
  h4 { margin: 0; font: 600 12px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--cyan); }
  .row { font-size: 13px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .dim { color: var(--dim); }
  .warn { color: var(--red); }
  .here { color: var(--cyan); }
  .result { padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--line); }
  .result.green { color: var(--green); border-color: var(--green); } .result.amber { color: var(--amber); border-color: var(--amber); }
  .result.red { color: var(--red); border-color: var(--red); } .result.dim { color: var(--dim); }
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
  .traffic { margin: 0; padding: 0; list-style: none; display: grid; gap: 2px; }
  .traffic li { display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: 8px; row-gap: 1px; padding: 3px 8px; background: var(--panel-2); border: 1px solid var(--line); font-size: 12px; }
  .traffic li b { font-weight: 600; }
  .market .good { display: inline-flex; align-items: center; gap: 2px; }
  .market .cheap { color: var(--green); }
  .market .dear { color: var(--amber); }
  .traffic .cargo { color: var(--text); }
  .traffic .sub { grid-column: 2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .traffic li.hostile { border-color: var(--red); }
  .traffic i { width: 8px; height: 8px; flex: none; clip-path: polygon(100% 50%, 0 0, 25% 50%, 0 100%); }
  .traffic span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .traffic small { color: var(--dim); font-size: 11px; }
  .n { font: 600 12px var(--head-font); color: var(--cyan); min-width: 12px; }
  .confirm { padding: 8px; border: 1px solid var(--amber); background: var(--panel-2); }
  .take { display: flex; gap: 8px; align-items: center; font-size: 13px; min-height: 32px; }
  .take input { width: 20px; height: 20px; accent-color: var(--cyan); }
  .two { display: flex; gap: 6px; }
  .two button { flex: 1; }
  button { display: flex; align-items: center; justify-content: center; gap: 8px; font: 600 15px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .go { border-color: var(--cyan); background: var(--panel-3); color: var(--text); }
  .go:disabled, .queue:disabled { opacity: 0.4; }
  .queue { border-color: var(--line); background: var(--panel-2); color: var(--text); }
  .overcharge { border-color: var(--red); background: var(--panel-2); color: var(--red); }
  .overcharge:disabled { opacity: 0.4; }
  .bar { height: 8px; }
  @media (min-width: 601px) { .drawer { top: 0; right: 0; bottom: 0; width: 340px; border-width: 0 0 0 1px; } }
  @media (max-width: 600px) { .drawer { left: 0; right: 0; bottom: 0; } }
  .row.job { color: var(--amber); font-weight: 600; }
  .row.job.bounty { color: var(--red); }
</style>
