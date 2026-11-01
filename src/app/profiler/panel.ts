import type { PerfApi } from './install';
import type { Profiler } from './profiler';

/** The F3 panel: frame budget bar, top 8 labels by self time, a spike graph and record/stop/reset. Plain DOM, debug only. */
export function mountPanel(profiler: Profiler, api: PerfApi): { destroy(): void } {
  const root = document.createElement('div');
  root.style.cssText = [
    'position:fixed', 'top:8px', 'right:8px', 'z-index:99999', 'width:300px', 'padding:8px',
    'background:var(--panel,rgba(6,14,24,.96))', 'border:1px solid var(--line-hi,#2a9cc4)', 'color:var(--text,#d8f0ff)',
    'font:11px/1.35 ui-monospace,Menlo,Consolas,monospace', 'pointer-events:auto',
  ].join(';');
  const cyan = 'var(--cyan,#36d4ff)';
  root.innerHTML = `
    <div style="color:${cyan};letter-spacing:.08em">PERF <span data-k="rec" style="color:var(--red,#ff5a5a)"></span></div>
    <div data-k="head" style="color:var(--dim,#7fa9c0);margin:2px 0 4px"></div>
    <div style="height:8px;background:var(--bg,#04080e);border:1px solid var(--line,#17506a)"><div data-k="bar" style="height:100%;width:0;background:${cyan}"></div></div>
    <canvas data-k="graph" width="284" height="40" style="display:block;margin:6px 0;width:284px;height:40px;background:var(--bg,#04080e)"></canvas>
    <pre data-k="rows" style="margin:0 0 6px;white-space:pre;overflow:hidden"></pre>
    <div style="display:flex;gap:6px"></div>`;
  const q = <T extends HTMLElement>(k: string): T => root.querySelector(`[data-k="${k}"]`) as T;
  const btnRow = root.lastElementChild as HTMLElement;
  const button = (text: string, on: () => void): void => {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = `flex:1;background:var(--bg,#04080e);color:${cyan};border:1px solid var(--line-hi,#2a9cc4);font:inherit;padding:2px 0;cursor:pointer`;
    b.onclick = on;
    btnRow.appendChild(b);
  };
  button('Record', () => api.startRecording());
  button('Stop', () => {
    api.stopRecording();
    console.info(api.report(12));
  });
  button('Reset', () => api.reset());
  document.body.appendChild(root);

  const draw = (): void => {
    const s = profiler.summary(8);
    const mean = s.work?.mean ?? 0;
    q('head').textContent = `work ${mean.toFixed(1)}ms / ${s.budgetMs.toFixed(1)}  over ${s.overBudget}/${s.frames}`;
    const bar = q('bar');
    bar.style.width = `${Math.min(100, (100 * mean) / s.budgetMs)}%`;
    bar.style.background = mean > s.budgetMs ? 'var(--red,#ff5a5a)' : mean > s.budgetMs * 0.7 ? 'var(--amber,#f0b13a)' : cyan;
    q('rec').textContent = profiler.recording ? '● REC' : '';
    q('rows').textContent = s.bySelf.map((r) => `${r.label.slice(0, 24).padEnd(24)} ${r.self.toFixed(1).padStart(7)} ${r.p95.toFixed(2).padStart(6)}`).join('\n');
    const g = q<HTMLCanvasElement>('graph').getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, 284, 40);
    const scale = 40 / (s.budgetMs * 2);
    g.strokeStyle = '#17506a';
    g.beginPath();
    g.moveTo(0, 40 - s.budgetMs * scale);
    g.lineTo(284, 40 - s.budgetMs * scale);
    g.stroke();
    profiler.history.forEach((ms, i) => {
      const h = Math.min(40, ms * scale);
      g.fillStyle = ms > s.budgetMs ? '#ff5a5a' : '#36d4ff';
      g.fillRect(i * 2.35, 40 - h, 2, h);
    });
  };
  const timer = setInterval(draw, 250);
  draw();
  return {
    destroy() {
      clearInterval(timer);
      root.remove();
    },
  };
}
