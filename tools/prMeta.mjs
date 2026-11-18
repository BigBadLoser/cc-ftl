#!/usr/bin/env node
/* global process, console */
// PR process checks (CLAUDE.md "Workflow"), run by .github/workflows/pr-meta.yml with no install.
//   PR_BODY, PR_BRANCH, PR_BASE in the environment; the commits are read with `git log origin/$PR_BASE..HEAD`.
// Fails (exit 1, one message per problem saying what to change) when: the body links no issue; the branch has no known prefix;
// a commit message or the body names a model. The pure functions are exported for tools/prMeta.test.ts.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const BRANCH_PREFIXES = ['feat/', 'fix/', 'art/', 'tools/', 'docs/', 'test/', 'perf/', 'refactor/', 'chore/', 'dependabot/'];
export const MODEL_WORDS = ['claude', 'opus', 'sonnet', 'haiku', 'fable', 'gpt', 'chatgpt', 'deepseek', 'mimo', 'gemini', 'llama', 'qwen'];
// Whole words only, not part of a path or host (`.claude/`, `claude.ai/...`). Codex is the review bot the workflow names: not listed.
// "Claude Code" is the tool, not a model: the GitHub connector appends a "Generated with Claude Code" footer that a session
// cannot always remove, so the tool's name is allowed. A model name after it ("Claude Code with Opus") still counts.
const MODEL = new RegExp(`(?<![\\w./])(${MODEL_WORDS.join('|')})(?![\\w/]|\\.\\w)(?!\\s+code\\b)`, 'gi');
const ISSUE = /\b(closes|fixes|part of|refs)\s+(?:[\w.-]+\/[\w.-]+)?#\d+/i;

/** Every model name in `text` (lower case, in order). */
export const modelNames = (text) => [...(text ?? '').matchAll(MODEL)].map((m) => m[1].toLowerCase());

export const checkBody = (body) => {
  const out = [];
  if (!ISSUE.test(body ?? '')) out.push('PR body links no issue: add `Closes #N` (finishes it) or `Part of #N` (does not); `Fixes` and `Refs` also count. Every PR links its issue (create one if none exists).');
  const names = modelNames(body);
  if (names.length) out.push(`PR body names a model (${[...new Set(names)].join(', ')}): remove it (a "Generated with Claude Code" footer is fine; a model or session link is not).`);
  return out;
};

export const checkBranch = (branch) =>
  BRANCH_PREFIXES.some((p) => (branch ?? '').startsWith(p))
    ? []
    : [`Branch "${branch}" has no known prefix: rename it to start with one of ${BRANCH_PREFIXES.filter((p) => p !== 'dependabot/').join(' ')} (e.g. feat/asteroid-variety-505).`];

/** `messages`: one full commit message per entry, `shas` parallel to it for the report. */
export const checkCommits = (messages, shas = []) =>
  messages.flatMap((m, i) => {
    const names = modelNames(m);
    return names.length ? [`Commit ${(shas[i] ?? `#${i + 1}`).slice(0, 9)} names a model (${[...new Set(names)].join(', ')}): reword it and drop any Co-Authored-By or session trailer (commit messages carry no attribution). Amend it before pushing; a pushed commit is reworded only with the user's go-ahead, since that rewrites the branch.`] : [];
  });

export const checkAll = ({ body, branch, messages, shas }) => {
  if ((branch ?? '').startsWith('dependabot/')) return [];
  return [...checkBranch(branch), ...checkBody(body), ...checkCommits(messages, shas)];
};

const commits = (base) => {
  const raw = execFileSync('git', ['log', '--no-merges', '--format=%H%x1f%B%x1e', `origin/${base}..HEAD`], { encoding: 'utf8' });
  const rows = raw.split('\x1e').map((r) => r.trim()).filter(Boolean).map((r) => r.split('\x1f'));
  return { shas: rows.map((r) => r[0]), messages: rows.map((r) => r[1] ?? '') };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { PR_BODY, PR_BRANCH, PR_BASE = 'main' } = process.env;
  const problems = checkAll({ body: PR_BODY, branch: PR_BRANCH, ...commits(PR_BASE) });
  for (const p of problems) console.error(`pr-meta: ${p}`);
  if (problems.length) process.exit(1);
  console.log('pr-meta: ok');
}
