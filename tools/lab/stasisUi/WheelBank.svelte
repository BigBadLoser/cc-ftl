<script lang="ts">
  import type { UiWheelSlot } from '../../../src/ui/api';
  /** Option W3: the ten slots as a bank of slabs (two rows of five), the hatch slot first: a frosted slab with its prisoner's face, a lamp over it. */
  let { slots, face }: { slots: UiWheelSlot[]; face: (id: number) => string | null } = $props();
  const lamp = (s: UiWheelSlot) => (s.kind === 'full' ? (s.draining ? 'red' : 'grn') : s.kind === 'empty' ? 'amb' : 'off');
  const held = $derived(slots.filter((s) => s.kind === 'full').length);
</script>

<div class="w">
  <div class="head"><span>Slots</span><span class="dim">{held} of {slots.length} held</span></div>
  <div class="bank">
    {#each slots as s, i (i)}
      <button class="slab {s.kind}" disabled={s.kind !== 'full'} title={s.kind === 'full' ? `${s.name}, reserve ${s.reserve}%` : s.kind === 'empty' ? 'Empty slab, ready' : 'No slab'}>
        <span class="lamp {lamp(s)}"></span>
        {#if s.kind === 'full' && face(s.crew)}<img src={face(s.crew)} alt="" />{/if}
        <span class="no">{i === 0 ? 'H' : i + 1}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .w { margin: 8px 0 2px; }
  .head { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 6px; } .dim { color: var(--dim); }
  .bank { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; }
  .slab { position: relative; height: 62px; min-height: 0; padding: 0;  border: 1px solid #3a424a; overflow: hidden;
    background: linear-gradient(160deg, #56646a, #3a464b); display: flex; align-items: center; justify-content: center; }
  .slab.full { background: linear-gradient(160deg, #9fb3b8, #6e8288); border-color: #c9d6d9; cursor: pointer; }
  .slab.full:hover { border-color: var(--cyan, #7fe9ff); box-shadow: 0 0 0 1px var(--cyan, #7fe9ff); }
  .slab.none { background: #07090b; border-style: dashed; }
  .slab:disabled { opacity: 1; cursor: default; }
  img { width: 34px; height: 36px; image-rendering: pixelated; object-fit: cover; filter: saturate(.35) contrast(1.05); mix-blend-mode: luminosity; }
  .lamp { position: absolute; top: 4px; left: 50%; width: 14px; height: 3px; transform: translateX(-50%);  background: #1a1f24; }
  .lamp.grn { background: var(--green); box-shadow: 0 0 5px var(--green); } .lamp.amb { background: var(--amber); box-shadow: 0 0 5px var(--amber); }
  .lamp.red { background: var(--red); box-shadow: 0 0 5px var(--red); }
  .no { position: absolute; bottom: 2px; right: 4px; font-size: 10px; color: rgba(255,255,255,.55); }
</style>
