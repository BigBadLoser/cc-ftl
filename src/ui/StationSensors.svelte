<script lang="ts">
  import type { UiStationInfo } from './api';
  import PaneHeader from './comms/PaneHeader.svelte';

  /**
   * The right pane's top: the station's sensor screen and the traffic log. The hologram is a code-drawn placeholder until each station type
   * has its own sprite from the Blender pipeline (step 3); the traffic on it is the real ships near the station.
   */
  let { name, info }: { name: string; info: UiStationInfo } = $props();
  const W = 340;
  const H = 230;
  const contacts = $derived(info.traffic?.contacts ?? []);
  /** Fit the farthest contact into the screen, keeping a minimum scale so a quiet node does not blow up. */
  const scale = $derived.by(() => {
    const far = Math.max(30, ...contacts.map((c) => Math.hypot(c.dx, c.dy)));
    return Math.min(W / 2 - 40, H / 2 - 30) / far;
  });
  const at = (c: { dx: number; dy: number }) => ({ x: W / 2 + c.dx * scale, y: H / 2 + c.dy * scale });
  const log = $derived(info.traffic?.log ?? []);
  const ofKind = (k: 'you' | 'shuttle' | 'ship') => contacts.filter((c) => c.kind === k);
</script>

<PaneHeader label="SENSORS" done="LIVE" />
<div class="screen" style:height={`${H}px`} data-testid="station-sensors">
  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" aria-label="Station sensor view">
    <!-- Placeholder hologram: a ring station outline (pending art). -->
    <g class="holo" transform={`translate(${W / 2} ${H / 2})`}>
      <ellipse rx="46" ry="22" /><ellipse rx="30" ry="14" /><path d="M0 -34 V-10 M-52 0 H-30 M30 0 H52" /><circle r="4" />
    </g>
    {#each ofKind('ship') as c (c.id)}
      {@const q = at(c)}
      <g class="other"><path d={`M${W / 2} ${H / 2} L${q.x} ${q.y}`} /><rect x={q.x - 5} y={q.y - 3} width="10" height="6" /><text x={q.x} y={q.y + 14} text-anchor="middle">{c.label}</text></g>
    {/each}
    {#each ofKind('you') as c (c.id)}
      {@const q = at(c)}
      <g class="you"><rect x={q.x - 9} y={q.y - 5} width="18" height="10" /><text x={q.x} y={q.y - 10} text-anchor="middle">YOU</text></g>
    {/each}
    {#each ofKind('shuttle') as c (c.id)}
      {@const q = at(c)}
      <g class="shuttle"><rect x={q.x - 3} y={q.y - 3} width="6" height="6" /><text x={q.x} y={q.y + 14} text-anchor="middle">{c.label}</text></g>
    {/each}
  </svg>
  <span class="name">{name.toUpperCase()}</span>
  <span class="tag">HOLOGRAM PENDING</span>
  <div class="def"><b>DEFENCE</b>{info.guns} guns · {info.shields} shields</div>
  <div class="dock"><b>DOCKS</b>{info.docks} working</div>
  <i class="lines"></i>
</div>
<div class="log" data-testid="station-traffic">
  {#each log as l, i (i)}<div><b>{l.who}</b> <span>{l.what}</span></div>{:else}<div class="none">No traffic on the dock.</div>{/each}
</div>

<style>
  .screen { position: relative; border-bottom: 1px solid var(--line); background: #04080b repeating-linear-gradient(90deg, rgba(54, 212, 255, 0.05) 0 1px, transparent 1px 14px), repeating-linear-gradient(0deg, rgba(54, 212, 255, 0.05) 0 1px, transparent 1px 14px); overflow: hidden; }
  .lines { position: absolute; inset: 0; background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(0, 0, 0, 0.3) 3px 4px); pointer-events: none; }
  svg { position: absolute; inset: 0; }
  .holo { fill: rgba(54, 212, 255, 0.12); stroke: var(--ink-accent); stroke-width: 1.5; }
  .other path { stroke: var(--line-hi); stroke-dasharray: 3 3; fill: none; }
  .other rect { fill: var(--dim); opacity: 0.6; }
  .you rect { fill: var(--green); }
  .shuttle rect { fill: var(--amber); }
  text { font: 8px var(--pixel-font); letter-spacing: 0.06em; }
  .other text { fill: var(--dim); } .you text { fill: var(--green); } .shuttle text { fill: var(--amber); }
  .name { position: absolute; left: 8px; top: 6px; font: 9px var(--pixel-font); letter-spacing: 0.1em; color: var(--ink-accent); }
  .tag { position: absolute; right: 8px; top: 6px; font: 8px var(--pixel-font); color: var(--amber); }
  .def, .dock { position: absolute; font-size: 12px; color: var(--text); line-height: 1.2; }
  .def { left: 8px; top: 22px; } .dock { right: 8px; bottom: 6px; text-align: right; }
  .def b, .dock b { display: block; font: 9px var(--pixel-font); color: var(--amber); letter-spacing: 0.1em; }
  .log { padding: 8px 10px; display: grid; gap: 4px; font-size: 12.5px; border-bottom: 1px solid var(--line); min-height: 64px; box-sizing: border-box; }
  .log b { font-weight: 600; }
  .log span { color: var(--dim); }
  .none { color: var(--dim); }
</style>
