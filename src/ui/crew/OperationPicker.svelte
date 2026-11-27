<script lang="ts">
  import type { UiOperationOption, UiOperations } from '../crewDetailApi';
  import Icon from '../Icon.svelte';
  import { DecisionBar, Segmented, Tabs } from '../kit';

  /**
   * The full Queue operation picker (the Health tab, #311, restyled in #626), for what the row's card does not cover: parts on the left as plain rows; on the
   * right the operation as a tab row (one that does not apply is faint, with its reason under the tabs), the implant lines as plain rows, the tier as one switch,
   * where it happens and the best free surgeon's odds. Borders and cyan only on what is clickable. Queue sends the operation (`onQueue`).
   */
  let { ops, part = $bindable(), kind: startKind = null, anchor, onClose, onQueue }: {
    ops: UiOperations; part: string; kind?: UiOperationOption['kind'] | null; anchor: HTMLElement; onClose: () => void; onQueue: (kind: UiOperationOption['kind'], part: string, item?: string) => void;
  } = $props();
  const options = $derived(ops.picker.ops[part] ?? []);
  // svelte-ignore state_referenced_locally
  let pick = $state<UiOperationOption['kind'] | null>(startKind);
  let lineId = $state<string | null>(null); // the implant line chosen in the fit list
  let implant = $state<string | null>(null); // the tier's item id (fit) or the fitted implant (remove) chosen
  const chosen = $derived(options.find((o) => o.kind === pick && !o.disabled) ?? options.find((o) => !o.disabled) ?? null);
  const line = $derived(chosen?.lines?.find((l) => l.id === lineId && l.best) ?? chosen?.lines?.find((l) => l.best) ?? null);
  const tier = $derived(line?.tiers.find((t) => t.id === implant && t.stock > 0) ?? line?.tiers.find((t) => t.id === line.best) ?? null);
  const fitted = $derived(chosen?.implants?.find((i) => i.id === implant) ?? chosen?.implants?.[0] ?? null); // remove: the fitted implant
  const itemId = $derived(chosen?.lines ? tier?.id : fitted?.id);
  const odds = $derived((chosen?.lines ? tier?.odds : fitted?.odds) ?? chosen?.odds);
  const MK = ['', 'Mk I', 'Mk II', 'Mk III'];
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  const pos = $derived.by(() => {
    const r = anchor.closest('[data-testid="crew-inspector"]')?.getBoundingClientRect() ?? anchor.getBoundingClientRect();
    return { left: r.right + 8, bottom: Math.max(8, window.innerHeight - r.bottom) }; // bottom-aligned with the inspector, so it stays on screen
  });
  const queueable = $derived(ops.live && !!chosen && (!(chosen.lines || chosen.implants) || !!itemId));
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onClose()} />

