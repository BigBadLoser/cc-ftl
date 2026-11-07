<script lang="ts">
  import { Chip, Meter, Segmented } from '../../src/ui/kit';
  import { dangerColor } from '../../src/ui/starmapStyle';
  import HeatBar from '../../src/ui/combat/HeatBar.svelte';
  import DockTab from '../../src/ui/combat/DockTab.svelte';
  import EnemyCard from '../../src/ui/combat/EnemyCard.svelte';
  import UpgradeTip from '../../src/ui/combat/UpgradeTip.svelte';
  import { onMount } from 'svelte';
  import { content } from '../../src/content';
  import { loadItemIcons } from '../../src/app/itemIcons';
  import { upgradeEffects } from '../../src/app/upgradeText';
  import type { ItemDef } from '../../src/sim';
  import type { UiApi, UiIcon, UiShipCombat, UiUpgradeInfo } from '../../src/ui/api';

  // The upgrade hover card needs only the item icons from the api: load the real ones (placeholders included) as the game does.
  let icons = $state<Record<string, UiIcon>>({});
  const api = { itemIcons: { subscribe: (f: (v: Record<string, UiIcon>) => void) => { f(icons); return () => {}; } } } as unknown as UiApi;
  const upgradeIds = Object.keys(content.items).filter((i) => i.startsWith('item.upg_'));
  const info = (id: string): UiUpgradeInfo => {
    const d = (content.items as Record<string, ItemDef>)[id]!;
    return { item: id, name: d.name, effects: d.upgrade ? upgradeEffects(d.upgrade) : [] };
  };
  let ready = $state(false);
  onMount(async () => { icons = await loadItemIcons(upgradeIds, content.items as Record<string, ItemDef>); ready = true; });

  const oc = { left: 0, cooldown: 0 };
  const gun = (id: number, name: string, charge: number, committed: boolean, color: number) =>
    ({ id, name, charge, commitAt: 0.6, committed, stalled: false, destroyed: false, eta: committed ? 2.7 : null, fired: false, color });
  const ship = (name: string, faction: string, klass: string | null, neutral: boolean): UiShipCombat => ({
    ship: 1, name, faction, klass, x: 0, y: 0, state: 'active', neutral, integrity: 0.82, shield: { layers: 0, max: 2, progress: 0.4 },
    heat: { value: 30, max: 100, lockout: 0, venting: 0, cooling: true, overcharge: { weapons: oc, shields: oc, engines: oc } },
    evasion: 0.16, hold: false, ftl: 0, ftlNeed: 0, target: null, modules: [],
    charges: [{ ...gun(1, 'Burst laser', 0.7, true, 0xf08a9a), upgrade: { item: 'item.upg_capacitor', name: 'Quick capacitor', effects: [] } }, { ...gun(2, 'Missile launcher', 0.4, false, 0xffc06a), upgrade: { item: 'item.upg_coolant', name: 'Coolant jacket', effects: [] } }, { ...gun(3, 'Ion cannon', 0.2, false, 0x7ad0ff), stalled: true }],
  } as unknown as UiShipCombat);
  const cards = [
    { e: ship('Navy frigate NA-0005', 'Navy', 'Frigate', false), pill: { text: 'Hostile', tone: 'red' } },
    { e: ship('Raider', 'Enemy', null, false), pill: { text: 'Hostile', tone: 'red' } },
    { e: { ...ship('Kestrel', 'Free traders', 'Liner', false), friendly: true }, pill: { text: 'Friendly', tone: 'green' } },
    { e: ship('Trade station hub C3AA', 'Neutral', 'Hub', true), pill: { text: 'Neutral', tone: 'dim' } },
  ];

  const tones = ['dim', 'good', 'warn', 'bad', 'gold', 'select'] as const;
  const meterTones = ['auto', 'good', 'warn', 'bad', 'neutral'] as const;
  const heights = [4, 6, 8] as const;
  const values = [100, 75, 45, 15];
  const two = [{ value: 'a', label: 'Add' }, { value: 'b', label: 'Erase' }];
  const three = [{ value: 'a', label: 'Small' }, { value: 'b', label: 'Medium' }, { value: 'c', label: 'Large' }];
  const oneOff = [{ value: 'a', label: 'Add' }, { value: 'b', label: 'Erase', disabled: true }];
  const allOff = two.map((o) => ({ ...o, disabled: true }));
  let v = $state({ a: 'a', b: 'a', c: 'b', d: 'a', e: 'b', f: 'a' });
</script>

