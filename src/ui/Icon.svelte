<script lang="ts" module>
  /** Line icons on a 24-unit grid (stroke 2). UI art, so drawing them in code is fine; a sheet from the art pipeline can replace them. */
  export const ICONS = {
    power: 'M13 2 4 14h7l-1 8 9-12h-7z',
    o2: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z',
    credits: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15 9.5a3.5 3 0 1 0 0 5',
    fuel: 'M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h14M7 9h6M15 8l3 2v8a1.5 1.5 0 0 0 3 0v-7l-3-3',
    stock: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    wrench: 'M14 6a4 4 0 0 0 5 5l-9 9a2 2 0 0 1-3-3l9-9a4 4 0 0 0-2-2z',
    target: 'M12 3v4M12 17v4M3 12h4M17 12h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
    sleep: 'M4 8h6l-6 8h6M14 4h6l-6 6h6',
    food: 'M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-2 6 0 8v10',
    bolt: 'M13 2 4 14h7l-1 8 9-12h-7z',
    walk: 'M13 4a1.5 1.5 0 1 0 0 .1M10 21l2-6 3 3v3M12 15l-1-5 4 1 2 3M11 10l-3 3',
    idle: 'M6 12h.01M12 12h.01M18 12h.01',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z',
    skull: 'M12 3a7 7 0 0 0-7 7v4h3v3h8v-3h3v-4a7 7 0 0 0-7-7zM9 11h.01M15 11h.01',
    away: 'M12 2c3 2 4 6 3 10l-3 3-3-3c-1-4 0-8 3-10zM9 15l-3 4M15 15l3 4M12 15v6',
    shuttle: 'M12 2c3 2 4 6 3 10l-3 3-3-3c-1-4 0-8 3-10zM9 15l-3 4M15 15l3 4M12 15v6',
    trade: 'M4 8h13l-3-3M20 16H7l3 3',
    prize: 'M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z',
    combat: 'M4 20l7-7M4 4l16 16M20 4l-7 7M14 17l3 3M7 14l-3 3',
    walls: 'M3 21V9l9-6 9 6v12M3 21h18M9 21v-6h6v6',
    overlay: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
    debug: 'M9 7V5a3 3 0 0 1 6 0v2M7 8h10v6a5 5 0 0 1-10 0zM3 12h4M17 12h4M4 7l3 2M20 7l-3 2M4 18l3-2M20 18l-3-2',
    pause: 'M8 5v14M16 5v14',
    play: 'M7 5l12 7-12 7z',
    fast: 'M4 5l8 7-8 7zM12 5l8 7-8 7z',
    faster: 'M2 5l6 7-6 7zM9 5l6 7-6 7zM16 5l6 7-6 7z',
    draft: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
    downed: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10zM12 7l-1 4 2 2-1 4',
    back: 'M15 5l-7 7 7 7',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    rotate: 'M20 12a8 8 0 1 1-3-6.2M20 4v5h-5',
    select: 'M5 3l14 8-6 2 4 7-3 1-4-7-5 4z',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6',
    close: 'M5 5l14 14M19 5L5 19',
    wall: 'M3 5h18v14H3zM3 12h18M9 5v7M15 12v7',
    floor: 'M3 12l9-5 9 5-9 5zM3 12v3l9 5 9-5v-3',
    door: 'M6 21V4h12v17M3 21h18M15 12h.01',
    module: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    ship: 'M3 12l5-6h11l2 6-2 6H8z',
    person: 'M12 3.5a3.5 3.5 0 1 0 0 .1M5 21c0-4 3-7 7-7s7 3 7 7',
    smile: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 14c1 2 7 2 8 0M9 9.5h.01M15 9.5h.01',
    grid: 'M4 4h16v16H4zM4 12h16M12 4v16',
    room: 'M4 4h16v16H4zM4 10h6V4',
    hull: 'M12 2c3 3 6 8 6 13l-2 3H8l-2-3c0-5 3-10 6-13zM9 21h6M12 8v6',
    station: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM2 12h4M18 12h4',
    derelict: 'M3 17l5-9 4 5 3-4 6 8zM3 17h18',
    alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
    fire: 'M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z',
  } as const;
  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  let { name, size = 18, title }: { name: IconName; size?: number; title?: string } = $props();
</script>

<svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden={title ? undefined : 'true'} role={title ? 'img' : undefined}>
  {#if title}<title>{title}</title>{/if}
  <path d={ICONS[name]} />
</svg>

<style>
  .icon { display: block; flex: none; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
</style>
