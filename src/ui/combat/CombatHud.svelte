<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { UiAiming, UiApi, UiCombat, UiShipCombat } from '../api';
  import InsetFrame from './InsetFrame.svelte';
  import EnemyCard from './EnemyCard.svelte';
  import { TICK_HZ } from '../../sim/time';
  import { nextHeatRate, type HeatSample } from './heatRate';
  import { weaponForKey } from './weaponKeys';
  import IncomingReadout from './IncomingReadout.svelte';
  import PlayerStrip from './PlayerStrip.svelte';
  import ModuleQuickPanel from './ModuleQuickPanel.svelte';
  import { isTypingTarget } from '../keys';

  /**
   * The combat view (issue #186): while in combat this replaces the colony panels. Enemy card top left, your ship's strip along the bottom.
   * Targeting happens in the world: a weapon card arms "target in view", and the main view's hover brackets and click do the rest.
   */
  let { api, combat }: { api: UiApi; combat: UiCombat } = $props();

  type System = 'weapons' | 'shields' | 'engines';
  let aiming = $state<UiAiming | null>(null);
  const enemy = $derived<UiShipCombat | undefined>(
    combat.enemies.find((e) => e.state === 'active' || e.state === 'disabled') ?? combat.enemies[0],
  );
  const me = $derived(combat.player);

  const vent = () => me && api.dispatch({ type: 'combat.vent', ship: me.ship });
  const overcharge = (system: System) => me && api.dispatch({ type: 'combat.overcharge', ship: me.ship, system });

  // Net heat rate (%/s): see heatRate.ts.
  let tick = $state(0);
  let rate = $state(0);
  let last: HeatSample | null = null;
  $effect(() => {
    const h = me?.heat;
    if (!h) {
      last = null;
      return;
    }
    const next = nextHeatRate(rate, last, { tick, pct: (h.value / h.max) * 100 }, TICK_HZ);
    last = next.last;
    if (next.rate !== rate) rate = next.rate;
  });
  const shownRate = $derived(rate);

  const pill = $derived.by((): { text: string; tone: string } => {
    if (!enemy) return { text: 'Clear', tone: 'dim' };
    if (enemy.state === 'disabled') return { text: 'Disabled', tone: 'amber' };
    if (enemy.state !== 'active') return { text: enemy.state, tone: 'dim' };
    if (enemy.heat.lockout > 0) return { text: 'Overheated', tone: 'green' };
    if (me?.hold) return { text: 'You hold fire', tone: 'amber' };
    if (enemy.shield.max > 0 && enemy.shield.layers === 0) return { text: 'Shields down', tone: 'green' };
    return { text: 'Hostile', tone: 'red' };
  });
  const helmManned = $derived(!!me?.consoles.some((c) => c.kind === 'helm' && c.powered && c.operator !== null));

  // The main view shows the enemy (the ships are usually too far apart to frame together); your ship sits in the inset. Swap flips them.
  let swapped = $state(false);
  const mainShip = $derived((swapped ? me?.ship : enemy?.ship) ?? 0);
  const insetShip = $derived((swapped ? enemy?.ship : me?.ship) ?? 0);
  $effect(() => {
    if (mainShip) api.focusFight(mainShip);
  });
  const swap = () => (swapped = !swapped);
  // The module quick panel belongs to your ship in the main view: swapping back drops the selection.
  $effect(() => {
    if (!swapped) api.selectModule(null);
  });

  // A new hostile ship starts as the ship-wide target (as the old panel did), and the camera frames both ships once.
  let autoAimed = 0;
  $effect(() => {
    if (me && enemy && enemy.state !== 'wreck' && !me.target && autoAimed !== enemy.ship) {
      autoAimed = enemy.ship;
      api.dispatch({ type: 'combat.setTarget', ship: me.ship, weaponId: null, targetShip: enemy.ship, targetModuleId: 0 });
    }
  });

  const select = (id: number) => api.setAiming(aiming?.weapon === id ? null : { weapon: id });
  const drive = $derived(me ? { charge: me.ftl, max: me.ftlMax, helmManned, active: me.state === 'active' } : null);
  const flee = () => me && api.dispatch({ type: 'combat.flee', ship: me.ship });

  /** Run a key's action and swallow the event so no other handler sees it. */
  function consume(e: KeyboardEvent): void {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || !me || isTypingTarget(e)) return;
    if (e.key === 'Tab') {
      consume(e);
      swap();
      return;
    }
    const k = e.key.toLowerCase();
    // Thermal overload: the strip is locked.
    if (me.heat.lockout > 0 && /^[qwevhfg]$/.test(k)) return consume(e);
    // Weapon hotkeys are Q W E R (1-3 stay the game-speed keys). R is also the crew-draft key (controller.ts): in combat it picks weapon 4
    // only when the ship has a fourth weapon; with three or fewer it falls through to draft as before (see weaponKeys.ts).
    const w = weaponForKey(k, me.weapons);
    if (w) select(w.id);
    else if (/^[qwer]$/.test(k)) return;
    else if (k === 'v') api.dispatch({ type: 'combat.fireVolley', ship: me.ship });
    else if (k === 'h') api.dispatch({ type: 'combat.setHold', ship: me.ship, hold: !me.hold });
    else if (k === 'f') {
      if (me.ftl >= me.ftlMax) flee();
    } else if (k === 'g') vent();
    else return;
    consume(e);
  }
  onMount(() => {
    const un = api.aiming.subscribe((a) => (aiming = a));
    const un2 = api.snapshot.subscribe((x) => {
      tick = x.tick;
    });
    window.addEventListener('keydown', onKey, true);
    return () => {
      un();
      un2();
      window.removeEventListener('keydown', onKey, true);
    };
  });
  onDestroy(() => api.setAiming(null));
