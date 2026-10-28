<script lang="ts">
  import type { UiFleeNode } from './api';
  import Icon from './Icon.svelte';
  import { dangerColor } from './starmapStyle';

  /** The compact flee control of the combat panel: a mini-map of the nodes one jump away and the drive's charge. One click on a node, once it is charged, jumps. */
  let { nodes, charge, max, helmManned, onJump, onClose }: {
    nodes: UiFleeNode[]; charge: number; max: number; helmManned: boolean; onJump: (to: string) => void; onClose: () => void;
  } = $props();

  const W = 240;
  const H = 96;
  const PAD_X = 40;
  const PAD_Y = 20;
  /** Dot positions: the offsets scaled to fit the box (one scale for both axes, so the shape of the lanes holds), the current node at the middle. */
  const placed = $derived.by(() => {
    const rx = Math.max(1, ...nodes.map((n) => Math.abs(n.dx)));
    const ry = Math.max(1, ...nodes.map((n) => Math.abs(n.dy)));
    const k = Math.min((W / 2 - PAD_X) / rx, (H / 2 - PAD_Y) / ry);
    return nodes.map((n) => ({ n, x: W / 2 + n.dx * k, y: H / 2 + n.dy * k }));
  });
  const pct = $derived(Math.min(100, Math.round((charge / max) * 100)));
  const readyAny = $derived(nodes.some((n) => n.blocker === null));
  const status = $derived(
    !helmManned ? 'Helm unmanned: the drive is not charging'
      : readyAny ? 'Drive charged: pick a node to jump'
        : nodes.length === 0 ? 'No lanes out of here'
          : charge >= max ? 'Drive charged, but no fuel'
            : `Charging ${Math.ceil(charge)} / ${max} s`,
  );
  const short = (s: string) => (s.length > 11 ? `${s.slice(0, 10)}…` : s);
  const why = (n: UiFleeNode) => (n.blocker === 'noFuel' ? 'not enough fuel' : n.blocker === 'notCharged' ? `needs ${n.charge} s of charge` : 'ready');
</script>

<div class="flee" class:ready={readyAny} data-testid="flee-control">
  <div class="head">
    <Icon name="fast" size={14} /><b>Flee</b><span class="st" class:warn={!helmManned}>{status}</span>
    <button class="x" aria-label="Close flee" title="Close" onclick={onClose}><Icon name="close" size={12} /></button>
  </div>
  <span class="bar" title="FTL charge"><i style="width:{pct}%"></i></span>
  <svg viewBox="0 0 {W} {H}" role="group" aria-label="Nodes one jump away">
    {#each placed as p (p.n.id)}<line x1={W / 2} y1={H / 2} x2={p.x} y2={p.y} class="lane" />{/each}
    <circle cx={W / 2} cy={H / 2} r="5" class="me" /><text x={W / 2 + 9} y={H / 2 + 3} class="lbl me-t start">You</text>
    {#each placed as p (p.n.id)}
      {@const go = p.n.blocker === null}
      <g class="node" class:go role="button" tabindex={go ? 0 : -1} aria-disabled={!go} data-testid="flee-node" aria-label="Flee to {p.n.name}"
        onclick={() => go && onJump(p.n.id)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && go && onJump(p.n.id)}>
        <title>{p.n.name}: danger {p.n.danger}, {p.n.fuel} fuel, {why(p.n)}</title>
        <circle cx={p.x} cy={p.y} r="14" class="hit" />
        <circle cx={p.x} cy={p.y} r="6" style="stroke:{dangerColor(p.n.danger)}" class="dot" />
        <text x={p.x} y={p.y + (p.n.dy < 0 ? -11 : 17)} class="lbl">{short(p.n.name)}</text>
      </g>
    {/each}
  </svg>
</div>

<style>
  .flee { display: grid; gap: 4px; padding: 6px 8px 4px; background: var(--panel-2); border: 1px solid var(--line-hi); }
  .flee.ready { border-color: var(--green); }
  .head { display: flex; align-items: center; gap: 6px; color: var(--cyan); }
  .head b { font: 600 12px var(--head-font); letter-spacing: 0.08em; text-transform: uppercase; }
  .st { font-size: 11px; color: var(--dim); } .st.warn { color: var(--amber); } .ready .st { color: var(--green); }
  .x { margin-left: auto; min-height: 0; min-width: 0; width: 20px; height: 20px; padding: 0; display: inline-flex; align-items: center; justify-content: center; background: transparent; color: var(--dim); }
  .bar { display: block; height: 4px; background: #0b1220; } .bar > i { display: block; height: 100%; background: var(--cyan); } .ready .bar > i { background: var(--green); }
  svg { width: 100%; height: auto; display: block; }
  .lane { stroke: var(--line-hi); stroke-width: 1; stroke-dasharray: 3 3; }
  .me { fill: var(--cyan); }
  .dot { fill: #0b1220; stroke-width: 2; }
  .hit { fill: transparent; }
  .lbl { fill: var(--dim); font-size: 10px; text-anchor: middle; pointer-events: none; }
  .me-t { fill: var(--cyan); } .start { text-anchor: start; }
  .node { opacity: 0.45; cursor: not-allowed; outline: none; }
  .node.go { opacity: 1; cursor: pointer; } .node.go .lbl { fill: var(--text); }
  .node.go:hover .dot, .node.go:focus-visible .dot { fill: var(--green); }
</style>
