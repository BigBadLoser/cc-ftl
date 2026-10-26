<script lang="ts">
  import { onMount } from 'svelte';
  import type { UiApi, UiResearchNode } from './api';
  import { createThumbs } from './buildThumbs';
  import Icon from './Icon.svelte';
  import ItemIcon from './ItemIcon.svelte';

  let { api, node, labs, onAdd }: { api: UiApi; node: UiResearchNode | undefined; labs: number; onAdd: (id: string) => void } = $props();
  let rev = $state(0);
  // svelte-ignore state_referenced_locally
  const thumbs = createThumbs(api, () => rev++);
  onMount(() => thumbs.start());
  const thumb = $derived(node && rev >= 0 ? thumbs.get(node.module) : undefined);
  const dur = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
</script>

<div class="sel" data-testid="research-selected">
  <h3>Selected</h3>
  {#if node}
    <div class="hd">
      <div class="thumb">{#if thumb && thumb.w}<img src={thumb.url} alt="" />{/if}</div>
      <div><div class="nm">{node.name}</div><div class="sub">{node.sub}</div></div>
    </div>
    <div class="stats">
      {#each node.stats as s (s.label)}
        <span>{s.label}</span><span>{s.value}{#if s.delta}&nbsp;<span class:up={s.good} class:dn={!s.good}>({s.delta})</span>{/if}</span>
      {/each}
    </div>
    <h3>Cost</h3>
    <div class="cost">
      {#each node.cost as c (c.item)}
        <span class:short={c.have < c.count} title="{c.name}: have {c.have}, need {c.count}"><ItemIcon {api} item={c.item} size={18} />{c.name} {c.have}/{c.count}</span>
      {/each}
    </div>
    <div class="row"><Icon name="clock" size={14} /> {dur(node.seconds)} at one crew</div>
    {#if node.pos !== null}
      <div class="btn" data-testid="research-in-queue">In queue · #{node.pos + 1}</div>
    {:else}
      <button class="btn" disabled={labs === 0} data-testid="research-add" onclick={() => onAdd(node.id)}>Add to queue</button>
    {/if}
  {:else}<p class="none">Nothing to research yet.</p>{/if}
</div>

<style>
  h3 { margin: 0 0 6px; font: 600 12px var(--head-font); letter-spacing: 0.07em; text-transform: uppercase; color: var(--amber); border-bottom: 1px solid #262626; padding-bottom: 4px; }
  .sel { padding: 12px; border-bottom: 1px solid #2a2a2a; }
  .hd { display: flex; gap: 12px; align-items: center; margin-bottom: 8px; }
  .thumb { flex: none; width: 96px; height: 80px; background: #0a0a0a; border: 1px solid #2a2a2a; display: grid; place-items: center; }
  .thumb img { image-rendering: pixelated; max-width: 92px; max-height: 76px; }
  .nm { font: 700 18px var(--head-font); color: var(--amber); }
  .sub { color: #8a8a8a; font-size: 12px; }
  .stats { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 6px 0 8px; }
  .stats > span:nth-child(odd) { color: #8a8a8a; }
  .up { color: #7fd38a; } .dn { color: var(--red); }
  .cost { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 4px 0 8px; }
  .cost span { display: inline-flex; align-items: center; gap: 3px; }
  .cost .short { color: var(--red); font-weight: 700; }
  .row { display: flex; align-items: center; gap: 6px; color: #9a9a9a; }
  .btn { margin-top: 10px; display: block; width: 100%; box-sizing: border-box; text-align: center; padding: 7px; border: 1px solid var(--amber); color: var(--amber); font: 700 13px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; background: #000; }
  button.btn:hover:not(:disabled) { background: #000; box-shadow: 0 0 0 1px var(--amber); }
  .none { color: #8a8a8a; margin: 4px 0; }
</style>
