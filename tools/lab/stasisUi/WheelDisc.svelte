<script lang="ts">
  import type { UiWheelSlot } from '../../../src/ui/api';
  /** Option W1: the wheel drawn as seen from above, slabs standing in its pockets, a lamp on the rim of each, the hatch at the bottom. */
  let { slots, face }: { slots: UiWheelSlot[]; face: (id: number) => string | null } = $props();
  const R = 66, CX = 100, CY = 96;
  const lamp = (s: UiWheelSlot) => (s.kind === 'full' ? (s.draining ? 'var(--red)' : 'var(--green)') : s.kind === 'empty' ? 'var(--amber)' : 'transparent');
  const ang = (i: number) => 90 + (i * 360) / slots.length;
  const held = $derived(slots.filter((s) => s.kind === 'full').length);
  let hover = $state(-1);
  const hs = $derived(hover >= 0 ? slots[hover] : null);
</script>

<div class="w">
  <svg viewBox="0 0 200 200" width="200" height="200">
    <defs>
      <radialGradient id="disc" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#1d242b" /><stop offset="1" stop-color="#0c1014" /></radialGradient>
      <filter id="glow"><feGaussianBlur stdDeviation="1.6" /></filter>
    </defs>
    <circle cx={CX} cy={CY} r="94" fill="url(#disc)" stroke="#2a3036" />
    <circle cx={CX} cy={CY} r="34" fill="#0b0e11" stroke="#3a424a" />
    <rect x={CX - 14} y={CY + 90} width="28" height="8" fill="#0b0e11" stroke="#f0b13a" stroke-dasharray="3 2" />
    {#each slots as s, i (i)}
      {@const a = ang(i)}
      <g transform="translate({CX + R * Math.cos((a * Math.PI) / 180)} {CY + R * Math.sin((a * Math.PI) / 180)})"
        onmouseenter={() => (hover = i)} onmouseleave={() => (hover = -1)} role="img" aria-label="slot {i + 1}" class:hot={hover === i}>
        <g transform="rotate({a - 90})">
          <rect x="-13" y="-17" width="26" height="34" class="pocket {s.kind}" />
          <circle cx="0" cy="23" r="2.6" fill={lamp(s)} filter={s.kind === 'none' ? undefined : 'url(#glow)'} />
          <circle cx="0" cy="23" r="1.6" fill={lamp(s)} />
        </g>
        {#if s.kind === 'full' && face(s.crew)}<image href={face(s.crew)} x="-11" y="-11" width="22" height="23" style="image-rendering:pixelated" />{/if}
      </g>
    {/each}
    <text x={CX} y={CY - 2} class="big">{held}<tspan class="of">/{slots.length}</tspan></text>
    <text x={CX} y={CY + 13} class="sm">held</text>
  </svg>
  <p class="cap">{#if hs}{#if hs.kind === 'full'}<b>{hs.name}</b> · slot {hover + 1} · reserve {hs.reserve}%{:else if hs.kind === 'empty'}Slot {hover + 1} · empty slab, ready{:else}Slot {hover + 1} · no slab{/if}{:else}Hatch at the bottom · click a prisoner to select them{/if}</p>
</div>

<style>
  .w { display: flex; flex-direction: column; align-items: center; margin: 6px 0 0; }
  .pocket { stroke-width: 1.5; }
  .pocket.full { fill: #8fa3a8; stroke: #c9d6d9; }
  .pocket.empty { fill: #4a5559; stroke: #6d7a7e; }
  .pocket.none { fill: #07090b; stroke: #2a3036; stroke-dasharray: 2 2; }
  .hot .pocket { stroke: var(--cyan, #7fe9ff); stroke-width: 2; }
  .big { fill: var(--text); font: 600 20px system-ui; text-anchor: middle; } .of { fill: var(--dim); font-size: 12px; }
  .sm { fill: var(--dim); font: 10px system-ui; text-anchor: middle; letter-spacing: .08em; text-transform: uppercase; }
  .cap { margin: 2px 0 0; color: var(--dim); font-size: 12px; min-height: 16px; text-align: center; } .cap b { color: var(--text); font-weight: 500; }
</style>
