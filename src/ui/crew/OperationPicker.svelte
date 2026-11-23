<script lang="ts">
  import type { UiOperationOption, UiOperations } from '../crewDetailApi';
  import Icon from '../Icon.svelte';

  /**
   * The Queue operation picker (the Health tab, slice 2 of #311): beside the inspector, a part list on the left and the part's operations on the right
   * (one that does not apply is greyed with the reason; fitting an implant lists the implants that fit, with stock), where it happens, the best free
   * surgeon's odds, and Queue (`onQueue`: the Health tab sends `crew.queueOperation`).
   */
  let { ops, part = $bindable(), anchor, onClose, onQueue }: {
    ops: UiOperations; part: string; anchor: HTMLElement; onClose: () => void; onQueue: (kind: UiOperationOption['kind'], part: string, item?: string) => void;
  } = $props();
  const options = $derived(ops.picker.ops[part] ?? []);
  let pick = $state<UiOperationOption['kind'] | null>(null);
  let lineId = $state<string | null>(null); // the implant line chosen in the fit list
  let implant = $state<string | null>(null); // the tier's item id chosen on it
  const chosen = $derived(options.find((o) => o.kind === pick && !o.disabled) ?? options.find((o) => !o.disabled) ?? null);
  const line = $derived(chosen?.lines?.find((l) => l.id === lineId && l.best) ?? chosen?.lines?.find((l) => l.best) ?? null);
  const tier = $derived(line?.tiers.find((t) => t.id === implant && t.stock > 0) ?? line?.tiers.find((t) => t.id === line.best) ?? null);
  const fitted = $derived(chosen?.implants?.find((i) => i.id === implant) ?? chosen?.implants?.[0] ?? null); // remove: the fitted implant
  const itemId = $derived(chosen?.lines ? tier?.id : fitted?.id);
  const MK = ['', 'Mk I', 'Mk II', 'Mk III'];
  const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
  const pos = $derived.by(() => {
    const r = anchor.closest('[data-testid="crew-inspector"]')?.getBoundingClientRect() ?? anchor.getBoundingClientRect();
    return { left: r.right + 8, bottom: Math.max(8, window.innerHeight - r.bottom) }; // bottom-aligned with the inspector, so it stays on screen
  });
</script>

