# Project instructions (paste into Project settings > Memory > Project instructions)

cc-ftl is a persistent isometric ship-colony game in the browser: Space Haven building plus FTL combat. The repo is
`bigbadloser/cc-ftl`. Every thread reads `CLAUDE.md`, `docs/HANDOFF.md` and `docs/STATUS.md` first. `CLAUDE.md`
holds the hard rules. This file covers how the user likes to work, which isn't in the code.

## Playtesting and deploys
- **Desktop only.** Don't spend work on phone layouts, touch input or phone screenshots unless the user asks.
- **Branches are playtested locally.** The user runs `git checkout <branch>` and `npm run dev`. Debug starts such as
  `?scenario=hullplan` help, so add one when a feature needs a specific setup to try.
- **There are no branch previews.** `main` is published to https://bigbadloser.github.io/cc-ftl/ by the manual
  "Deploy to GitHub Pages" workflow. Remind the user to run it after merges they want live.
- **Bug reports** come in as GitHub issues with the `bug` label, from the in-game Report a bug button. They carry the
  build commit, seed, turn and node, plus a save and a screenshot. Load the save to reproduce.

## How to talk to the user
- **Be short and direct.** No over-explaining, no recaps of what they already know. Lead with the answer.
- **Make only the changes asked for.** If something else looks wrong, say so; don't fix it unasked.
- **Recommend; don't just list options.** Put the decision to them when a choice is genuinely theirs: design,
  balance, look and feel, or lowering a test bar.
- **Send files as attachments.** The user often reads on mobile and can't open scratchpad paths, so send screenshots
  and prompts as attached files.
- **Report honestly.** Say exactly what was and wasn't run or verified: partial checks, unscreenshotted UI, tests
  not run against the old code.

## Visual work
- **Prototype first.** Build the smallest viewable version, take headless screenshots (default and zoomed), look at
  them yourself, send them, then stop. Finish and open the PR only after the user's go.
- **Expect several playtest rounds** on interactive tools. Send each round's notes back as one batch.
- **Style:** amber on true black (never a dark amber that reads as brown), with Tabler icons. The existing in-game UI is
  cyan on navy, so match what's there.
- **Final game art comes from the Blender pipeline.** Procedural drawing is only for debug views, overlays and
  placeholders.

## Process
- **Every piece of work gets a GitHub issue.** PRs say `Closes #N` or `Part of #N`, and commits say `Refs #N`.
- **Testing round before every PR:**
  1. Merge `main` in.
  2. Run the full `npm run check` on the final head, writing output to a file ending in `echo EXIT $?`. Don't pipe it
     through `tail`, which hides the exit code.
  3. Paste the result into the PR body.

  A fix pushed after the check needs the check rerun. There is no `full-ci` label any more.
- **Batch pushes to open PRs,** because CI minutes cost money.
- **Review bots:**
  - Codex reviews every PR. Treat each finding as a claim: verify it, fix real ones with a test, then reply on the
    thread naming the commit and resolve it.
  - Pushes that echo your own replies need no action.
- **Only the user merges.** Docs-only changes (`*.md`) go straight to `main`.

## Tests and determinism
- **Never cherry-pick seeds** to make a test pass. Test over a fixed seed range in aggregate. If a test failed after a
  content change, find out why first; that's usually a design question for the user.
- **Never repin a `sectorEquiv`, `tickEquiv` or `envSkip` hash** to hide an unexplained diff. A real generator change
  is explained in the commit message.
- **Never weaken a threshold or raise a timeout** without the user's call. Slow tests should be small, not given
  longer limits.

## Orchestrating agents
- **Defaults:** brief Sonnet subagents with self-contained prompts, each in its own git worktree, and keep one agent
  per piece of work so its context carries over rounds.
- **Background waits:**
  - One wait per run.
  - Never `while pgrep -f ...`: it matches its own command line and never ends.
  - Stop superseded waits and dev servers by PID.
- **Save before a restart.** After a container restart, commit uncommitted work as a WIP commit, push, then resume the
  agents.
- **Never use bare `git stash`;** the stash is shared across worktrees.
- **Parallel PRs that both bump `SAVE_VERSION`:** the second to merge bumps again.

## Other rules
- Reference repos such as `bigbadloser/space-web-game` are design reference only. Never port code from them.
- No save migrations while this is a prototype: bump `SAVE_VERSION` instead.
- Terminology:
  - a **node** is one playable grid;
  - a **sector** is a group of nodes;
  - **hyperlanes** link sectors.

  Older code says "sector" for a node.
