<script lang="ts">
  import type { UiApi, UiCombat, UiShipCombat } from './api';
  import ShipMeters from './ShipMeters.svelte';

  type Me = NonNullable<UiCombat['player']>;
  let { api, me, enemy, picked }: { api: UiApi; me: Me; enemy: UiShipCombat | undefined; picked: number } = $props();

  const ready = $derived(me.weapons.some((w) => w.charge >= 1 && w.powered && !w.ion));
  const ftlPct = $derived(Math.min(100, Math.round((me.ftl / me.ftlMax) * 100)));
  const canFlee = $derived(me.ftl >= me.ftlMax && me.state === 'active');
  const warnings: Record<string, string> = {
    weapons: 'Unmanned: weapons will not fire',
    shields: 'Unmanned: shields recharge slowly',
    helm: 'Unmanned: no evasion, no escape',
  };

  const setHold = (hold: boolean) => api.dispatch({ type: 'combat.setHold', gridId: me.gridId, hold });
  const volley = () => api.dispatch({ type: 'combat.fireVolley', gridId: me.gridId });
  const flee = () => api.dispatch({ type: 'combat.flee', gridId: me.gridId });
  const aimWeapon = (weaponId: number, moduleId: number) => {
    if (enemy) api.dispatch({ type: 'combat.setTarget', shipGridId: me.gridId, weaponId, targetGridId: enemy.gridId, targetModuleId: moduleId });
  };
  const clearWeapon = (weaponId: number) =>
    api.dispatch({ type: 'combat.setTarget', shipGridId: me.gridId, weaponId, targetGridId: 0, targetModuleId: 0 });
  const pickedName = $derived(enemy?.modules.find((m) => m.id === picked)?.name ?? 'whole ship');
</script>

<div class="player" data-testid="combat-player">
  <ShipMeters ship={me} label={me.name} />

  <div class="fire">
    <button class:on={me.hold} aria-pressed={me.hold} data-testid="combat-hold" onclick={() => setHold(!me.hold)}>
      {me.hold ? 'Holding fire' : 'Hold fire'}
    </button>
    <button
      class="go"
      disabled={!ready}
      title={ready ? 'Fire every charged weapon now' : me.hold ? 'Waiting for a weapon to charge' : 'Hold fire to charge a volley: weapons otherwise fire as soon as they charge'}
      data-testid="combat-volley"
      onclick={volley}>Fire volley</button>
  </div>
  {#if !ready && !me.hold}<div class="hint" data-testid="combat-volley-hint">Hold fire to charge a volley</div>{/if}
  {#if me.target}<div class="tgt">Target: {me.target.label || 'whole ship'}</div>{/if}

  <div class="weapons" data-testid="combat-weapons">
    {#each me.weapons as w (w.id)}
      <div class="w" class:off={!w.powered}>
        <div class="line">
          <span class="nm">{w.name}</span>
          {#if w.ion}<span class="tag bad">ION</span>{/if}
          {#if !w.powered}<span class="tag bad">NO POWER</span>{/if}
          {#if w.ammo !== null}<span class="tag" class:bad={w.ammo === 0}>{w.ammo === 0 ? 'NO AMMO' : `x${w.ammo}`}</span>{/if}
        </div>
        <div class="bar" class:full={w.charge >= 1}><i style="width:{Math.round(w.charge * 100)}%"></i></div>
        <div class="line sub">
          <span class="to">{w.target ? `Aimed: ${w.target}` : 'Follows ship target'}</span>
          <button title="Aim this weapon at the module you tapped last" disabled={!enemy} onclick={() => aimWeapon(w.id, picked)}>Aim: {pickedName}</button>
          {#if w.target}<button aria-label="Follow the ship target" onclick={() => clearWeapon(w.id)}>↺</button>{/if}
        </div>
      </div>
    {/each}
    {#if me.weapons.length === 0}<p class="dim">No weapons installed.</p>{/if}
  </div>

  <div class="ftl">
    <span class="k">FTL</span>
    <span class="bar grow" class:full={canFlee}><i style="width:{ftlPct}%"></i></span>
    <button class="go" disabled={!canFlee} data-testid="combat-flee" onclick={flee}>Flee</button>
  </div>

  <div class="consoles" data-testid="combat-consoles">
    {#each me.consoles as c (c.id)}
      <div class="c" class:warn={!c.operator && c.kind !== 'shields'}>
        <span class="nm">{c.name}</span>
        {#if !c.powered}<span class="tag bad">NO POWER</span>
        {:else if c.operator}<span class="who">Manned by {c.operator}</span>
        {:else}<span class="who bad">{warnings[c.kind]}</span>{/if}
      </div>
    {/each}
    {#if me.consoles.length === 0}<p class="dim">No consoles installed.</p>{/if}
  </div>
</div>

<style>
  .player { display: grid; gap: 8px; }
  .fire { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .go { background: #0e4a56; border-color: var(--cyan); }
  .go:disabled { background: var(--panel-2); border-color: var(--line); }
  .tgt { font-size: 12px; color: var(--amber); }
  .hint { font-size: 11px; color: var(--dim, #8aa); }
  .weapons { display: grid; gap: 6px; }
  .w { padding: 6px 8px; background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; display: grid; gap: 4px; }
  .w.off { opacity: 0.6; }
  .line { display: flex; align-items: center; gap: 6px; }
  .nm { flex: 1; font-weight: 600; font-size: 13px; }
  .sub { font-size: 11px; color: var(--dim); }
  .sub button { min-height: 28px; min-width: 0; padding: 0 8px; font-size: 11px; }
  .to { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tag { font-size: 10px; padding: 1px 5px; border-radius: 4px; background: #0b1220; border: 1px solid var(--line); }
  .tag.bad, .bad { color: #ffb4b4; border-color: var(--red); }
  .bar.full > i { background: #7bf0a0; }
  .ftl { display: flex; align-items: center; gap: 8px; }
  .k { color: var(--dim); font-size: 12px; min-width: 52px; }
  .grow { flex: 1; }
  .consoles { display: grid; gap: 4px; }
  .c { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 4px 8px; border-radius: 6px; background: var(--panel-2); border: 1px solid transparent; flex-wrap: wrap; }
  .c.warn { border-color: var(--amber); }
  .who { color: var(--dim); }
  .who.bad { color: var(--amber); }
  .dim { color: var(--dim); margin: 0; font-size: 12px; }
</style>
