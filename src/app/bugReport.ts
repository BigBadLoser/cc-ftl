/** The bug report: the markdown context and the pre-filled GitHub new-issue URL. Pure; the browser facts are gathered by the caller. */

export const ISSUE_URL = 'https://github.com/BigBadLoser/cc-ftl/issues/new';
/** Browsers and GitHub choke on very long URLs; stay well under. */
export const MAX_URL = 7000;

export interface ReportError {
  message: string;
  stack: string;
}

export interface ReportInfo {
  commit: string;
  url: string;
  seed: number;
  turn: number;
  node: string;
  saveVersion: number;
  userAgent: string;
  viewport: { w: number; h: number };
  dpr: number;
  gpu: string | null;
  /** Newest first. */
  errors: ReportError[];
}

export interface ReportDraft {
  title: string;
  what: string;
  expected: string;
}

/** Trimming knobs for `buildContext`: how many errors to list and how many characters of each stack to keep. */
export interface ContextLimits {
  errors: number;
  stack: number;
}

export const FULL_LIMITS: ContextLimits = { errors: 10, stack: 600 };

const TITLE_MAX = 200;

/** Cut to at most `n` UTF-16 units, never inside a surrogate pair (a lone surrogate makes `encodeURIComponent` throw). */
function clip(s: string, n: number): string {
  if (s.length <= n) return s;
  let end = Math.max(0, n - 1);
  const c = s.charCodeAt(end - 1);
  if (end > 0 && c >= 0xd800 && c <= 0xdbff) end--; // the cut would split a pair: step back
  return `${s.slice(0, end)}…`;
}

/** `encodeURIComponent`, but a lone surrogate already in the text becomes U+FFFD instead of throwing. */
function enc(s: string): string {
  try {
    return encodeURIComponent(s);
  } catch {
    return encodeURIComponent(s.replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, '\ufffd'));
  }
}

/** The auto-collected context as markdown (the "Context" section of the issue body). */
export function buildContext(info: ReportInfo, limits: ContextLimits = FULL_LIMITS): string {
  let params = '';
  try {
    params = [...new URL(info.url).searchParams].map(([k, v]) => (v ? `${k}=${v}` : k)).join(', ');
  } catch {
    /* not a URL: leave the params out */
  }
  const lines = [
    '### Context',
    `- Build: \`${info.commit}\``,
    `- Page: ${info.url}`,
    `- URL params: ${params || 'none'}`,
    `- Seed: ${info.seed}`,
    `- Turn: ${info.turn}`,
    `- Node: \`${info.node}\``,
    `- Save version: ${info.saveVersion}`,
    `- Browser: ${info.userAgent}`,
    `- Viewport: ${info.viewport.w}x${info.viewport.h} @ ${info.dpr}x`,
    `- GPU: ${info.gpu ?? 'unknown'}`,
  ];
  const errs = info.errors.slice(0, limits.errors);
  lines.push('', `### Recent errors (${errs.length}${errs.length < info.errors.length ? ` of ${info.errors.length}` : ''})`);
  if (!errs.length) lines.push('None.');
  for (const e of errs) {
    lines.push(`- ${clip(e.message.replace(/\s+/g, ' '), 300)}`);
    const stack = e.stack.trim();
    if (stack && limits.stack > 0) lines.push('  ```', ...clip(stack, limits.stack).split('\n').map((l) => `  ${l}`), '  ```');
  }
  lines.push('', '**Please drag the downloaded save and screenshot files into this issue.**');
  return lines.join('\n');
}

export function buildBody(draft: ReportDraft, context: string): string {
  const parts = ['### What happened?', draft.what.trim() || '_(not filled in)_'];
  if (draft.expected.trim()) parts.push('', '### What did you expect?', draft.expected.trim());
  parts.push('', context);
  return parts.join('\n');
}

export function issueUrl(title: string, body: string): string {
  return `${ISSUE_URL}?title=${enc(clip(title.trim(), TITLE_MAX))}&body=${enc(body)}&labels=bug`;
}

/**
 * The pre-filled new-issue URL, kept under `max` characters. Trimming order: the error list down to 3 entries, then stack
 * traces shortened, then the errors dropped altogether, and only as a last resort the reporter's own text cut.
 */
export function buildIssueUrl(draft: ReportDraft, info: ReportInfo, max = MAX_URL): { url: string; body: string; trimmed: boolean } {
  const steps: ContextLimits[] = [
    FULL_LIMITS,
    { errors: 5, stack: 600 },
    { errors: 3, stack: 600 },
    { errors: 3, stack: 300 },
    { errors: 3, stack: 100 },
    { errors: 3, stack: 0 },
    { errors: 1, stack: 0 },
    { errors: 0, stack: 0 },
  ];
  const make = (d: ReportDraft, l: ContextLimits) => {
    const body = buildBody(d, buildContext(info, l));
    return { body, url: issueUrl(d.title, body) };
  };
  for (const [i, limits] of steps.entries()) {
    const r = make(draft, limits);
    if (r.url.length <= max) return { ...r, trimmed: i > 0 };
  }
  // Still too long: cut the reporter's text, longest first, until it fits (encoding can triple a character's length).
  const last = steps[steps.length - 1] as ContextLimits;
  let d = { ...draft };
  for (let i = 0; i < 60; i++) {
    const r = make(d, last);
    if (r.url.length <= max) return { ...r, trimmed: true };
    const key: 'what' | 'expected' = d.what.length >= d.expected.length ? 'what' : 'expected';
    const over = r.url.length - max;
    d = { ...d, [key]: clip(d[key], Math.max(0, d[key].length - Math.ceil(over / 3) - 1)) };
  }
  const r = make({ title: draft.title, what: '', expected: '' }, last);
  return { ...r, trimmed: true };
}

/** `cc-ftl-save-<stamp>` style names share one timestamp so the two files pair up. */
export function reportFileNames(at: Date): { save: string; shot: string } {
  const p = (n: number) => String(n).padStart(2, '0');
  const stamp = `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}`;
  return { save: `cc-ftl-save-${stamp}.json`, shot: `cc-ftl-shot-${stamp}.png` };
}
