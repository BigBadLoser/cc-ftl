<script lang="ts">
  /**
   * Report a bug: a title and two text boxes, the auto-collected context (collapsible), and two actions. "Open issue" opens a
   * pre-filled GitHub new-issue page in a new tab; "Download save + screenshot" saves two files to drag into that issue.
   * The game is paused while this is open (App restores the speed on close).
   */
  import type { UiApi } from './api';
  import Icon from './Icon.svelte';
  import { Dialog } from './kit';

  let { api, onClose }: { api: UiApi; onClose: () => void } = $props();

  let title = $state('');
  let what = $state('');
  let expected = $state('');
  let showContext = $state(false);
  let note = $state('');
  const context = $derived(showContext ? api.bugReport.context() : '');
  const ready = $derived(title.trim().length > 0 && what.trim().length > 0);

  function openIssue() {
    const { url, trimmed } = api.bugReport.issue({ title, what, expected });
    window.open(url, '_blank', 'noopener');
    note = trimmed ? 'Opened. Some of the error details were trimmed to fit the link.' : 'Opened in a new tab.';
  }

  function download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  async function files() {
    const p = (n: number) => String(n).padStart(2, '0');
    const d = new Date();
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    try {
      const shot = await api.bugReport.screenshot();
      download(new Blob([api.bugReport.saveJson()], { type: 'application/json' }), `cc-ftl-save-${stamp}.json`);
      if (shot) setTimeout(() => download(shot, `cc-ftl-shot-${stamp}.png`), 300);
      note = shot ? 'Saved two files. Drag them into the issue.' : 'Saved the save file; the screenshot failed.';
    } catch {
      note = 'Download failed.';
    }
  }
</script>

<Dialog open onOpenChange={(o) => { if (!o) onClose(); }} title="Report a bug" testId="bug-report">
  <div class="form">
    <p class="hint">Reports go to the project's GitHub issues (needs a GitHub account). The game is paused while this is open.</p>
    <label>Title
      <input type="text" bind:value={title} maxlength="120" placeholder="Short summary" data-testid="bug-title" />
    </label>
    <label>What happened?
      <textarea bind:value={what} rows="4" placeholder="What went wrong, and what were you doing?" data-testid="bug-what"></textarea>
    </label>
    <label>What did you expect? <small>(optional)</small>
      <textarea bind:value={expected} rows="2" data-testid="bug-expected"></textarea>
    </label>
    <button type="button" class="fold" aria-expanded={showContext} data-testid="bug-context-toggle" onclick={() => (showContext = !showContext)}>
      <span class="chev" class:open={showContext}><Icon name="chevDown" size={14} /></span> Included automatically: build, seed, turn, browser, recent errors
    </button>
    {#if showContext}<pre class="ctx" data-testid="bug-context">{context}</pre>{/if}
    <div class="actions">
      <button type="button" class="primary" disabled={!ready} title={ready ? '' : 'Add a title and say what happened'} data-testid="bug-open" onclick={openIssue}><Icon name="debug" size={16} /> Open issue</button>
      <button type="button" data-testid="bug-download" onclick={files}><Icon name="download" size={16} /> Download save + screenshot</button>
      <button type="button" data-testid="bug-close" onclick={onClose}>Close</button>
    </div>
    {#if note}<p class="note" role="status">{note}</p>{/if}
  </div>
</Dialog>

<style>
  .form { display: grid; gap: 10px; }
  .hint, .note { margin: 0; font-size: 12px; color: var(--dim); }
  .note { color: var(--amber); }
  label { display: grid; gap: 3px; font: 600 12px var(--head-font); letter-spacing: 0.05em; text-transform: uppercase; color: var(--dim); }
  label small { font-weight: 400; color: var(--dim); text-transform: none; letter-spacing: 0; }
  input, textarea { box-sizing: border-box; width: 100%; background: var(--bg); color: var(--text); border: 1px solid var(--line-hi); border-radius: 0; padding: 6px 8px; font: 14px/1.4 system-ui, sans-serif; text-transform: none; letter-spacing: 0; user-select: text; -webkit-user-select: text; resize: vertical; }
  input::placeholder, textarea::placeholder { color: var(--dim); opacity: 1; }
  input:focus, textarea:focus { outline: none; border-color: var(--cyan); }
  .fold { display: flex; align-items: center; gap: 6px; min-height: 28px; padding: 0 6px; font-size: 12px; color: var(--dim); background: transparent; border-color: transparent; text-align: left; }
  .chev { display: inline-flex; transition: transform 0.12s; transform: rotate(-90deg); }
  .chev.open { transform: none; }
  .ctx { margin: 0; max-height: 220px; overflow: auto; padding: 8px; background: #000; border: 1px solid var(--line); color: var(--dim); font: 11px/1.4 ui-monospace, monospace; white-space: pre-wrap; word-break: break-word; user-select: text; -webkit-user-select: text; }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; }
  .actions button { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; }
  .actions .primary { color: var(--amber); border-color: var(--amber); }
  .actions .primary:disabled { color: var(--dim); border-color: var(--line); }
</style>
