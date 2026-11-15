<script lang="ts">
  import type { UiApi, UiThumb } from './api';
  import type { Entry } from './buildCatalog';
  import { shortOf } from './buildCatalog';
  import Icon from './Icon.svelte';
  import ItemIcon from './ItemIcon.svelte';

  let { api, entry, thumb, selected, count = 0, have, onpick, onhover, onleave, onpress }: {
    api: UiApi; entry: Entry; thumb?: UiThumb; selected: boolean; /** Members of the card's group, when it stands for more than one module. */ count?: number; have: (item: string) => number;
    onpick: () => void; onhover: (el: HTMLElement) => void; onleave: () => void; onpress: (el: HTMLElement) => void;
  } = $props();
  const missing = $derived(new Set(shortOf(entry.cost, have).map((c) => c.item)));
  let longPressed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let btn: HTMLButtonElement;
  const down = (e: PointerEvent) => {
    longPressed = false;
    if (e.pointerType === 'mouse') return;
    timer = setTimeout(() => { longPressed = true; onpress(btn); }, 450);
  };
  const cancel = () => clearTimeout(timer);
  const click = () => {
    if (longPressed) { longPressed = false; return; }
    if (!entry.locked) onpick();
  };
</script>

<button bind:this={btn} class="card" class:grp={count > 1} class:sel={selected} class:short={missing.size > 0} class:lock={entry.locked} data-testid="card-{entry.key}" aria-pressed={selected}
  onclick={click} onpointerdown={down} onpointerup={cancel} onpointercancel={cancel} onpointermove={(e) => e.pointerType !== 'mouse' && Math.abs(e.movementX) + Math.abs(e.movementY) > 6 && cancel()}
  onmouseenter={() => onhover(btn)} onmouseleave={onleave} onfocus={() => onhover(btn)} onblur={onleave} oncontextmenu={(e) => e.preventDefault()}>
  {#if count > 1}<span class="stack" aria-hidden="true"><i></i><i></i></span>{/if}
  {#if selected}<span class="tag">PLACING</span>{/if}
  <span class="art">
    {#if thumb && thumb.w}<img src={thumb.url} alt="" draggable="false" />
    {:else if entry.icon}<Icon name={entry.icon} size={40} />
    {:else if thumb}<Icon name="module" size={36} />{/if}
  </span>
  {#if entry.locked}<span class="lockb" aria-label="Locked"><Icon name="lock" size={14} /></span>{/if}
  {#if count > 1 && !entry.locked}<span class="badge" data-testid="group-count" aria-label="{count} variants">×{count}</span>{/if}
  <span class="nm">{entry.name}</span>
  <span class="cost" class:many={entry.cost.length > 2}>
    {#each entry.cost as c (c.item)}
      <span class="c" class:miss={missing.has(c.item)}><ItemIcon {api} item={c.item} size={entry.cost.length > 2 ? 13 : 16} />{c.count}</span>
    {/each}
  </span>
</button>

<style>
  .card { position: relative; flex: 0 0 104px; height: 134px; min-width: 0; min-height: 0; padding: 0; display: grid; grid-template-rows: 76px 30px 22px; align-items: center; justify-items: center; background: var(--build-fill-2); border: 1px solid var(--build-line); transition: transform 0.08s; touch-action: pan-x; }
  .card:hover, .card:focus-visible { transform: translateY(-3px); outline: 2px solid var(--amber); outline-offset: -1px; box-shadow: 0 0 14px rgba(240, 177, 58, 0.35); background: var(--build-fill-2); border-color: var(--build-line); z-index: 1; }
  .art { width: 100%; height: 76px; display: flex; align-items: flex-end; justify-content: center; color: var(--amber); background: radial-gradient(ellipse at 50% 80%, var(--build-line) 0, transparent 70%); }
  .art :global(svg) { align-self: center; fill: none; stroke: currentColor; }
  img { max-width: 92px; max-height: 72px; image-rendering: pixelated; margin-bottom: 2px; }
  .nm { font: 600 12px/1.05 var(--head-font); text-transform: uppercase; letter-spacing: 0.03em; color: var(--amber); text-align: center; padding: 0 4px; }
  .cost { display: flex; gap: 3px; font-size: 11px; white-space: nowrap; color: var(--build-dim); }
  .cost.many { gap: 2px; font-size: 10.5px; }
  .c { display: inline-flex; align-items: center; gap: 1px; }
  .c.miss { color: var(--red); font-weight: 700; }
  .card.short { border-color: #4a2420; }
  .card.sel { background: var(--amber); border-color: var(--amber); }
  .card.sel .nm, .card.sel .cost { color: var(--build-on-amber); }
  .card.sel .art { color: var(--build-on-amber); background: radial-gradient(ellipse at 50% 80%, #ffd77a 0, transparent 70%); }
  .card.sel .c.miss { color: #8a0e0e; }
  .tag { position: absolute; top: 0; left: 0; right: 0; font: 700 10px var(--head-font); letter-spacing: 0.1em; text-align: center; padding: 1px 0; background: var(--build-on-amber); color: var(--amber); }
  .card.lock { opacity: 0.55; }
  .card.lock img { filter: grayscale(1) brightness(0.6); }
  .badge { position: absolute; top: 4px; right: 5px; background: #000; border: 1px solid var(--amber); color: var(--amber); font: 800 10px var(--head-font); padding: 1px 4px; border-radius: 2px; }
  .card.sel .badge { background: var(--build-on-amber); }
  .stack { position: absolute; inset: 0; pointer-events: none; z-index: -1; }
  .stack i { position: absolute; box-sizing: border-box; width: 100%; height: 100%; border: 1px solid #b8862c; background: var(--build-bg-solid); }
  .stack i:nth-child(1) { left: 6px; top: -5px; }
  .stack i:nth-child(2) { left: 3px; top: -2px; border-color: #d39b35; }
  .lockb { position: absolute; top: 4px; right: 5px; font-size: 12px; }
</style>
