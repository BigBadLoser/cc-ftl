<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiMining, UiStock, UiToolState } from './api';
  import BuildCard from './BuildCard.svelte';
  import BuildPopover from './BuildPopover.svelte';
  import { buildEntries, filterEntries, isSelected, visibleCategories, type CategoryId, type Entry } from './buildCatalog';
  import { createThumbs } from './buildThumbs';
  import Icon from './Icon.svelte';

  let { api }: { api: UiApi } = $props();
  let st = $state<UiToolState>({ tool: 'build', build: 'module', moduleDef: null, rot: 0 });
  let stock = $state<UiStock[]>([]);
  let mining = $state<UiMining>({ asteroids: [], pods: [] });
  let hint = $state<{ x: number; y: number; text: string } | null>(null);
  let cat = $state<CategoryId>('structure');
  let query = $state('');
  let collapsed = $state(false);
  let rev = $state(0);
  // svelte-ignore state_referenced_locally
  const thumbs = createThumbs(api, () => rev++);
  const thumbOf = (id: string, rot: number) => (rev >= 0 ? thumbs.get(id, rot) : undefined);
  onMount(() => {
    const subs = [api.tool.subscribe((t) => (st = t)), api.stock.subscribe((v) => (stock = v)), api.mining.subscribe((m) => (mining = m)), api.placeHint.subscribe((h) => (hint = h))];
    const stop = thumbs.start();
    return () => { subs.forEach((u) => u()); stop(); };
  });
  // The toolbar rides above whatever the catalog shows (open strip or the small reopen bar).
  let boxH = $state(0);
  $effect(() => { document.documentElement.style.setProperty('--catalog-h', `${boxH + 8}px`); return () => document.documentElement.style.removeProperty('--catalog-h'); });
  let tabsEl: HTMLElement | undefined = $state();
  $effect(() => {
    // The active tab stays in view when the category or selection changes (the tab row scrolls on phones).
    void cat;
    void st.moduleDef;
    tabsEl?.querySelector<HTMLElement>('.tab.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  });

  const have = (item: string) => stock.reduce((n, s) => (s.item === item ? n + s.floor + s.stored : n), 0);
  const entries = $derived(buildEntries(api));
  const miningRelevant = $derived(mining.asteroids.length > 0 || mining.pods.length > 0 || (st.tool === 'build' && ['dig', 'level', 'finish', 'mine', 'claim'].includes(st.build)));
  const cats = $derived(visibleCategories(entries, miningRelevant));
  const shown = $derived(filterEntries(entries, cats.some((c) => c.id === cat) ? cat : (cats[0]?.id ?? 'structure'), query, miningRelevant));
  // Following the selection: picking a card by other means (the asteroid panel's Mine) shows its tab.
  $effect(() => {
    const sel = entries.find((e) => isSelected(e, st));
    if (sel && !query) cat = sel.category;
  });

  const pick = (e: Entry) => (e.kind === 'module' ? api.setTool({ tool: 'build', build: 'module', moduleDef: e.id }) : api.setTool({ tool: 'build', build: e.id as UiToolState['build'] }));
  const selectedEntry = $derived(entries.find((e) => isSelected(e, st)));

  // Popover: opens ~250ms after the pointer settles on a card, a pin keeps it, a long press opens it on touch.
  let pop = $state<{ entry: Entry; rect: DOMRect } | null>(null);
  let pinned = $state(false);
  let openT: ReturnType<typeof setTimeout> | undefined;
  let closeT: ReturnType<typeof setTimeout> | undefined;
  const hover = (e: Entry, el: HTMLElement) => {
    clearTimeout(closeT);
    if (pinned) return;
    clearTimeout(openT);
    openT = setTimeout(() => (pop = { entry: e, rect: el.getBoundingClientRect() }), pop ? 0 : 250);
  };
  const leave = () => {
    clearTimeout(openT);
    if (pinned) return;
    closeT = setTimeout(() => (pop = null), 140);
  };
  const press = (e: Entry, el: HTMLElement) => { clearTimeout(closeT); pinned = false; pop = { entry: e, rect: el.getBoundingClientRect() }; };
  const dismiss = () => { pinned = false; pop = null; };
</script>

<svelte:window onpointerdown={(e) => { if (pop && !(e.target as Element).closest?.('[data-testid="build-popover"], .card')) dismiss(); }} />

{#if collapsed}
  <button class="reopen" bind:offsetHeight={boxH} title="Show the build catalog" aria-label="Show the build catalog" aria-expanded="false" data-testid="catalog-collapse" onclick={() => (collapsed = false)}>▴ Build</button>
{:else}
  <div class="cat" bind:offsetHeight={boxH} data-testid="build-catalog">
    <div class="strip" onscroll={dismiss}>
      <div class="cards">
        {#each shown as e (e.key)}
          <BuildCard {api} entry={e} thumb={e.def ? thumbOf(e.id, 0) : undefined} selected={isSelected(e, st)} {have} onpick={() => pick(e)} onhover={(el) => hover(e, el)} onleave={leave} onpress={(el) => press(e, el)} />
        {:else}
          <p class="none">Nothing matches “{query}”.</p>
        {/each}
      </div>
    </div>
    <div class="nav">
      <div class="tabs" bind:this={tabsEl}>
        {#each cats as c (c.id)}
          <button class="tab" class:on={!query && cat === c.id} data-testid="tab-{c.id}" onclick={() => { cat = c.id; query = ''; }}>{c.label}<i>{c.count}</i></button>
        {/each}
      </div>
      {#if selectedEntry?.kind === 'module'}
        <button class="rotb" title="Rotate (R, Shift+R back)" aria-label="Rotate" data-testid="rotate" onclick={() => api.setTool({ rot: (st.rot + 1) % 4 })}><Icon name="rotate" size={16} /> {st.rot * 90}°</button>
      {/if}
      <input class="search" placeholder="Search modules…" aria-label="Search modules" bind:value={query} onkeydown={(e) => { if (e.key === 'Escape') { query = ''; (e.target as HTMLElement).blur(); } }} />
      <button class="coll" title="Collapse (keeps your selection)" aria-label="Collapse" aria-expanded="true" data-testid="catalog-collapse" onclick={() => { collapsed = true; dismiss(); }}>▾</button>
    </div>
  </div>
{/if}

{#if pop && !collapsed}
  <BuildPopover {api} entry={pop.entry} rect={pop.rect} rot={st.rot} thumb={pop.entry.def ? thumbOf(pop.entry.id, st.rot) : undefined} {have} {pinned}
    onpin={() => (pinned = !pinned)} onenter={() => clearTimeout(closeT)} onleave={leave} />
{/if}
{#if hint}<div class="hint" role="status" data-testid="place-hint" style:left="{hint.x}px" style:top="{hint.y}px">{hint.text}</div>{/if}

<style>
  .cat { position: fixed; z-index: 5; left: 50%; transform: translateX(-50%); bottom: calc(8px + var(--sab)); width: min(1180px, calc(100vw - 16px)); background: rgba(4, 4, 4, 0.97); border: 1px solid var(--amber); }
  .coll { flex: none; min-height: 28px; height: 28px; min-width: 0; padding: 0 12px; font-size: 13px; background: #050505; border: 1px solid var(--amber); color: var(--amber); }
  .reopen { position: fixed; z-index: 5; left: 50%; transform: translateX(-50%); bottom: calc(8px + var(--sab)); min-height: 24px; height: 24px; min-width: 0; padding: 0 16px; font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; background: rgba(4, 4, 4, 0.97); border: 1px solid var(--amber); color: var(--amber); }
  .strip { display: flex; height: 150px; border-bottom: 1px solid #242424; }
  .cards { display: flex; gap: 6px; padding: 12px 8px 4px; overflow-x: auto; overflow-y: hidden; flex: 1; scrollbar-width: thin; scrollbar-color: #3a3a3a transparent; }
  .none { margin: auto; color: #9a9a9a; }
  .nav { display: flex; align-items: center; height: 36px; padding: 0 8px; gap: 4px; }
  .tabs { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; flex: 1 1 0; min-width: 0; }
  .tab { min-height: 28px; height: 28px; min-width: 0; padding: 0 10px; font: 600 13px var(--head-font); text-transform: uppercase; letter-spacing: 0.04em; color: var(--amber); background: transparent; border-color: transparent; white-space: nowrap; flex: none; }
  .tab i { font-style: normal; color: #5c5c5c; margin-left: 5px; font-size: 11px; }
  .tab:hover { border-color: #3a3a3a; }
  .tab.on { background: var(--amber); border-color: var(--amber); color: #1a1204; }
  .tab.on i { color: #4a3508; }
  .rotb { flex: none; min-height: 28px; height: 28px; min-width: 0; padding: 0 10px; font-size: 12px; white-space: nowrap; background: #050505; border-color: #2c2c2c; color: #c8c8c8; display: inline-flex; align-items: center; gap: 4px; }
  .rotb { color: var(--amber); }
  .search { width: 180px; flex: none; height: 26px; box-sizing: border-box; background: #050505; border: 1px solid #2c2c2c; color: #c8c8c8; padding: 0 8px; font: 13px system-ui; user-select: text; -webkit-user-select: text; }
    .search:focus { outline: none; border-color: var(--amber); }
  .hint { position: fixed; z-index: 6; transform: translate(-50%, -150%); pointer-events: none; padding: 3px 8px; background: rgba(4, 4, 4, 0.95); border: 1px solid var(--red); color: #ff9a9a; font-size: 12px; white-space: nowrap; }
  @media (max-width: 600px) {
    .cat { width: 100vw; border-width: 1px 0 0; bottom: 0; padding-bottom: var(--sab); }
    .strip { height: 146px; }
    .search { width: 84px; }
  }
</style>
