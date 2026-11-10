<script lang="ts">
  import { onMount } from 'svelte';
  import { Select, tip, type KitOption } from './kit';
  import { schedules } from '../content/schedules';
  import type { ScheduleBlock } from '../sim';
  import type { UiApi, UiCrew } from './api';
  import Icon from './Icon.svelte';
  import { BRUSHES, clickSelect, coverage, coverTone, matchPreset, painted, paintRange, targets, type Row } from './schedule';

  /** The Schedule tab of the Crew window (#412): paint each crew member's 24 hour blocks. Every edit is a sim command; counts read the snapshot rows. */
  let { api, crew }: { api: UiApi; crew: UiCrew[] } = $props();

  const HOURS = Array.from({ length: 24 }, (_, h) => h);
  const presets = Object.values(schedules);
  const rows = $derived(crew.filter((c): c is UiCrew & { schedule: NonNullable<UiCrew['schedule']> } => !!c.schedule && !c.dead));
  let nowHour = $state(0);
  onMount(() => api.snapshot.subscribe((s) => (nowHour = s.clock.hour)));

  let brush = $state<ScheduleBlock>('work');
  let selected = $state<number[]>([]);
  let copied = $state<number | null>(null);
  /** A paint stroke in progress: the rows it hits, where it started and where the pointer is now. */
  let drag = $state<{ ids: number[]; row: number; from: number; to: number; block: ScheduleBlock } | null>(null);
  let root: HTMLDivElement | undefined = $state();

  const cover = $derived(coverage(rows.map((c) => c.schedule.hours)));
  const hoursOf = (c: { id: number; schedule: { hours: Row } }): Row =>
    drag && drag.ids.includes(c.id) ? painted(c.schedule.hours, drag.from, drag.to, drag.block) : c.schedule.hours;
  const coverShown = $derived(drag ? coverage(rows.map(hoursOf)) : cover);

  function down(e: PointerEvent, c: { id: number }, h: number) {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    root?.focus({ preventScroll: true });
    drag = { ids: targets(selected, c.id), row: c.id, from: h, to: h, block: e.button === 2 ? 'any' : brush };
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-h]');
    if (cell && Number(cell.dataset.row) === drag.row) drag.to = Number(cell.dataset.h);
  }
  function up() {
    if (!drag) return;
    const { from, to } = paintRange(drag.from, drag.to);
    for (const id of drag.ids) api.dispatch({ type: 'crew.schedule.set', id, from, to, block: drag.block });
    drag = null;
  }
  function key(e: KeyboardEvent) {
    const b = BRUSHES.find((x) => x.key === e.key);
    if (!b || e.ctrlKey || e.metaKey || e.altKey) return;
    brush = b.block;
    e.stopPropagation(); // 1-3 are the speed keys elsewhere
  }
  const setPreset = (id: number, preset: string) => { for (const t of targets(selected, id)) api.dispatch({ type: 'crew.schedule.preset', id: t, preset }); };
  function paste(id: number) {
    if (copied === null) return;
    for (const t of targets(selected, id)) if (t !== copied) api.dispatch({ type: 'crew.schedule.copy', id: t, from: copied });
  }
  function presetOptions(row: Row): KitOption[] {
    const o: KitOption[] = presets.map((p) => ({ value: p.id, label: p.name }));
    return matchPreset(row, presets) ? o : [...o, { value: 'custom', label: 'Custom', disabled: true }];
  }
  const hourTip = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const label = (h: number) => (h === nowHour ? true : h % 2 === 0 && Math.abs(h - nowHour) !== 1);
  const quarter = (h: number) => h % 6 === 5 && h < 23;
</script>

<svelte:window onpointermove={move} onpointerup={up} onpointercancel={() => (drag = null)} />

