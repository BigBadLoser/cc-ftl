<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import type { UiAiming, UiApi, UiCombat, UiShipCombat } from '../api';
  import EnemyCard from './EnemyCard.svelte';
  import PlayerStrip from './PlayerStrip.svelte';

  /**
   * The combat view (issue #186): while in combat this replaces the colony panels. Enemy card top left, your ship's strip along the bottom.
   * Targeting happens in the world: a weapon card arms "target in view", and the main view's hover brackets and click do the rest.
   */
  let { api, combat }: { api: UiApi; combat: UiCombat } = $props();

  let aiming = $state<UiAiming | null>(null);
  const enemy = $derived<UiShipCombat | undefined>(combat.enemies.find((e) => e.state === 'active' || e.state === 'disabled') ?? combat.enemies[0]);
  const me = $derived(combat.player);

  // MOCK: heat and overcharge have no sim. A fake heat value that drifts, and one overcharge (weapons) shown active with a countdown.
  let heat = $state(0.62);
  let oc = $state<'weapons' | 'shields' | 'engines' | null>('weapons');
  let ocLeft = $state(0.7);
  const timer = setInterval(() => {
    ocLeft = ocLeft <= 0.02 ? 1 : ocLeft - 0.02;
    heat = Math.min(1, Math.max(0.2, heat + (Math.sin(Date.now() / 3000) * 0.004)));
  }, 250);
  const vent = () => { heat = 0.2; };
  const overcharge = (k: 'weapons' | 'shields' | 'engines') => { oc = oc === k ? null : k; ocLeft = 1; heat = Math.min(1, heat + 0.1); };

  const pill = $derived.by((): { text: string; tone: string } => {
    if (!enemy) return { text: 'Clear', tone: 'dim' };
    if (enemy.state === 'disabled') return { text: 'Disabled', tone: 'amber' };
    if (enemy.state !== 'active') return { text: enemy.state, tone: 'dim' };
    if (me?.hold) return { text: 'You hold fire', tone: 'amber' };
    if (enemy.shield.max > 0 && enemy.shield.layers === 0) return { text: 'Shields down', tone: 'green' };
    return { text: 'Hostile', tone: 'red' };
  });
  const helmManned = $derived(!!me?.consoles.some((c) => c.kind === 'helm' && c.powered && c.operator !== null));
  const targetLabel = $derived(me?.target?.label ?? 'no target');

  // A new hostile ship starts as the ship-wide target (as the old panel did), and the camera frames both ships once.
  let autoAimed = 0;
  $effect(() => {
    if (me && enemy && enemy.state !== 'wreck' && !me.target && autoAimed !== enemy.ship) {
      autoAimed = enemy.ship;
      api.dispatch({ type: 'combat.setTarget', ship: me.ship, weaponId: null, targetShip: enemy.ship, targetModuleId: 0 });
    }
  });
  let framed = 0;
  $effect(() => {
    if (enemy && framed !== enemy.ship) { framed = enemy.ship; api.focusFight(enemy.ship); }
  });
  $effect(() => {
    api.setCombatMarks({ shipTarget: me?.target?.moduleId || undefined, overrides: me?.weapons.filter((w) => w.targetModuleId !== 0).map((w) => w.targetModuleId) ?? [], arming: aiming !== null });
  });

  const select = (id: number) => api.setAiming(aiming?.weapon === id ? null : { weapon: id });
  const flee = () => me && api.dispatch({ type: 'combat.flee', ship: me.ship });
  function onKey(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || !me) return;
    const k = e.key.toLowerCase();
    const n = Number(k);
    if (n >= 1 && n <= 4) { // in combat the number keys pick weapons (the speed buttons stay on the clock)
      const w = me.weapons[n - 1];
      if (w) select(w.id);
    } else if (k === 'v') api.dispatch({ type: 'combat.fireVolley', ship: me.ship });
    else if (k === 'h') api.dispatch({ type: 'combat.setHold', ship: me.ship, hold: !me.hold });
    else if (k === 'f') { if (me.ftl >= me.ftlMax) flee(); }
    else if (k === 'g') vent();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  onMount(() => {
    const un = api.aiming.subscribe((a) => (aiming = a));
    window.addEventListener('keydown', onKey, true);
    return () => { un(); window.removeEventListener('keydown', onKey, true); };
  });
  onDestroy(() => { clearInterval(timer); api.setAiming(null); });
</script>

<div class="hud" data-testid="combat-hud">
  {#if enemy}<div class="top"><EnemyCard {enemy} state={pill} /></div>{/if}
  {#if me}
    <div class="bot">
      <PlayerStrip {api} {me} {targetLabel} {aiming} {helmManned} onSelect={select} onFlee={flee} {heat} {oc} {ocLeft} onVent={vent} onOvercharge={overcharge} onFrame={() => api.focusFight(enemy?.ship ?? null)} />
    </div>
  {/if}
</div>

<style>
  .hud { position: fixed; inset: 0; z-index: 5; pointer-events: none; }
  .top { position: absolute; left: calc(8px + var(--sal)); top: calc(8px + var(--sat)); }
  .bot { position: absolute; left: 0; right: 0; bottom: calc(8px + var(--sab)); display: flex; justify-content: center; }
</style>
