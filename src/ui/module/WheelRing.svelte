<script lang="ts">
  import { tip } from '../kit';
  import type { UiApi, UiWheelSlot } from '../api';
  import Face from '../crew/Face.svelte';

  /**
   * A stasis wheel's slots as a ring seen from above (the module Overview tab): slot 0 at the bottom by the hatch, the rest counterclockwise as on
   * the wheel. A held prisoner shows their face (click: select them), an empty slab a blank slab, a bare socket a dashed outline. Each rim takes
   * its lamp's colour, as on the wheel: green held, amber an empty slab ready, red a slab on its reserve.
   */
  let { api, slots }: { api: UiApi; slots: UiWheelSlot[] } = $props();
  const R = 74;
  const C = 98;
  const at = (i: number) => {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / slots.length;
    return `left:${Math.round(C + R * Math.cos(a))}px;top:${Math.round(C - 14 + R * Math.sin(a))}px`;
  };
  const held = $derived(slots.filter((s) => s.kind === 'full').length);
  const ready = $derived(slots.filter((s) => s.kind === 'empty').length);
  const bare = $derived(slots.filter((s) => s.kind === 'none').length);
  const say = (s: UiWheelSlot, i: number): string =>
    s.kind === 'full' ? `Slot ${i + 1}: ${s.name}, reserve ${s.reserve}%${s.draining ? ' and draining' : ''} (click to select)`
      : s.kind === 'empty' ? `Slot ${i + 1}: an empty slab, ready for sealing` : `Slot ${i + 1}: no slab`;
</script>

<div class="wheel" data-testid="wheel-ring">
  <div class="ring">
    <span class="hub"><b>{held}</b><small>held</small></span>
    <span class="hatch" style="left:{C}px;top:{C - 14 + R + 26}px">hatch</span>
    {#each slots as s, i (i)}
      {#if s.kind === 'full'}
        <button class="slot full" class:red={s.draining} style={at(i)} data-testid="wheel-slot" use:tip={{ text: say(s, i) }} onclick={() => api.selectCrew(s.crew, true)}>
          <Face {api} id={s.crew} size={24} />
          <span class="res"><span style="width:{s.reserve}%"></span></span>
        </button>
      {:else}
        <span class="slot {s.kind}" style={at(i)} data-testid="wheel-slot" use:tip={{ text: say(s, i) }}></span>
      {/if}
    {/each}
  </div>
  <p class="legend"><span class="k held"></span>{held} held <span class="k empty"></span>{ready} empty {#if bare}<span class="k none"></span>{bare} no slab{/if}</p>
</div>

<style>
  .wheel { margin: 8px 0 4px; }
  .ring { position: relative; width: 196px; height: 210px; margin: 0 auto; }
  .ring::before { content: ''; position: absolute; left: 24px; top: 10px; width: 148px; height: 148px; border-radius: 50%; border: 1px dashed var(--line); }
  .hub { position: absolute; left: 68px; top: 54px; width: 60px; height: 60px; border-radius: 50%; background: var(--track); border: 1px solid var(--line);
    display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; }
  .hub b { font-size: 18px; } .hub small { color: var(--dim); font-size: 11px; }
  .hatch { position: absolute; transform: translateX(-50%); color: var(--dim); font-size: 11px; }
  .slot { position: absolute; width: 30px; height: 34px; transform: translate(-50%, -50%); box-sizing: border-box; padding: 0; border-radius: 3px;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: #000; }
  .slot.none { border: 1px dashed var(--line-hi); background: var(--panel); }
  .slot.empty { border: 2px solid var(--amber); background: #3a3f42; }
  .slot.full { border: 2px solid var(--green); min-height: 0; cursor: pointer; }
  .slot.full.red { border-color: var(--red); }
  .res { width: 22px; height: 3px; background: var(--track); } .res span { display: block; height: 100%; background: var(--green); }
  .slot.red .res span { background: var(--red); }
  .legend { display: flex; align-items: center; gap: 4px; justify-content: center; margin: 0; color: var(--dim); font-size: 12px; }
  .k { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-left: 6px; }
  .k.held { background: var(--green); } .k.empty { background: var(--amber); } .k.none { border: 1px dashed var(--line); }
</style>