<div class="picker" style:left="{pos.left}px" style:bottom="{pos.bottom}px" data-testid="op-picker">
  <div class="head"><span>Queue operation</span><button class="x" onclick={onClose} aria-label="Close">✕</button></div>
  <div class="cols">
    <div class="parts">
      <h4>Part</h4>
      {#each ops.picker.parts as p (p.id)}
        <button class="part" class:on={p.id === part} onclick={() => ((part = p.id), (pick = null), (lineId = null), (implant = null))}>
          <span class="gl" class:mirror={p.mirror}><Icon name={p.icon} size={13} /></span>{p.name}
        </button>
      {/each}
    </div>
    <div class="ops">
      <h4>Operation</h4>
      {#each options as o (o.kind)}
        <button class="op" class:on={chosen === o} disabled={!!o.disabled} onclick={() => (pick = o.kind)} data-testid="op-{o.kind}">
          <b>{o.label}</b><small>{o.disabled ?? o.note}</small>
        </button>
        {#if chosen === o && o.lines}
          {#each o.lines as l (l.id)}
            <button class="implant" class:on={line === l} disabled={!l.best} onclick={() => ((lineId = l.id), (implant = null))} data-testid="line-{l.id}">
              <span class:t-named={l.named} title={l.tip}>{l.name}</span>
              <small>{l.named ? `${l.tiers[0]?.stock ?? 0} in stock` : l.best ? '' : 'not in stock'}</small>
            </button>
            {#if line === l && !l.named}
              <div class="tiers">
                {#each l.tiers as t (t.id)}
                  <button class="tier" class:on={tier === t} disabled={t.stock <= 0} onclick={() => (implant = t.id)} data-testid="tier-{t.id}">
                    {MK[t.tier ?? 0]}<small>{t.stock > 0 ? `${t.stock} in stock` : 'not in stock'}</small>
                  </button>
                {/each}
              </div>
            {/if}
          {/each}
        {:else if chosen === o && o.implants}
          {#each o.implants as i (i.id)}
            <button class="implant" class:on={fitted === i} onclick={() => (implant = i.id)}>
              <span class:t-named={i.named} title={i.tip}>{i.name}</span><small>{i.note}</small>
            </button>
          {/each}
        {/if}
      {/each}
      <h4 class="gapped">Where</h4>
      {#each ops.picker.where as w (w)}<p>{w}</p>{/each}
      <h4 class="gapped">Surgeon</h4>
      <p>{ops.picker.surgeon}</p>
      {#if (chosen?.lines ? tier?.odds : fitted?.odds) ?? chosen?.odds}<p data-testid="op-odds">{cap((chosen?.lines ? tier?.odds : fitted?.odds) ?? chosen?.odds ?? '')}</p>{/if}
      <button class="queue" disabled={!ops.live || !chosen || ((!!chosen.implants || !!chosen.lines) && !itemId)} data-testid="op-queue"
        onclick={() => chosen && onQueue(chosen.kind, part, itemId)}>Queue</button>
    </div>
  </div>
</div>

<style>
  .picker { position: fixed; z-index: 40; width: 420px; background: var(--panel); border: 1px solid var(--line-hi); box-shadow: var(--shadow-window); font-size: var(--fs-body); color: var(--text); }
  .head { display: flex; justify-content: space-between; align-items: center; min-height: 32px; padding: 0 10px; background: var(--pane-head); font: 600 var(--fs-title) var(--head-font); letter-spacing: var(--ls-title); text-transform: uppercase; }
  .cols { display: grid; grid-template-columns: 140px 1fr; }
  .parts { padding: 10px; border-right: 1px solid var(--line); display: grid; align-content: start; gap: 2px; }
  .ops { padding: 10px; display: grid; align-content: start; gap: 4px; }
  h4 { margin: 0 0 4px; color: var(--dim); font: 600 var(--fs-label) var(--head-font); letter-spacing: var(--ls-label); text-transform: uppercase; }
  h4.gapped { margin-top: 10px; }
  p { margin: 0; color: var(--dim); font-size: var(--fs-small); }
  button { text-align: left; font-size: var(--fs-small); }
  .part { display: flex; align-items: center; gap: 7px; min-height: 26px; padding: 0 6px; border: 1px solid transparent; background: none; color: var(--text); }
  .part.on { background: var(--panel-2); border-color: var(--line-hi); }
  .gl { color: var(--dim); display: inline-flex; }
  .gl.mirror { transform: scaleX(-1); }
  .op { display: grid; gap: 2px; padding: 6px 8px; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); }
  .op.on { border-color: var(--text); }
  .op small, .implant small { color: var(--dim); }
  .op:disabled { opacity: 0.55; }
  .implant { display: flex; justify-content: space-between; margin-left: 10px; padding: 4px 8px; border: 1px solid transparent; background: none; color: var(--text); }
  .implant.on { border-color: var(--line-hi); background: var(--panel-2); }
  .implant:disabled { color: var(--dim); }
  .tiers { display: flex; gap: 4px; margin-left: 10px; }
  .tier { flex: 1; display: grid; gap: 1px; min-height: 0; min-width: 0; padding: 3px 4px; text-align: center; border: 1px solid var(--line); background: var(--panel-2); color: var(--text); }
  .tier small { color: var(--dim); font-size: 10px; }
  .tier.on { border-color: var(--text); }
  .tier:disabled { opacity: 0.55; }
  .queue { margin-top: 10px; min-height: 30px; text-align: center; }
  .x { min-height: 0; min-width: 0; padding: 0 4px; border: 0; background: none; color: var(--dim); }
</style>
