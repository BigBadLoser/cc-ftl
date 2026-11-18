import { presets } from './registry';
import type { ParamValues, ScenarioSpec } from './types';

/** A `?scenario=` start read from the URL: the preset, its declared params, and the flat overrides every preset takes. */
export interface ScenarioUrl {
  name: string;
  params: ParamValues;
  overrides: ScenarioSpec;
  extraHooks: string[];
  /** Ticks to run before the first frame, on top of what the preset does (`&ticks=`). */
  ticks: number;
  seed: number | null;
  starter: string | null;
}

/**
 * Parse `?scenario=<preset>[&<param>...][&seed=&starter=&credits=&items=id:n,id:n&speed=&ticks=&hooks=a,b]`. Preset params are parsed by their declared kind and
 * anything undeclared is ignored; the flat overrides become a partial spec. Returns null when no (known) preset is named. Full specs are only written in code.
 */
export function parseScenarioUrl(search: string | URLSearchParams): ScenarioUrl | null {
  const q = typeof search === 'string' ? new URLSearchParams(search) : search;
  const name = q.get('scenario');
  const preset = name === null ? undefined : presets.get(name);
  if (name === null || !preset) return null;
  const params: ParamValues = {};
  for (const [key, kind] of Object.entries(preset.params ?? {})) {
    if (!q.has(key)) continue;
    const raw = q.get(key) ?? '';
    if (kind.kind === 'flag') params[key] = raw !== 'false' && raw !== '0';
    else if (kind.kind === 'number') { const n = Number(raw); if (Number.isFinite(n)) params[key] = n; }
    else if (kind.kind === 'string') params[key] = raw;
    else if (kind.values.includes(raw)) params[key] = raw;
  }
  const overrides: Record<string, Record<string, unknown>> = {};
  const credits = q.get('credits');
  const give: Record<string, number> = {};
  for (const pair of (q.get('items') ?? '').split(',').filter(Boolean)) {
    const [id, n] = pair.split(':');
    if (id && Number.isFinite(Number(n ?? 1))) give[id.startsWith('item.') ? id : `item.${id}`] = Number(n ?? 1);
  }
  if ((credits !== null && Number.isFinite(Number(credits))) || Object.keys(give).length) {
    overrides['items'] = { ...(credits !== null && Number.isFinite(Number(credits)) ? { credits: Number(credits) } : {}), ...(Object.keys(give).length ? { give } : {}) };
  }
  const speed = Number(q.get('speed'));
  if (q.has('speed') && [0, 1, 2, 3].includes(speed)) overrides['ui'] = { speed };
  const seed = q.get('seed');
  return {
    name, params, overrides: overrides as ScenarioSpec, extraHooks: (q.get('hooks') ?? '').split(',').filter(Boolean),
    ticks: Math.max(0, Math.floor(Number(q.get('ticks')) || 0)),
    seed: seed !== null && Number.isFinite(Number(seed)) ? Number(seed) : null,
    starter: q.get('starter') ?? preset.starter ?? null,
  };
}
