# Workbench experiment (not wired into the pipeline)

`wb.py` replaces `core.render` with Blender Workbench passes (matcap carrying the same sun + ambient numbers as Cycles, a flat
emission pass, an id pass standing in for holdouts), so `env_build`/`human_render`/`post` run unchanged on top.
`compare.py` (env/walls/weapons sprites) and `crew_compare.py` (a crew frame, plus a sit frame with the chair holdout) render the
same things in both engines. Needs EGL: `apt-get install libegl1 libegl-mesa0 libgl1-mesa-dri libglx-mesa0 libgbm1 libgl1`
(Mesa llvmpipe; no GPU).

Findings (4-core box, llvmpipe): runs headless. Output is clean (no grain), unlit walls/floors are near-identical to Cycles,
lit props are within ~5% mean colour (Cycles' ambient is slightly occluded, Workbench has no occlusion), and team-key shade
bands on crew differ a little. Speed is no better than Cycles at 1 sample (SS 4: 0.2-2.5 s vs 0.3-3.5 s per sprite; crew
slower, 4 passes at 1016x952), so the gain is quality at preview cost, not speed. No see-through (alpha) materials.
