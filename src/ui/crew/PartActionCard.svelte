<script lang="ts">
  import type { UiBodyPart, UiOperationOption, UiOperations } from '../crewDetailApi';
  import { Segmented } from '../kit';

  /**
   * The card beside a body row's action button (the Health tab, #626): the operation already filled in. A replacement shows its implant line with the Mk switch
   * (defaulting to the best tier in stock, the app layer's `best`), named cyberware for the slot as an "or ... use" line while in stock, the best surgeon and the
   * odds. Queue sends the operation (`onQueue`); "Other operation..." opens the full picker (`onOther`); Esc or a click outside closes it.
   */
  let { part, kind, ops, left, top, onClose, onQueue, onOther }: {
    part: UiBodyPart; kind: UiOperationOption['kind']; ops: UiOperations; left: number; top: number;
    onClose: () => void; onQueue: (item?: string) => void; onOther: () => void;
  } = $props();
  const MK = ['', 'Mk I', 'Mk II', 'Mk III'];
  const option = $derived((ops.picker.ops[part.id] ?? []).find((o) => o.kind === kind));
  const lines = $derived(option?.lines ?? []);
  const plain = $derived(lines.find((l) => !l.named && l.best) ?? lines.find((l) => !l.named) ?? null);
  const named = $derived(lines.find((l) => l.named && l.best) ?? null);
  let tierId = $state<string | null>(null);
  let useNamed = $state(false);
  const tier = $derived(plain?.tiers.find((t) => t.id === tierId && t.stock > 0) ?? plain?.tiers.find((t) => t.id === plain.best) ?? null);
  const chosen = $derived(useNamed && named ? (named.tiers[0] ?? null) : tier);
  const item = $derived(kind === 'fit' ? chosen?.id : undefined);
  const verb = $derived(kind === 'fit' ? 'Replace' : kind === 'repair' ? 'Repair' : 'Amputate');
  const odds = $derived(kind === 'fit' ? chosen?.odds : option?.odds);
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  const surgeon = $derived(ops.picker.surgeon.replace(/^Best free surgeon: /, ''));
  const canQueue = $derived(ops.live && !!option && !option.disabled && (kind !== 'fit' || !!item));
  let box = $state<HTMLElement | null>(null);
  const pos = $derived({ left, top: Math.max(8, Math.min(top, window.innerHeight - 330)) }); // stays on screen

  function away(e: PointerEvent): void {
    const t = e.target as Element | null;
    if (box && t && !box.contains(t) && !t.closest('[data-part-action]')) onClose();
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} onpointerdown={away} />

<div class="card" bind:this={box} style:left="{pos.left}px" style:top="{pos.top}px" data-testid="part-card">
  <h3>{verb} {part.name.toLowerCase()}</h3>
  <p class="sub">{#if kind === 'fit' && plain}{useNamed && named ? named.name : plain.name} · {option?.note}{:else}{option?.note ?? ''}{/if}</p>
  {#if kind === 'fit' && plain}
    <Segmented label="Tier" testId="card-tiers" value={useNamed ? '' : (tier?.id ?? '')} onChange={(v) => ((tierId = v), (useNamed = false))}
      options={plain.tiers.map((t) => ({ value: t.id, label: `${MK[t.tier ?? 0]} · ${t.stock > 0 ? t.stock : 'none'}`, disabled: t.stock <= 0, testId: `card-tier-${t.id}` }))} />
  {/if}
  {#if kind === 'fit' && named}
    <p class="or">or <span class="t-named" title={named.tip}>{named.name}</span> ({named.tiers[0]?.stock ?? 0} in stock) ·
      <button class="link" data-testid="card-named" onclick={() => (useNamed = !useNamed)}>{useNamed ? 'undo' : 'use'}</button></p>
  {/if}
  <p class="facts"><b>{surgeon}</b></p>
  {#if odds}<p class="facts" data-testid="card-odds">{cap(odds)}</p>{/if}
  <div class="foot">
    <button class="link" data-testid="card-other" onclick={onOther}>Other operation…</button>
    <button class="interact queue" disabled={!canQueue} data-testid="card-queue" onclick={() => onQueue(item)}>Queue</button>
  </div>
</div>

<style>
  .card { position: fixed; z-index: 45; width: 290px; padding: 12px 14px; background: var(--panel); border: 1px solid var(--line-hi); box-shadow: var(--shadow-pop); font-size: var(--fs-body); color: var(--text); display: grid; gap: 8px; }
  h3 { margin: 0; font: 600 16px var(--head-font); letter-spacing: 0.04em; }
  p { margin: 0; font-size: var(--fs-small); }
  .sub, .or { color: var(--dim); }
  .facts { color: var(--ink-accent); }
  .facts b { color: var(--text); font-weight: 600; }
  :global(.card .kit-seg) { display: flex; }
  :global(.card .kit-seg button) { flex: 1; min-height: 30px; padding: 0 4px; font-size: var(--fs-small); }
  :global(.card .kit-seg button:disabled) { opacity: 0.45; }
  .foot { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
  .link { min-height: 0; min-width: 0; padding: 0; border: 0; background: none; color: var(--cyan); font-size: var(--fs-small); }
  .queue { min-height: 30px; padding: 0 18px; font: 600 13px var(--head-font); letter-spacing: 0.1em; text-transform: uppercase; color: var(--cyan); }
</style>
