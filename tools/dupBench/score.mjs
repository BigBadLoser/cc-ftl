// Matching and reporting. A case is a hit when reported pairs cover the original function on one side and the planted code on the
// other: at least COVER of the original's lines, and of the smaller of (original, planted code span) on the planted side.
export const COVER = 0.3;
export const LEVELS = ['rename', 'restructure', 'rewrite'];

const span = (r) => r.end - r.start + 1;

function overlapLines(set, r, a) {
  const lo = Math.max(r.start, a.start), hi = Math.min(r.end, a.end);
  for (let l = lo; l <= hi; l++) set.add(l);
}

/** Coverage of one case by a pair list: { hit, cover, score } (score = best score among the pairs that touch both sides). */
export function matchCase(pairs, ranges, minScore = 0) {
  const { original: o, planted: p } = ranges;
  const origLines = new Set(), plantedLines = new Set();
  let score = null;
  for (const pair of pairs) {
    if (pair.score !== undefined && pair.score < minScore) continue;
    for (const [x, y] of [[pair.a, pair.b], [pair.b, pair.a]]) {
      if (x.file !== o.file || y.file !== p.file) continue;
      const before = origLines.size + plantedLines.size;
      overlapLines(origLines, o, x);
      overlapLines(plantedLines, p, y);
      if (origLines.size + plantedLines.size > before || (x.end >= o.start && x.start <= o.end && y.end >= p.start && y.start <= p.end)) {
        if (pair.score !== undefined) score = Math.max(score ?? 0, pair.score);
      }
    }
  }
  const cover = Math.min(origLines.size / span(o), plantedLines.size / Math.min(span(o), span(p)));
  return { hit: cover >= COVER, cover: Math.round(cover * 100) / 100, score };
}

/** Cut a detector's pairs at one setting: for a sweep, the pairs scoring at least `cut`. */
export const cutPairs = (pairs, cut) => (cut === undefined ? pairs : pairs.filter((x) => x.score === undefined || x.score >= cut));

/** One result row for a detector setting. `plans` maps case id to ranges for the tree the detector ran on. */
export function scoreSetting({ id, cut, planted, clean, cases, ranges }) {
  const hits = {};
  for (const c of cases) hits[c.id] = matchCase(cutPairs(planted.byLevel?.[c.level] ?? planted.pairs, cut), ranges.get(c.id));
  const count = (level, wantHit = true) => cases.filter((c) => c.level === level && hits[c.id].hit === wantHit).length;
  const total = (level) => cases.filter((c) => c.level === level).length;
  return {
    id: cut === undefined ? id : `${id}@${cut}`,
    recall: Object.fromEntries(LEVELS.map((l) => [l, `${count(l)}/${total(l)}`])),
    falsePositives: `${count('lookalike')}/${total('lookalike')}`,
    noise: cutPairs(clean.pairs, cut).length,
    seconds: Math.round(planted.seconds * 10) / 10,
    hits,
  };
}

const cell = (h) => (h.hit ? `Y${h.score != null ? ` ${h.score.toFixed(2)}` : ''}` : h.cover > 0 ? `(${Math.round(h.cover * 100)}%)` : '.');

/** Markdown: the summary table, then the case x setting matrix. */
export function markdown(rows, cases, skipped = []) {
  const out = [];
  out.push('| detector | rename | restructure | rewrite | lookalike FP | noise (clean src) | seconds |', '|---|---|---|---|---|---|---|');
  for (const r of rows) out.push(`| ${r.id} | ${LEVELS.map((l) => r.recall[l]).join(' | ')} | ${r.falsePositives} | ${r.noise} | ${r.seconds} |`);
  for (const s of skipped) out.push(`| ${s.id} | skipped: ${s.skipped} | | | | | |`);
  out.push('', `Hit = pairs cover at least ${COVER * 100}% of the original function and of the planted code. Cells: \`Y score\` hit, \`(n%)\` partial cover below the cutoff, \`.\` nothing.`, '');
  out.push(`| case | label | ${rows.map((r) => r.id).join(' | ')} |`, `|---|---|${rows.map(() => '---').join('|')}|`);
  for (const c of cases) out.push(`| ${c.id} | ${c.label} | ${rows.map((r) => cell(r.hits[c.id])).join(' | ')} |`);
  return out.join('\n');
}