</script>

<div class="hud" data-testid="combat-hud">
  {#if enemy}
    <div class="top"><EnemyCard {enemy} state={pill} onFrame={() => api.focusFight(mainShip)} /></div>
  {/if}
  {#if me && insetShip}
    <div class="insetdock">
      <InsetFrame {api} ship={insetShip} title={swapped ? 'Enemy ship' : 'Your ship'} threatened={me.incoming.length > 0} onSwap={swap} />
    </div>
  {/if}
  {#if me && swapped}
    <div class="quick"><ModuleQuickPanel {api} ship={me.ship} /></div>
  {/if}
  {#if me && me.incoming.length > 0}
    <div class="incoming"><IncomingReadout shots={me.incoming} /></div>
  {/if}
  {#if me}
    <div class="bot">
      <PlayerStrip {api} {me} {flee} {drive} {aiming} onSelect={select} rate={shownRate} onVent={vent} onOvercharge={overcharge} />
    </div>
  {/if}
</div>

<style>
  .hud {
    position: fixed;
    inset: 0;
    z-index: 5;
    pointer-events: none;
  }
  .top {
    position: absolute;
    left: calc(var(--gutter) + var(--sal));
    top: calc(34px + var(--sat));
  }
  /* Clear of the strip (182px tall, 8px off the bottom) with a gutter between. */
  .insetdock {
    position: absolute;
    left: calc(var(--gutter) + var(--sal));
    bottom: calc(var(--gutter) + var(--sab) + 192px);
  }
  /* Your own ship in the main view: the clicked module's quick panel, bottom right, clear of the strip, inset and incoming timeline. */
  .quick {
    position: absolute;
    right: calc(var(--gutter) + var(--sar));
    bottom: calc(var(--gutter) + var(--sab) + 192px);
  }
  .incoming {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--gutter) + var(--sab) + 192px);
  }
  .bot {
    position: absolute;
    left: 0;
    right: 0;
    bottom: calc(var(--gutter) + var(--sab));
    display: flex;
    justify-content: center;
  }
</style>
