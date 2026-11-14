<script lang="ts">
  import type { UiApi, UiWheelSlot } from '../api';
  import { Meter, tip } from '../kit';
  import Face from '../crew/Face.svelte';

  /**
   * A stasis wheel's slots on the module Overview tab: a ring of its lamps (slot 0 at the bottom by the hatch, the rest counterclockwise, each
   * coloured as its lamp on the wheel: green held, amber an empty slab ready, red on its reserve, dark no slab), the counts, and a roster of who
   * is held (click: select them).
   */
  let { api, slots }: { api: UiApi; slots: UiWheelSlot[] } = $props();
  const held = $derived(slots.map((s, i) => ({ s, i })).filter((x) => x.s.kind === 'full'));
  const empty = $derived(slots.filter((s) => s.kind === 'empty').length);
  const col = (s: UiWheelSlot) => (s.kind === 'full' ? (s.draining ? 'var(--red)' : 'var(--green)') : s.kind === 'empty' ? 'var(--amber)' : '#20262c');
  const seg = (i: number, n: number) => {
    const a0 = ((90 + (i - 0.42) * 360 / n) * Math.PI) / 180, a1 = ((90 + (i + 0.42) * 360 / n) * Math.PI) / 180;
    const p = (a: number, r: number) => `${40 + r * Math.cos(a)} ${40 + r * Math.sin(a)}`;
    return `M${p(a0, 36)} A36 36 0 0 1 ${p(a1, 36)} L${p(a1, 25)} A25 25 0 0 0 ${p(a0, 25)} Z`;
  };
</script>

<div class="w" data-testid="wheel-ring">
  <div class="top">
    <svg viewBox="0 0 80 80" width="80" height="80">
      {#each slots as s, i (i)}<path data-testid="wheel-slot" data-kind={s.kind} d={seg(i, slots.length)} fill={col(s)} opacity={s.kind === 'none' ? 1 : 0.9} />{/each}
      <text x="40" y="44" class="n">{held.length}/{slots.length}</text>
    </svg>
    <div class="sum">
      <div><span class="dot g"></span>{held.length} prisoner{held.length === 1 ? '' : 's'} held</div>
      <div><span class="dot a"></span>{empty} empty slab{empty === 1 ? '' : 's'} ready</div>
      {#if slots.length - held.length - empty}<div class="dim"><span class="dot"></span>{slots.length - held.length - empty} socket{slots.length - held.length - empty === 1 ? '' : 's'} bare</div>{/if}
    </div>
  </div>
  {#if held.length}
    <div class="list">
      {#each held as { s, i } (i)}
        {#if s.kind === 'full'}
          <button class="row" data-testid="wheel-held" use:tip={{ text: `Select ${s.name}` }} onclick={() => api.selectCrew(s.crew, true)}>
            <Face {api} id={s.crew} size={28} />
            <span class="nm">{s.name}<small>Slot {i + 1}</small></span>
            <span class="res"><Meter value={s.reserve} max={100} tone={s.draining ? 'bad' : 'good'} height={4} /><small class:bad={s.draining}>{s.reserve}%</small></span>
          </button>
        {/if}
      {/each}
    </div>
  {:else}<p class="dim none">No one held. Mark a prisoner "Seal in stasis" to fill a slab.</p>{/if}
</div>

<style>
  .w { margin: 8px 0 2px; }
  .top { display: flex; align-items: center; gap: 12px; }
  .n { fill: var(--text); font: 600 13px system-ui; text-anchor: middle; }
  .sum { font-size: 12px; display: grid; gap: 3px; } .dim { color: var(--dim); }
  .dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; background: #20262c; } .dot.g { background: var(--green); } .dot.a { background: var(--amber); }
  .list { display: grid; gap: 2px; margin-top: 8px; }
  .row { display: grid; grid-template-columns: 28px 1fr 74px; align-items: center; gap: 8px; padding: 3px 6px; min-height: 0; text-align: left; background: var(--panel-2); border: 1px solid transparent; }
  .row:hover { border-color: var(--cyan); }
  .nm { display: flex; flex-direction: column; font-size: 13px; line-height: 1.15; } .nm small { color: var(--dim); font-size: 11px; }
  .res { display: grid; gap: 2px; } .res small { color: var(--dim); font-size: 11px; text-align: right; } .res small.bad { color: var(--red); }
  .none { font-size: 12px; margin: 8px 0 0; }
</style>
