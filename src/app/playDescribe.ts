import type { PlayState } from './playState';

const list = (xs: string[], none = 'none') => (xs.length ? xs.join('; ') : none);

/** A few plain-English lines for a model that cannot see the screen. Built from the same data as `state()`, so it says nothing the player cannot see. */
export function describeState(s: PlayState): string {
  const out: string[] = [];
  const time = `t=${s.t}s ${s.paused ? 'paused' : `running at speed ${s.speed}`}`;
  out.push(`${time}. Screen: ${s.screen}${s.dialog ? ` (dialog: ${s.dialog})` : ''}.`);
  if (s.screen === 'gameover') out.push('The game is over.');
  if (s.decision) {
    out.push(`DECISION "${s.decision.title}": ${s.decision.text}`);
    out.push(`Choices: ${list(s.decision.choices.map((c) => `${c.label}${c.enabled ? '' : ' (unavailable)'}`))}.`);
  }
  if (s.travel) out.push(`Travelling ${s.travel.from} to ${s.travel.to} (${s.travel.phase}, ${s.travel.hopsLeft} hops left).`);
  const sh = s.ship;
  const ftl = sh.ftl ? `FTL ${sh.ftl.state} ${sh.ftl.charge}/${sh.ftl.max}${sh.ftl.blocker ? ` (blocked: ${sh.ftl.blocker})` : ''}` : 'no FTL';
  out.push(`Ship ${sh.name}: hull ${sh.hull}%, shields ${sh.shields.layers}/${sh.shields.max}, power ${sh.power.supply}/${sh.power.demand}, credits ${sh.credits}${sh.fuel === null ? '' : `, fuel ${sh.fuel}`}, food ${sh.food.units}${sh.food.hoursLeft === null ? '' : ` (${sh.food.hoursLeft}h)`}, ${ftl}.`);
  if (s.modules.length) out.push(`Module trouble: ${list(s.modules.map((m) => `${m.name} ${m.hp} ${m.status}`))}.`);
  if (s.weapons.length) out.push(`Weapons: ${list(s.weapons.map((w) => `${w.name} ${w.charge}%${w.powered ? '' : ' unpowered'}${w.target ? ` at ${w.target}` : ''}`))}.`);
  for (const e of s.enemies) {
    out.push(`${e.hostile ? 'Hostile' : 'Nearby'} ${e.name} (${e.faction}, ${e.state}): hull ${e.hull}%, shields ${e.shields}${e.weapons.length ? `, guns ${e.weapons.map((w) => `${w.charge}%${w.eta === null ? '' : ` hits in ${w.eta}s`}`).join(', ')}` : ''}.`);
  }
  if (s.incoming.length) out.push(`Incoming fire: ${list(s.incoming.map((i) => `${i.name} in ${i.eta}s`))}.`);
  out.push(`Crew: ${list(s.crew.map((c) => `${c.name} (${c.role}, hp ${c.hp}, ${c.where}, ${c.doing}${c.flags.length ? `, ${c.flags.join('/')}` : ''})`))}.`);
  if (s.boarders.length) out.push(`Boarders aboard: ${list(s.boarders.map((b) => `${b.name} at ${b.where}`))}.`);
  if (s.alerts.length) out.push(`Alerts: ${list(s.alerts.map((a) => a.text))}.`);
  if (s.goals?.todo.length) out.push(`Goal (${s.goals.act}): ${s.goals.todo[0]}`);
  return out.join('\n');
}
