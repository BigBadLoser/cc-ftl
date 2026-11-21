/* global process, console, fetch */
// Score a local LLM as the judge of duplicate pairs: for each bench case it reads the original function and the planted
// code and answers whether they answer the same question. Dups should get YES, lookalikes NO.
//   JUDGE_URL=http://127.0.0.1:11434 JUDGE_MODELS=qwen2.5-coder:1.5b,qwen2.5-coder:3b node tools/dupBench/judge.mjs [--out f.json]
// The server is Ollama's native API (/api/chat), or with JUDGE_API=openai any OpenAI-compatible /v1/chat/completions (the
// RKLLM NPU server on the agent-harness host). Nothing here is part of the game or CI.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { functionRange, loadCases, REPO } from './tree.mjs';

const URL = process.env.JUDGE_URL ?? 'http://127.0.0.1:11434';
const OPENAI = process.env.JUDGE_API === 'openai';
const MODELS = (process.env.JUDGE_MODELS ?? 'qwen2.5-coder:1.5b').split(',').filter(Boolean);
const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;

export const PROMPT = `You review a TypeScript game codebase for duplicated logic. The rule: each question the game asks
(is this tile walkable, can this crew member do this job, which food is nearest) has exactly one function that answers it.
Below are two pieces of code. Answer YES if they answer the same question, so one could replace the other (names, structure
and style may differ). Answer NO if they compute something different, even when they look alike.
Reply with one word: YES or NO.`;

const lines = (file, from, to) => readFileSync(file, 'utf8').split('\n').slice(from - 1, to).join('\n');
/** The planted copy without its import lines: helpers it extracted stay, since they are part of the copy. */
const plantedCode = (c) =>
  readFileSync(join(REPO, 'tools/dupBench/cases', c.id, 'planted.ts.txt'), 'utf8')
    .split('\n')
    .filter((l) => !/^\s*import\s/.test(l))
    .join('\n')
    .trim();

export function pairText(c) {
  const file = join(REPO, c.original.file);
  const r = functionRange(file, c.original.fn);
  return { a: lines(file, r.start, r.end), b: plantedCode(c) };
}

async function ask(model, a, b) {
  const t0 = Date.now();
  const sampling = OPENAI ? { temperature: 0, max_tokens: 3 } : { options: { temperature: 0, num_predict: 3 } };
  const res = await fetch(OPENAI ? `${URL}/v1/chat/completions` : `${URL}/api/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      ...sampling,
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: `First:\n\`\`\`ts\n${a}\n\`\`\`\n\nSecond:\n\`\`\`ts\n${b}\n\`\`\`\n\nSame question? YES or NO.` },
      ],
    }),
  });
  const body = await res.json();
  const text = (OPENAI ? body.choices?.[0]?.message?.content : body.message?.content) ?? '';
  return { yes: /^\W*yes/i.test(text), raw: text.trim(), seconds: (Date.now() - t0) / 1000 };
}

const cases = loadCases();
const results = {};
for (const model of MODELS) {
  const rows = [];
  for (const c of cases) {
    const { a, b } = pairText(c);
    const r = await ask(model, a, b);
    rows.push({ id: c.id, level: c.level, dup: c.label === 'dup', ...r });
    process.stderr.write(`${model} ${c.id}: ${r.raw} (${r.seconds.toFixed(1)}s)\n`);
  }
  results[model] = rows;
}

const frac = (rows) => `${rows.filter((r) => r.yes).length}/${rows.length}`;
console.log('| judge | YES on rename | YES on restructure | YES on rewrite | YES on lookalike (wrong) | s/pair |');
console.log('|---|---|---|---|---|---|');
for (const [model, rows] of Object.entries(results)) {
  const at = (level) => frac(rows.filter((r) => r.level === level));
  const secs = rows.reduce((s, r) => s + r.seconds, 0) / rows.length;
  console.log(`| ${model} | ${at('rename')} | ${at('restructure')} | ${at('rewrite')} | ${at('lookalike')} | ${secs.toFixed(1)} |`);
}
if (out) writeFileSync(out, JSON.stringify(results, null, 2));
