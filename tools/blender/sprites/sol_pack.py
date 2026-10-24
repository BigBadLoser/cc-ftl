"""Sol's approved module packs (tools/blender/experiments, see height_185/HANDOFF.md), rendered at final quality by
their own scripts and packed into game sheets. Runs inside Blender (build_sprites.py `sol`); each pack is rendered by a
separate Blender job, one at a time.

  engine    Heavy Kestrel (engine_kestrel_h185): module.engine.hull.r<n>, module.engine.machine.r<n>[.active]
  ai_core   ORACLE (ai_core_oracle_h185): module.ai_core.r<n>[.active]; roof.ai_core[.stowed|.deploy.f<k>|.active]
  shields   BASTION + WARD (shield_bastion_h185_ward_lowbody): module.shield_gen[_small].r<n>[.active];
            roof.shield_gen[_small][.stowed|.deploy.f<k>|.active]. BASTION is 2x3, so its roof parts are also
            rendered at rotation 1 (roof.shield_gen.r1.*, anchored like the rotated module); r2 / r3 reuse r0 / r1.
Roof parts are modelled on the 2.05 roof plane: like the turrets they need no roof lift at runtime.

Renders go to $SOL_DIR (default <tmp>/sol-pack); an existing job folder is reused, so delete it to re-render."""
import json
import os
import subprocess
import tempfile
from pathlib import Path

from . import pack

ROOT = Path(__file__).resolve().parents[3]
EXP = ROOT / "tools/blender/experiments"
SHEETS = ("engine", "ai_core", "shields")
_R1 = """
import sys; from pathlib import Path
d = Path({d!r}); sys.path[:0] = [str(d.parents[1]), str(d)]
sys.argv = ["x", "--", "--out", {out!r}, "--part", "context"]
import render, roof
for pose in roof.POSES:
    sid = "roof.shield_gen.r1" + ("" if pose == "deployed" else "." + pose)
    render.sprite(Path({out!r}), sid, lambda pose=pose: roof.large(pose, 1), False, rot=1, final=True)
"""


def _jobs():
    eng = EXP / "engine_kestrel_h185/render.py"
    ai = EXP / "ai_core_oracle_h185/render.py"
    sh = EXP / "shield_bastion_h185_ward_lowbody/render.py"
    out = [("engine", f"engine-r{r}", ["--python", str(eng), "--", "--stage", "7", "--rot", str(r), "--no-beauty"]) for r in range(4)]
    out += [("ai_core", "ai-module", ["--python", str(ai), "--", "--part", "module", "--rot", "0", "1", "2", "3", "--quality", "final"])]
    out += [("ai_core", f"ai-{p}", ["--python", str(ai), "--", "--part", p, "--quality", "final"]) for p in ("roof-a", "roof-b")]
    out += [("shields", "shield-modules", ["--python", str(sh), "--", "--part", "modules", "--rot", "0", "1", "2", "3", "--quality", "final"])]
    out += [("shields", f"shield-{p}", ["--python", str(sh), "--", "--part", p, "--quality", "final"])
            for p in ("roof-large-a", "roof-large-b", "roof-small-a", "roof-small-b")]
    out += [("shields", "shield-roof-large-r1", ["--python-expr", "R1"])]
    return out


def render(base):
    import bpy
    blender = bpy.app.binary_path
    threads = os.environ.get("SOL_THREADS", "3")
    for fam, tag, args in _jobs():
        d = base / tag
        if (d / "manifest.fragment.json").exists():
            print("SOL reuse", tag, flush=True)
            continue
        tmp = base / (tag + ".part")
        tmp.mkdir(parents=True, exist_ok=True)
        if args[0] == "--python-expr":
            args = ["--python-expr", _R1.format(d=str(EXP / "shield_bastion_h185_ward_lowbody"), out=str(tmp))]
        else:
            args = args[:3] + ["--out", str(tmp)] + args[3:]
        cmd = [blender, "-b", "-t", threads, "--factory-startup", "--python-exit-code", "1"] + args
        print("SOL render", tag, flush=True)
        subprocess.run(cmd, check=True, cwd=ROOT, stdout=subprocess.DEVNULL)
        tmp.rename(d)


def build(out, log=print):
    base = Path(os.environ.get("SOL_DIR", Path(tempfile.gettempdir()) / f"sol-pack-{os.environ.get('ART_SCALE', '2')}x"))
    base.mkdir(parents=True, exist_ok=True)
    render(base)
    by = {f: [] for f in SHEETS}
    seen = set()
    for fam, tag, _ in _jobs():
        frag = json.loads((base / tag / "manifest.fragment.json").read_text())
        for sid, a in frag["assets"].items():
            if sid.startswith("review.") or sid in seen:
                continue
            seen.add(sid)
            img = pack.read_png(base / tag / "sprites" / f"{sid}.png")
            gp = base / tag / "sprites" / f"{sid}.glow.png"
            glow = pack.read_png(gp) if gp.exists() else img * 0
            by[fam].append({"id": sid, "fp": a["footprint"], "rgba": img, "g": glow, "ax": a["anchor"]["x"], "ay": a["anchor"]["y"]})
    sheets, assets = {}, {}
    for fam, items in by.items():
        s, a = pack.pack(fam, items, out, log)
        sheets.update(s)
        assets.update(a)
    return sheets, assets