<div class="lab">
  <h3>Chip <small>tone x size, then outline off, icon, swatch</small></h3>
  {#each ['sm', 'md'] as const as size (size)}
    <div class="row">{#each tones as tone (tone)}<Chip {tone} {size}>{tone} {size}</Chip>{/each}</div>
  {/each}
  <div class="row">
    {#each tones as tone (tone)}<Chip {tone} size="md" outline={false}>{tone} filled</Chip>{/each}
  </div>
  <div class="row">
    <Chip tone="gold" size="md" icon="credits">1200</Chip>
    <Chip tone="warn" icon="alert">Black market</Chip>
    <Chip size="md" swatch={dangerColor(6)}>danger 6</Chip>
    <Chip size="md" caps={false}>Mixed Case</Chip>
  </div>

  <h3>Meter <small>tone (auto uses the 60/30 hull rule) x height, at 100, 75, 45, 15 percent</small></h3>
  {#each meterTones as tone (tone)}
    {#each heights as height (height)}
      <div class="row">
        <span class="lbl">{tone} {height}</span>
        {#each values as v (v)}<span class="m"><Meter value={v} max={100} {tone} {height} /></span>{/each}
      </div>
    {/each}
  {/each}
  <h3>Meter <small>base marker, notch, explicit thresholds 80/50</small></h3>
  <div class="row">
    <span class="lbl">base 40</span><span class="m"><Meter value={65} max={100} base={40} height={8} /></span>
    <span class="lbl">notch .5</span><span class="m"><Meter value={0.3} notches={[0.5]} height={6} /></span>
    <span class="lbl">80/50 at 70</span><span class="m"><Meter value={70} max={100} tone="auto" thresholds={{ good: 80, warn: 50 }} height={6} /></span>
  </div>
  <h3>Heat bar <small>heat's own scale, shared by the player's gauge (marks, auto-vent line) and the enemy card (8px), at 30, 60, 80, 95 percent</small></h3>
  <div class="row">
    <span class="lbl">player</span>
    {#each [30, 60, 80, 95] as v (v)}<span class="m tall"><HeatBar value={v} max={100} marks autoVent={0.7} /></span>{/each}
  </div>
  <div class="row">
    <span class="lbl">enemy 8</span>
    {#each [30, 60, 80, 95] as v (v)}<span class="m"><HeatBar value={v} max={100} height={8} edge="var(--hostile-track)" /></span>{/each}
  </div>

  <h3>Segmented <small>joined group: two options, one disabled, all disabled with nothing selected, three options</small></h3>
  <div class="row">
    <Segmented label="Two" value={v.a} onChange={(x) => (v.a = x)} options={two} />
    <Segmented label="One disabled" value={v.b} onChange={(x) => (v.b = x)} options={oneOff} />
    <Segmented label="All disabled" value="" onChange={() => {}} options={allOff} />
    <Segmented label="Three" value={v.c} onChange={(x) => (v.c = x)} options={three} />
  </div>
  <h3>Build look <small>.build region: plain, .on, disabled buttons, and a Segmented inside it</small></h3>
  <div class="row build bl">
    <button>Plain</button><button class="on">On</button><button disabled>Disabled</button><button class="on" disabled>On disabled</button>
    <Segmented label="Build two" value={v.d} onChange={(x) => (v.d = x)} options={two} />
    <Segmented label="Build all disabled" value="" onChange={() => {}} options={allOff} />
    <Segmented label="Build three" value={v.e} onChange={(x) => (v.e = x)} options={three} />
  </div>

  <h3>Enemy card <small>a generated name shows only its call sign; an authored one whole; a long one cut short</small></h3>
  <div class="row top">
    {#each cards as c (c.e.name)}<EnemyCard {api} enemy={c.e} state={c.pill} onFrame={() => {}} />{/each}
  </div>

  <h3>Upgrade hover card <small>the card a fitted upgrade's symbol opens on a weapon row, for every upgrade (held open here)</small></h3>
  {#if ready}
    <div class="row top">
      {#each upgradeIds as id (id)}<UpgradeTip {api} upgrade={info(id)} open />{/each}
    </div>
  {/if}

  <h3>Dock tabs <small>Board ready, Board blocked, Flee charging (the same DockTab)</small></h3>
  <div class="row tabs">
    <DockTab icon="shuttle" label="Board" keyText="B" tip="Board" testid="lab-board" onclick={() => {}} />
    <DockTab icon="shuttle" label="Board" keyText="B" disabled dim note="Shields up" tip="Shields up" testid="lab-board-blocked" onclick={() => {}} />
    <DockTab icon="fast" label="Flee" keyText="F" disabled fill={0.45} tip="Flee" testid="lab-flee" onclick={() => {}} />
  </div>
</div>

<style>
  .bl { background: var(--build-bg-solid); padding: 10px; border: 1px solid var(--amber); width: fit-content; }
  .lab { padding: 12px 16px 40px; color: var(--text); font-family: system-ui, sans-serif; font-size: 14px; background: #0a0d12; }
  h3 { margin: 18px 0 8px; font: 600 12px var(--head-font); letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-accent); }
  h3 small { color: var(--dim); text-transform: none; letter-spacing: 0; font: 12px system-ui; margin-left: 8px; }
  .row { display: flex; gap: 14px; align-items: center; margin-bottom: 8px; }
  .lbl { width: 90px; color: var(--dim); font-size: 12px; }
  .m { width: 150px; }
  .row.top { align-items: flex-start; gap: 20px; padding-top: 10px; }
  .row.tabs { height: 150px; align-items: stretch; }
  .m.tall { display: flex; height: 22px; }
</style>
