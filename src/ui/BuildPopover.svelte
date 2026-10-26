<script lang="ts">
  import type { UiApi, UiThumb } from './api';
  import { CATEGORIES, shortOf, type Entry } from './buildCatalog';
  import BuildPreview from './BuildPreview.svelte';
  import Icon from './Icon.svelte';
  import ItemIcon from './ItemIcon.svelte';

  let { api, entry, rect, rot, thumb, have, variants = [], onvariant, pinned, onpin, onenter, onleave }: {
    api: UiApi; entry: Entry; rect: DOMRect; rot: number; thumb?: UiThumb; have: (item: string) => number;
    /** The tiers of the module's family (itself included), lowest first; empty when it has none. */
    variants?: Entry[]; onvariant?: (v: Entry) => void;
    pinned: boolean; onpin: () => void; onenter: () => void; onleave: () => void;
  } = $props();

  let vw = $state(innerWidth);
  let vh = $state(innerHeight);
  const W = $derived(Math.min(600, vw - 16));
  const cx = $derived(rect.left + rect.width / 2);
  /** Biased toward the screen centre: the card's x fraction of the viewport decides how much of the popover lies left of the card. */
  const left = $derived(Math.max(8, Math.min(vw - W - 8, cx - W * Math.min(1, Math.max(0, cx / vw)))));
  const narrow = $derived(W < 540);
  const miss = $derived(new Set(shortOf(entry.cost, have).map((c) => c.item)));
  const catLabel = $derived(CATEGORIES.find((c) => c.id === entry.category)?.label ?? '');
  const def = $derived(entry.def);
</script>

