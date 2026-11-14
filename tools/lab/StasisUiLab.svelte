<script lang="ts">
  import type { UiApi, UiCrew, UiModule, UiWheelSlot } from '../../src/ui/api';
  import ModuleOverview from '../../src/ui/module/ModuleOverview.svelte';
  import CrewOverview from '../../src/ui/crew/CrewOverview.svelte';
  import WheelDisc from './stasisUi/WheelDisc.svelte';
  import WheelRoster from './stasisUi/WheelRoster.svelte';
  import WheelBank from './stasisUi/WheelBank.svelte';
  import StasisCard from './stasisUi/StasisCard.svelte';
  import StasisRows from './stasisUi/StasisRows.svelte';

  /** The stasis UI pieces with mock data (#116): see stasisUiLab.ts. `faces` are real portraits for crew ids 1..n. */
  let { faces }: { faces: (string | null)[] } = $props();
  const sub = <T,>(v: T) => ({ subscribe: (f: (x: T) => void) => (f(v), () => {}) });
  const api = new Proxy({
    portrait: (id: number) => faces[(id - 1) % faces.length] ?? null,
    shuttles: sub({ shuttles: [], airlocks: [], targets: [], roster: [], bays: [], regions: [], transfers: [], ferryReady: false }),
  } as Record<string, unknown>, { get: (t, k: string) => (k in t ? t[k] : () => {}) }) as unknown as UiApi;

  const full = (crew: number, name: string, reserve = 100, draining = false): UiWheelSlot => ({ kind: 'full', crew, name, reserve, draining });
  const wheels: [string, UiWheelSlot[]][] = [
    ['Wheel: 3 held, 5 empty slabs, 2 bare sockets', [full(1, 'Vasska Orr'), { kind: 'empty' }, full(2, 'Dree Malk'), { kind: 'empty' }, { kind: 'empty' }, full(3, 'Ostin Pell', 64, true), { kind: 'empty' }, { kind: 'none' }, { kind: 'empty' }, { kind: 'none' }]],
    ['Wheel as built: every slot an empty slab', Array.from({ length: 10 }, () => ({ kind: 'empty' }) as UiWheelSlot)],
    ['Wheel full', Array.from({ length: 10 }, (_, i) => full(i + 1, `Prisoner ${i + 1}`))],
  ];
  const mod = (wheel: UiWheelSlot[]): UiModule => ({
    id: 9, ship: 1, def: 'module.stasis_wheel', name: 'Stasis wheel', x: 0, y: 0, local: { x: 0, y: 0 }, hp: 200, maxHp: 200, repairFirst: false,
    powerPriority: 0, enabled: true, powered: true, power: -2, reserve: null, wheel, storage: false, crafting: false, research: false, plot: null, idle: false,
    bay: null, droneBay: null, upgradeSlot: null,
  }) as unknown as UiModule;
  const crew = (id: number, stasis: UiCrew['stasis']): UiCrew => ({
    id, name: 'Vasska Orr', side: 'enemy', dead: false, downed: null, hp: 70, maxHp: 100, mood: null, hunger: null, rest: 60, prisoner: true, surrendered: true,
    seal: { marked: true, refusal: 'Already sealed in stasis' }, stasis, weapon: null, traits: [], fight: null, broke: null, job: null, activity: '', drafted: false,
  }) as unknown as UiCrew;
  const crews: [string, UiCrew][] = [
    ['Selected from the wheel', crew(1, { where: 'Stasis wheel, slot 1', wheel: 9, carrier: null, to: null, reserve: 100, draining: false })],
    ['Selected from the hover cart', crew(2, { where: 'On a hover cart', wheel: 9, carrier: { id: 4, name: 'Ada Kerrow' }, to: 'Stasis wheel', reserve: 100, draining: false })],
    ['Left on the floor', crew(3, { where: 'On the floor, waiting to be carted', wheel: null, carrier: null, to: null, reserve: 64, draining: true })],
  ];
</script>

{#snippet stats()}<dl><dt>State</dt><dd>Running</dd><dt>Power</dt><dd>2 draw</dd><dt>Health</dt><dd>200/200</dd></dl>{/snippet}
{#if new URLSearchParams(location.search).has('current')}
<div class="lab">
  {#each wheels as [label, w] (label)}
    <section><h4>{label}</h4><div class="insp"><ModuleOverview {api} m={mod(w)} ftl={null} onPower={() => {}} /></div></section>
  {/each}
  {#each crews as [label, c] (label)}
    <section><h4>{label}</h4><div class="insp"><CrewOverview {api} {c} onPriorities={() => {}} /></div></section>
  {/each}
</div>
{:else}
<div class="lab">
  {#each [['W1 wheel from above', WheelDisc], ['W2 lamp ring + roster', WheelRoster], ['W3 slab bank', WheelBank]] as const as [label, W] (label)}
    <section class="col"><h4>{label}</h4>
      {#each wheels.slice(0, 2) as [, w], j (j)}<div class="insp">{@render stats()}<W slots={w} face={(id: number) => api.portrait(id)} /></div>{/each}
    </section>
  {/each}
  <section class="col"><h4>S1 slab card (replaces the portrait block)</h4>
    {#each crews as [, c] (c.id)}{#if c.stasis}<div class="insp"><StasisCard name={c.name} face={api.portrait(c.id)} st={c.stasis} /></div>{/if}{/each}
  </section>
  <section class="col"><h4>S2 tidy rows (under the portrait)</h4>
    {#each crews as [, c] (c.id)}{#if c.stasis}<div class="insp"><StasisRows st={c.stasis} /></div>{/if}{/each}
  </section>
</div>
{/if}

<style>
  .lab { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; align-items: flex-start; }
  h4 { margin: 0 0 6px; color: var(--dim); font: 12px monospace; }
  .insp { width: 300px; padding: 12px; background: var(--panel); border: 1px solid var(--line); }
  .col { display: grid; gap: 10px; }
  dl { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; margin: 0 0 6px; font-size: 14px; } dt { color: var(--dim); } dd { margin: 0; text-align: right; }
</style>