<div class="pane" bind:this={root} tabindex="-1" role="group" aria-label="Crew schedule" onkeydown={key} data-testid="schedule-pane">
  <div class="brushes">
    <span class="lbl">Brush</span>
    {#each BRUSHES as b (b.block)}
      <button class="brush" class:on={brush === b.block} data-testid="brush-{b.block}" onclick={() => (brush = b.block)}><i class="sw {b.block}"></i>{b.label}<small>{b.key}</small></button>
    {/each}
  </div>

  <div class="grid">
    <div class="line axis">
      <span class="left"></span>
      <div class="hrs">{#each HOURS as h (h)}<span class="ax" class:q={quarter(h)} class:now={h === nowHour}>{label(h) ? String(h).padStart(2, '0') : ''}</span>{/each}</div>
    </div>

    {#each rows as c (c.id)}
      <div class="line" data-testid="sched-row-{c.id}">
        <div class="left">
          <button class="name" class:sel={selected.includes(c.id)} onclick={(e) => (selected = clickSelect(selected, c.id, e.shiftKey))} use:tip={{ text: 'Click to select, shift-click to select several. Presets and paste then apply to all selected.' }}>{c.name}<i>{c.role}</i></button>
          <button class="ic" class:on={copied === c.id} aria-label="Copy schedule" use:tip={{ text: copied === c.id ? 'Copied: paste it on another crew member' : 'Copy this schedule' }} onclick={() => (copied = copied === c.id ? null : c.id)}><Icon name="copy" size={14} /></button>
          <button class="ic" aria-label="Paste schedule" disabled={copied === null || copied === c.id} use:tip={{ text: 'Paste the copied schedule' }} onclick={() => paste(c.id)}><Icon name="paste" size={14} /></button>
          <span class="preset"><Select options={presetOptions(c.schedule.hours)} value={matchPreset(c.schedule.hours, presets) ?? 'custom'} onChange={(v) => setPreset(c.id, v)} label="Schedule preset" testId="preset-{c.id}" /></span>
        </div>
        <div class="hrs" role="presentation" oncontextmenu={(e) => e.preventDefault()}>
          {#each hoursOf(c) as b, h (h)}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <div class="cell {b}" class:q={quarter(h)} class:now={h === nowHour} data-row={c.id} data-h={h} data-testid="cell-{c.id}-{h}" use:tip={{ text: `${hourTip(h)} ${b}` }} onpointerdown={(e) => down(e, c, h)}></div>
          {/each}
        </div>
      </div>
    {/each}

    <div class="line onwork">
      <span class="left lbl">On work</span>
      <div class="hrs">{#each coverShown as n, h (h)}<span class="cnt {coverTone(n)}" class:q={quarter(h)} use:tip={{ text: `${hourTip(h)}: ${n} on Work` }}>{n}</span>{/each}</div>
    </div>
  </div>
  <p class="hint">Drag to paint · right-drag for Any · shift-click names to select several rows</p>
</div>

<style>
  .pane { outline: none; user-select: none; }
  .lbl { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--dim); }
  .brushes { display: flex; gap: 6px; align-items: center; margin-bottom: 12px; }
  .brush { display: inline-flex; align-items: center; gap: 6px; height: 28px; min-height: 0; padding: 0 10px; font-size: 12px; }
  .brush.on { border-color: var(--cyan); background: var(--panel-3); color: #fff; }
  .brush small { color: var(--dim); font-size: 11px; }
  .sw { width: 12px; height: 12px; display: inline-block; }
  .grid { display: flex; flex-direction: column; gap: 4px; overflow-x: auto; padding-bottom: 2px; }
  .line { display: flex; align-items: center; gap: 0; }
  .left { display: flex; align-items: center; gap: 3px; flex: 0 0 auto; width: 342px; padding-right: 10px; }
  .name { flex: 0 0 140px; text-align: left; border: 0; background: none; min-height: 0; height: 26px; padding: 0 2px; font-size: 13px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .name i { font-style: normal; color: var(--dim); font-size: 11px; margin-left: 4px; }
  .name.sel { box-shadow: inset 0 0 0 1px var(--cyan); background: var(--panel-2); }
  .ic { width: 24px; height: 24px; min-height: 0; padding: 0; display: inline-flex; align-items: center; justify-content: center; color: var(--cyan); }
  .ic.on { border-color: var(--cyan); background: var(--panel-3); }
  .ic:disabled { opacity: 0.35; }
  .preset { flex: 1; min-width: 0; }
  .preset :global(.kit-sel-trigger) { min-height: 24px; height: 24px; min-width: 0; width: 100%; padding: 0 8px; font-size: 12px; }
  .hrs { display: flex; gap: 1px; flex: 0 0 auto; }
  .hrs > .q { margin-right: 3px; }
  .ax { width: 16px; font-size: 10px; color: var(--dim); white-space: nowrap; overflow: visible; }
  .ax.now { color: #fff; font-weight: 700; }
  .cell { width: 16px; height: 26px; position: relative; cursor: pointer; }
  .cell.work, .sw.work { background: var(--work); }
  .cell.sleep, .sw.sleep { background: var(--sleep); }
  .cell.free, .sw.free { background: var(--free); }
  .cell.any, .sw.any { background: repeating-linear-gradient(135deg, #323941 0 3px, #1a1f24 3px 6px); }
  .cell.now::after { content: ''; position: absolute; inset: -2px -1px; border: 2px solid #fff; pointer-events: none; z-index: 1; }
  .cnt { width: 16px; height: 20px; box-sizing: border-box; border: 1px solid var(--line); background: var(--panel-2); font-size: 11px; line-height: 18px; text-align: center; color: var(--text); }
  .cnt.none { border-color: var(--red); color: var(--red); background: #2a0f14; }
  .cnt.one { color: var(--amber); }
  .onwork { margin-top: 2px; }
  .hint { margin: 8px 0 0; color: var(--dim); font-size: 12px; }
</style>