<svelte:window bind:innerWidth={vw} bind:innerHeight={vh} />
<div class="pop" role="tooltip" data-testid="build-popover" style:width="{W}px" style:left="{left}px" style:bottom="{vh - rect.top + 18}px" onmouseenter={onenter} onmouseleave={onleave}>
  <div class="phd"><b>{entry.name}</b><span class="chip">{catLabel}{def?.tier ? ` · ${def.tier}` : ''}</span>
    <button class="pin" class:on={pinned} title={pinned ? 'Unpin' : 'Pin open'} aria-label="Pin" aria-pressed={pinned} onclick={onpin}><Icon name="pin" size={14} /></button></div>
  <div class="cols" class:narrow>
    <div class="left">
      {#if def}
        <BuildPreview {def} {thumb} {rot} />
        <div class="legend"><span><i class="k f"></i>Footprint</span>{#if def.access}<span><i class="k acc"></i>Access: keep clear</span>{/if}<span class="rot"><Icon name="rotate" size={13} /> R to rotate</span></div>
        {#if variants.length > 1}
          <div class="vars" data-testid="popover-variants">
            {#each variants as v (v.key)}
              <button class="v" class:on={v.id === entry.id} class:lock={v.locked} data-testid="variant-{v.id}" aria-pressed={v.id === entry.id} onclick={() => onvariant?.(v)}>
                {#if v.locked}<Icon name="lock" size={12} />{/if}<span>{v.def?.tier ?? v.name}</span>
              </button>
            {/each}
          </div>
        {/if}
      {:else if entry.icon}
        <div class="toolart"><Icon name={entry.icon} size={72} /></div>
        <div class="legend"><span>Drag to paint it</span></div>
      {/if}
    </div>
    <div class="right">
      <p class="desc">{entry.description}</p>
      {#if entry.locked}<p class="lockline" data-testid="lock-hint"><Icon name="lock" size={13} /> {def?.lockHint ?? 'Locked'}</p>{/if}
      {#if def}
        <div class="facts">{#each def.facts as f (f.label)}<div><span>{f.label}</span><b class:warn={f.tone === 'warn'}>{f.value}</b></div>{/each}</div>
      {/if}
      {#if entry.cost.length}
        <table class="ct"><thead><tr><th class="sec">Build cost</th><th>Need</th><th>Stock</th></tr></thead>
          <tbody>{#each entry.cost as c (c.item)}
            <tr class:short={miss.has(c.item)}><td><ItemIcon {api} item={c.item} size={18} />{c.name}</td><td>{c.count}</td><td>{have(c.item)}</td></tr>
          {/each}</tbody></table>
      {/if}
    </div>
  </div>
  <i class="caret" style:left="{Math.max(10, Math.min(W - 38, cx - left - 14))}px"></i>
</div>

<style>
  .pop { position: fixed; z-index: 7; background: rgba(4, 4, 4, 0.97); border: 1px solid var(--amber); color: var(--text); font-size: 13px; box-shadow: 0 6px 24px #000a; max-height: calc(100vh - 220px); box-sizing: border-box; display: grid; grid-template-rows: auto minmax(0, 1fr); }
  .pop > * { min-width: 0; }
  .phd { box-sizing: border-box; display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 10px; background: #000; border-bottom: 1px solid var(--amber); }
  .phd b { font: 700 15px var(--head-font); text-transform: uppercase; letter-spacing: 0.05em; color: var(--amber); }
  .chip { font-size: 11px; color: #ffe2a6; border: 1px solid var(--amber); padding: 0 5px; }
  .pin { margin-left: auto; min-height: 22px; min-width: 22px; height: 22px; padding: 0 4px; font-size: 11px; display: inline-flex; align-items: center; justify-content: center; color: var(--amber); background: transparent; border-color: transparent; }
  .pin.on { background: #2a1e06; border-color: var(--amber); }
  .cols { box-sizing: border-box; display: grid; grid-template-columns: 302px minmax(0, 1fr); gap: 12px; padding: 10px; overflow-y: auto; }
  .cols.narrow { grid-template-columns: 1fr; }
  .left { min-width: 0; }
  .legend { display: flex; gap: 12px; margin-top: 5px; font-size: 11.5px; color: #9a9a9a; align-items: center; flex-wrap: wrap; }
  .rot { margin-left: auto; color: var(--amber); display: inline-flex; align-items: center; gap: 3px; }
  .k { display: inline-block; width: 12px; height: 8px; margin-right: 4px; vertical-align: middle; }
  .k.f { background: rgba(54, 212, 255, 0.27); border: 1px solid #36d4ff; }
  .k.acc { background: rgba(240, 177, 58, 0.2); border: 1px dashed #f0b13a; }
  .vars { display: flex; gap: 4px; margin-top: 6px; }
  .v { flex: 1; height: 40px; min-height: 0; padding: 0 4px; display: flex; align-items: center; justify-content: center; gap: 4px; border: 1px solid #242424; background: #0b0b0b; font-size: 12px; color: #d4d4d4; }
  .v.lock { color: #7a7a7a; border-style: dashed; }
  .v.on { border-color: var(--amber); background: #000; color: var(--amber); }
  .lockline { margin: 0 0 8px; display: flex; align-items: center; gap: 5px; color: var(--amber); font-size: 12.5px; }
  .toolart { height: 200px; width: 300px; display: flex; align-items: center; justify-content: center; color: var(--amber); background: #000; border: 1px solid #242424; }
  .toolart :global(svg) { fill: none; stroke: currentColor; }
  .desc { margin: 0 0 8px; color: #d4d4d4; line-height: 1.35; }
  .facts div { display: flex; justify-content: space-between; gap: 10px; padding: 2px 0; border-bottom: 1px solid #1e1e1e; }
  .facts span { color: #9a9a9a; }
  .warn { color: var(--amber); }
  .ct { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
  .ct th { font: 600 11px var(--head-font); text-transform: uppercase; letter-spacing: 0.06em; color: #8a8a8a; text-align: right; padding: 0 0 3px; border-bottom: 1px solid #2c2c2c; }
  .ct th.sec { text-align: left; color: var(--amber); font-size: 12px; }
  .ct td { padding: 4px 0; border-bottom: 1px solid #1e1e1e; text-align: right; width: 52px; }
  .ct td:first-child { text-align: left; width: auto; display: flex; align-items: center; gap: 6px; }
  .ct tr.short td:last-child { color: var(--red); font-weight: 700; }
  .caret { position: absolute; bottom: -15px; width: 0; height: 0; border-left: 14px solid transparent; border-right: 14px solid transparent; border-top: 15px solid var(--amber); }
</style>