<div class="picker" style:left="{pos.left}px" style:bottom="{pos.bottom}px" data-testid="op-picker">
  <div class="head"><span>Queue operation</span><button class="x" onclick={onClose} aria-label="Close">✕</button></div>
  <div class="cols">
    <div class="parts">
      <h4>Part</h4>
      {#each ops.picker.parts as p (p.id)}
        <button class="row" class:sel={p.id === part} onclick={() => ((part = p.id), (pick = null), (lineId = null), (implant = null))}>
          <span class="gl" class:mirror={p.mirror}><Icon name={p.icon} size={13} /></span>{p.name}
        </button>
      {/each}
    </div>
    <div class="ops">
      <Tabs label="Operation" options={options.map((o) => ({ value: o.kind, label: o.label.replace(/ implant$/, ''), disabled: !!o.disabled, testId: `op-${o.kind}` }))}
        value={chosen?.kind ?? ''} onChange={(v) => ((pick = v as UiOperationOption['kind']), (lineId = null), (implant = null))} />
      <p class="why">{chosen?.note ?? ''}</p>
      {#each options.filter((o) => o.disabled) as o (o.kind)}<p class="why off">{o.label}: {o.disabled}</p>{/each}
      {#if chosen?.lines}
        <h4>Implant</h4>
        {#each chosen.lines as l (l.id)}
          <button class="row" class:sel={line === l} class:t-named={l.named} disabled={!l.best} title={l.tip} data-testid="line-{l.id}" onclick={() => ((lineId = l.id), (implant = null))}>
            <span>{l.name}</span><small>{l.best ? `${l.tiers.reduce((n, t) => n + t.stock, 0)} in stock` : 'not in stock'}</small>
          </button>
        {/each}
        {#if line && !line.named}
          <h4>Tier</h4>
          <Segmented label="Tier" value={tier?.id ?? ''} onChange={(v) => (implant = v)}
            options={line.tiers.map((t) => ({ value: t.id, label: `${MK[t.tier ?? 0]} · ${t.stock > 0 ? t.stock : 'none'}`, disabled: t.stock <= 0, testId: `tier-${t.id}` }))} />
        {/if}
      {:else if chosen?.implants}
        <h4>Fitted</h4>
        {#each chosen.implants as i (i.id)}
          <button class="row" class:sel={fitted === i} class:t-named={i.named} title={i.tip} onclick={() => (implant = i.id)}><span>{i.name}</span></button>
        {/each}
      {/if}
      <h4>Where</h4>
      {#each ops.picker.where as w (w)}<p class="fact">{w}</p>{/each}
      <h4>Surgeon</h4>
      <p class="fact">{ops.picker.surgeon}</p>
      {#if odds}<p class="fact" data-testid="op-odds">{cap(odds)}</p>{/if}
    </div>
  </div>
  <DecisionBar options={[{ id: 'queue', label: 'Queue', primary: true, disabled: !queueable, testId: 'op-queue' }]} onpick={() => chosen && onQueue(chosen.kind, part, itemId)} />
</div>

<style>
  .picker { position: fixed; z-index: 40; width: 460px; background: var(--panel); border: 1px solid var(--line-hi); box-shadow: var(--shadow-window); font-size: var(--fs-body); color: var(--text); }
  .head { display: flex; justify-content: space-between; align-items: center; min-height: 32px; padding: 0 10px; background: var(--pane-head); font: 600 var(--fs-title) var(--head-font); letter-spacing: var(--ls-title); text-transform: uppercase; }
  .cols { display: grid; grid-template-columns: 140px 1fr; }
  .parts { padding: 8px 0; border-right: 1px solid var(--line); display: grid; align-content: start; }
  .ops { padding: 0 0 10px; display: grid; align-content: start; min-width: 0; }
  h4 { margin: 12px 12px 4px; color: var(--dim); font: 600 var(--fs-label) var(--head-font); letter-spacing: var(--ls-label); text-transform: uppercase; }
  .parts h4 { margin-top: 0; }
  p { margin: 0; color: var(--dim); font-size: var(--fs-small); }
  .why { margin: 8px 12px 0; }
  .why.off { margin-top: 2px; opacity: 0.6; }
  .fact { margin: 0 12px 2px; color: var(--ink-accent); }
  /* Plain rows, no borders: a hover tint, and the selected one filled with a cyan bar on its left edge. */
  .row { display: flex; align-items: center; justify-content: space-between; gap: 7px; min-height: 26px; min-width: 0; padding: 0 12px; border: 0; border-left: 2px solid transparent; background: none; color: var(--text); text-align: left; font-size: var(--fs-small); }
  .parts .row { justify-content: flex-start; }
  .row:hover:not(:disabled) { background: var(--panel-2); }
  .row.sel { background: var(--panel-3); border-left-color: var(--cyan); }
  .row.t-named { color: var(--named); }
  .row:disabled { color: var(--dim); opacity: 0.6; cursor: default; }
  .row small { color: var(--dim); }
  .gl { color: var(--dim); display: inline-flex; }
  .gl.mirror { transform: scaleX(-1); }
  :global(.picker .kit-seg) { display: flex; margin: 0 12px; }
  :global(.picker .kit-seg button) { flex: 1; min-height: 30px; padding: 0 4px; font-size: var(--fs-small); }
  :global(.picker .kit-seg button:disabled) { opacity: 0.45; }
  :global(.picker .kit-tab:disabled) { opacity: 0.4; cursor: default; }
  .x { min-height: 0; min-width: 0; padding: 0 4px; border: 0; background: none; color: var(--dim); }
</style>
