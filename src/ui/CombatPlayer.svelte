<script lang="ts">
  import type { UiApi, UiCombat, UiShipCombat } from './api';
  import Icon from './Icon.svelte';
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

  const setHold = (hold: boolean) => api.dispatch({ type: 'combat.setHold', ship: me.ship, hold });
  const volley = () => api.dispatch({ type: 'combat.fireVolley', ship: me.ship });
  const flee = () => api.dispatch({ type: 'combat.flee', ship: me.ship });
  const aimWeapon = (weaponId: number, moduleId: number) => {
    if (enemy) api.dispatch({ type: 'combat.setTarget', ship: me.ship, weaponId, targetShip: enemy.ship, targetModuleId: moduleId });
  };
  const clearWeapon = (weaponId: number) =>
    api.dispatch({ type: 'combat.setTarget', ship: me.ship, weaponId, targetShip: 0, targetModuleId: 0 });
  const pickedName = $derived(enemy?.modules.find((m) => m.id === picked)?.name ?? 'whole ship');
  const volleyTitle = $derived(ready ? 'Fire volley: every charged weapon now' : me.hold ? 'Fire volley: waiting for a weapon to charge' : 'Fire volley: hold fire to charge one, weapons otherwise fire as soon as they charge');
</script>

<div class="player" data-testid="combat-player">
  <ShipMeters ship={me} label={me.name} compact />

  <div class="fire">
    <button class="tile" class:on={me.hold} aria-pressed={me.hold} title={me.hold ? 'Holding fire: tap to let weapons fire' : 'Hold fire'} aria-label={me.hold ? 'Holding fire' : 'Hold fire'} data-testid="combat-hold" onclick={() => setHold(!me.hold)}><Icon name="hold" size={20} /></button>
    <button class="tile go" disabled={!ready} title={volleyTitle} aria-label="Fire volley" data-testid="combat-volley" onclick={volley}><Icon name="volley" size={20} /></button>
    <div class="info">
      {#if me.target}<span class="tgt" title="Ship-wide target"><Icon name="target" size={14} />{me.target.label || 'whole ship'}</span>{/if}
      {#if !ready && !me.hold}<span class="hint" data-testid="combat-volley-hint">Hold fire to charge a volley</span>{/if}
    </div>
    <span class="ftl" class:full={canFlee} title="FTL charge: full means you can flee">
      <Icon name="fast" size={16} />
      <span class="bar"><i style="width:{ftlPct}%"></i></span>
      <button class="tile go" disabled={!canFlee} title="Flee: jump away" aria-label="Flee" data-testid="combat-flee" onclick={flee}><Icon name="ship" size={18} /></button>
    </span>
  </div>

  <div class="weapons" data-testid="combat-weapons">
    {#each me.weapons as w (w.id)}
      <div class="w" class:off={!w.powered}>
        <span class="ic"><Icon name="combat" size={16} /></span>
        <div class="mid">
          <div class="line">
            <span class="nm">{w.name}</span>
            {#if w.ion}<span class="tag bad">ION</span>{/if}
            {#if !w.powered}<span class="tag bad">NO POWER</span>{/if}
            {#if w.ammo !== null}<span class="tag" class:bad={w.ammo === 0}>{w.ammo === 0 ? 'NO AMMO' : `x${w.ammo}`}</span>{/if}
          </div>
          <div class="bar" class:full={w.charge >= 1}><i style="width:{Math.round(w.charge * 100)}%"></i></div>
          <div class="to" title={w.target ? `Aimed: ${w.target}` : 'Follows ship target'}>{w.target ? `Aimed: ${w.target}` : 'Follows ship target'}</div>
        </div>
        {#if w.target}<button class="tile sm" title="Follow the ship target" aria-label="Follow the ship target" onclick={() => clearWeapon(w.id)}><Icon name="rotate" size={16} /></button>{/if}
        <button class="tile sm" title="Aim this weapon at: {pickedName} (the module you tapped last)" aria-label="Aim at {pickedName}" disabled={!enemy} onclick={() => aimWeapon(w.id, picked)}><Icon name="target" size={16} /></button>
      </div>
    {/each}
    {#if me.weapons.length === 0}<p class="dim">No weapons installed.</p>{/if}
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
  .fire { display: flex; align-items: center; gap: 4px; }
  .fire .tile { flex: none; }
  .go:not(:disabled) { background: #0e4a56; border-color: var(--cyan); }
  .info { flex: 1; min-width: 0; display: grid; font-size: 12px; padding: 0 4px; }
  .tgt { display: inline-flex; align-items: center; gap: 4px; color: var(--amber); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hint { font-size: 11px; color: var(--dim); }
  .ftl { display: inline-flex; align-items: center; gap: 6px; color: var(--cyan); }
  .ftl .bar { width: 44px; }
  .ftl.full .bar > i { background: var(--green); }
  .weapons { display: grid; gap: 4px; }
  .w { display: flex; align-items: center; gap: 6px; padding: 4px 4px 4px 8px; background: var(--panel-2); border: 1px solid var(--line); }
  .w.off { opacity: 0.6; }
  .ic { display: inline-flex; color: var(--red); }
  .mid { flex: 1; min-width: 0; display: grid; gap: 3px; }
  .line { display: flex; align-items: center; gap: 6px; }
  .nm { font: 600 14px/1.2 var(--head-font); letter-spacing: 0.03em; flex: 1; min-width: 0; }
  .to { font-size: 11px; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  button.tile.sm { width: 32px; height: 32px; }
  .tag { font-size: 10px; padding: 0 5px; background: #0b1220; border: 1px solid var(--line); }
  .tag.bad, .bad { color: #ffb4b4; border-color: var(--red); }
  .bar.full > i { background: var(--green); }
  .consoles { display: grid; gap: 3px; }
  .c { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 3px 8px; background: var(--panel-2); border: 1px solid transparent; flex-wrap: wrap; }
  .c .nm { font-size: 13px; flex: none; }
  .c.warn { border-color: var(--amber); }
  .who { color: var(--dim); }
  .who.bad { color: var(--amber); border: 0; }
  .dim { color: var(--dim); margin: 0; font-size: 12px; }
</style>
