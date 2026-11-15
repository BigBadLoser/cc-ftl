<script lang="ts">
  import type { UiApi, UiCrew, UiModule, UiPrisonerDeal, UiWheelSlot } from '../../src/ui/api';
  import PrisonerDeals from '../../src/ui/PrisonerDeals.svelte';
  import ModuleOverview from '../../src/ui/module/ModuleOverview.svelte';
  import CrewOverview from '../../src/ui/crew/CrewOverview.svelte';
  import { PaneHead } from '../../src/ui/kit';

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
    seal: { marked: true, refusal: 'Already sealed in stasis', wait: null }, stasis, weapon: null, traits: [], fight: null, broke: null, job: null, activity: '', drafted: false,
  }) as unknown as UiCrew;
  const crews: [string, UiCrew][] = [
    ['Selected from the wheel', crew(1, { where: 'Stasis wheel, slot 1', wheel: 9, carrier: null, to: null, reserve: 100, draining: false, inTransit: false })],
    ['Selected from the hover cart', crew(2, { where: 'On a hover cart', wheel: 9, carrier: { id: 4, name: 'Ada Kerrow' }, to: 'Stasis wheel', reserve: 100, draining: false, inTransit: true })],
    ['Left on the floor', crew(3, { where: 'On the floor, waiting to be carted', wheel: null, carrier: null, to: null, reserve: 64, draining: true, inTransit: false })],
    ['In the shuttle', crew(5, { where: 'In the shuttle, on the way to a stasis wheel', wheel: null, carrier: null, to: null, reserve: 90, draining: false, inTransit: true })],
  ];
  // The station's Prisoners service (#116): an offer, runs under way, and rows with no deal here.
  const deal = (id: number, name: string, faction: string, tier: UiPrisonerDeal['tier'], where: string, offer: UiPrisonerDeal['offer'], frozen = true): UiPrisonerDeal =>
    ({ id, name, faction, tier, frozen, where, wanted: true, offer });
  const deals: UiPrisonerDeal[] = [
    deal(1, 'Vasska Orr', 'Navy', 'neutral', 'Stasis wheel, slot 1', { ok: true, label: 'Ransom ₵240', note: '+2 Navy' }),
    deal(2, 'Dree Malk', 'Red Talon', 'hostile', 'Stasis wheel, slot 3', { ok: false, label: '', note: 'Bounty ₵175', status: 'Loading your shuttle…', cancel: 4 }),
    deal(3, 'Ostin Pell', 'Navy', 'neutral', 'in a shuttle', { ok: false, label: '', note: 'Ransom ₵200', status: 'On the way to the station' }),
    deal(4, 'Kell Ashe', 'Meridian', 'neutral', 'Stasis wheel, slot 6', { ok: false, label: '', note: 'Ransom at Meridian stations' }),
    deal(1, 'Ira Voln', 'Navy', 'neutral', 'not sealed', { ok: false, label: '', note: 'Seal them in stasis first (ransom ₵180 here)' }, false),
  ].map((d, i) => ({ ...d, id: i + 1 }));
</script>

<div class="lab">
  {#each wheels as [label, w] (label)}
    <section><h4>{label}</h4><div class="insp"><ModuleOverview {api} m={mod(w)} ftl={null} onPower={() => {}} /></div></section>
  {/each}
</div>
{#snippet head(c: UiCrew)}<PaneHead icon="skull" title={c.name} sub="Security · hostile" foe />{/snippet}
<div class="lab">
  <section class="col"><h4>Not frozen: unmarked, marked for sealing, marked on a prize (shuttle)</h4>
    <div class="win">{@render head(crews[0]![1])}<div class="body"><CrewOverview {api} c={{ ...crews[0]![1], stasis: null, seal: { marked: false, refusal: null, wait: null } }} onPriorities={() => {}} /></div></div>
    <div class="win">{@render head(crews[0]![1])}<div class="body"><CrewOverview {api} c={{ ...crews[0]![1], stasis: null, seal: { marked: true, refusal: null, wait: null } }} onPriorities={() => {}} /></div></div>
    <div class="win">{@render head(crews[0]![1])}<div class="body"><CrewOverview {api} c={{ ...crews[0]![1], stasis: null, seal: { marked: true, refusal: null, wait: 'Marked: a shuttle brings empty slabs and carries the full one home' } }} onPriorities={() => {}} /></div></div>
  </section>
  <section class="col"><h4>Frozen: in the wheel, on a cart, on the floor, in a shuttle</h4>
    {#each crews as [, c] (c.id)}<div class="win">{@render head(c)}<div class="body"><CrewOverview {api} {c} onPriorities={() => {}} /></div></div>{/each}
  </section>
</div>

<div class="lab">
  <section><h4>Station Prisoners service: an offer, a run collecting, a run on the way, no deal here, not sealed</h4>
    <div class="win wide"><div class="body"><PrisonerDeals {api} station={7} {deals} /></div></div>
  </section>
</div>

<style>
  .lab { display: flex; flex-wrap: wrap; gap: 16px; padding: 16px; align-items: flex-start; }
  h4 { margin: 0 0 6px; color: var(--dim); font: 12px monospace; }
  .insp { width: 300px; padding: 12px; background: var(--panel); border: 1px solid var(--line); }
  .col { display: grid; gap: 12px; }
  .win { width: 300px; background: var(--panel); border: 1px solid var(--line); }
  .body { padding: 10px 12px 4px; }
  .win.wide { width: 520px; }
</style>
