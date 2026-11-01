"""Damage states for Sol's module packs (engine, AI core, shield generators; family `damage_sol`): the damage.py pass
applied to each pack's own model, rendered in a Blender job per pack like sol_pack (the packs' scripts each bring their
own `model` module, so they cannot share one Blender).

  engine     module.engine.{machine,machine.open,bell}.r<n>.{damaged,damaged.flicker,destroyed} (the hull wall is not
             damaged: it is the ship's wall; the bell gets no flicker frame, it has no lights when idle)
  ai_core    module.ai_core.r<n>.{damaged,damaged.flicker,destroyed}
  shields    module.shield_gen[_small].r<n>.{damaged,damaged.flicker,destroyed}

Job (inside Blender):  blender -b --python sol_damage.py -- --kind K --out DIR [--rot N...] [--quality preview|final]
Build (build_sprites `damage_sol`): renders every job into $SOL_DIR/damage-<kind> (reused when present) and packs them.
SOL_DAMAGE_ROTS=1 renders r0 only and SOL_DAMAGE_QUALITY=preview drops to 4 samples, for quick previews."""
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EXP = ROOT / "tools/blender/experiments"
DIRS = {"engine": "engine_kestrel_h185", "ai_core": "ai_core_oracle_h185", "shields": "shield_bastion_h185_ward_lowbody"}
LEVELS = ("damaged", "damaged.flicker", "destroyed")


def _jobs(kind, rots):
    """[(sid, footprint, builder, levels)] of the undamaged idle builds, inside the pack's own sys.path."""
    import model
    out = []
    for r in rots:
        if kind == "engine":
            fp = [4, 5] if r % 2 == 0 else [5, 4]
            for part in ("machine", "machine.open", "bell"):
                lv = LEVELS if part != "bell" else ("damaged", "destroyed")
                out.append((f"module.engine.{part}.r{r}", fp, lambda r=r, p=part: model.machine(r, False, 7, part=p), lv))
        elif kind == "ai_core":
            out.append((f"module.ai_core.r{r}", [2, 2], lambda r=r: model.core_module(r, False, 2), LEVELS))
        else:
            from geometry import footprint
            for small in (False, True):
                sid = "module.shield_gen" + ("_small" if small else "") + f".r{r}"
                out.append((sid, footprint(small, r), lambda r=r, s=small: (model.small if s else model.large)(r, False),
                            LEVELS))
    return out


def _no_exhaust(build):
    """The engine's exhaust plume is built hidden-to-be: keep it out of the damage pass (and the render)."""
    def f():
        objs = build()
        for o in objs:
            if o.name.startswith("KESTREL_exhaust"):
                o.hide_render = True
        return [o for o in objs if not o.name.startswith("KESTREL_exhaust")]
    return f


def _render(out, sid, build, fp, samples):
    """The packs' sprite path (render.sprite), for any builder: colour with an outline, glow, cropped, written."""
    import bpy
    import numpy as np
    from sprites import core, post
    core.setup_scene()
    core._state["scene"].cycles.samples = samples
    objects = build()
    for ob in bpy.data.objects:                                              # no exhaust on a damaged engine
        if ob.name.startswith("KESTREL_exhaust"):
            ob.hide_render = True
    xmin, xmax, ymin, ymax = core.extent_px(objects)
    w = 2 * (math.ceil(max(-xmin, xmax)) + 6)
    h = 2 * (math.ceil(max(-ymin, ymax)) + 6)
    rgb, a = core.render(w, h, "color")
    c, op = post.downsample(rgb, a > .5, core.SS, 8, True)
    c, op = post.outline(c, op, True)
    rgb, _ = core.render(w, h, "glow")
    g = np.pad(post.glow_down(rgb, core.SS, 3), ((1, 1), (1, 1), (0, 0)))
    x0, y0, x1, y1 = post.crop_box(op | (g[..., 3] > 0))
    rgba = post.to_rgba(c, op)[y0:y1, x0:x1]
    g = g[y0:y1, x0:x1]
    d = out / "sprites"
    d.mkdir(parents=True, exist_ok=True)
    post.write_png(d / (sid + ".png"), rgba)
    post.write_png(d / (sid + ".glow.png"), g)
    return {"kind": "static", "sheet": sid, "frame": {"x": 0, "y": 0, "w": int(x1 - x0), "h": int(y1 - y0)},
            "anchor": {"x": int((w + 2) // 2 - x0), "y": int((h + 2) // 2 - y0)}, "footprint": fp,
            "glow": bool(g[..., 3].any())}


def job():
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--kind", choices=tuple(DIRS), required=True)
    p.add_argument("--out", type=Path, required=True)
    p.add_argument("--rot", type=int, nargs="+", default=[0, 1, 2, 3])
    p.add_argument("--quality", choices=("preview", "final"), default="final")
    a = p.parse_args(sys.argv[sys.argv.index("--") + 1:])
    here = EXP / DIRS[a.kind]
    sys.path[:0] = [str(here.parents[1]), str(here)]
    from sprites import damage
    a.out.mkdir(parents=True, exist_ok=True)
    man = {"version": 1, "sheets": {}, "assets": {}}
    for stem, fp, build, levels in _jobs(a.kind, a.rot):
        for level in levels:
            sid = f"{stem}.{level}"
            build = _no_exhaust(build)
            inside = ".bell." not in sid                                     # the bell is outside the hull: no sparks,
            entry = _render(a.out, sid, damage.wrap(build, level, sid, inside, inside), fp,   # no debris in space
                            24 if a.quality == "final" else 4)
            man["assets"][sid] = entry
            man["sheets"][sid] = {"image": f"sprites/{sid}.png", "glow": f"sprites/{sid}.glow.png"}
            print("SPRITE", sid, flush=True)
    (a.out / "manifest.fragment.json").write_text(json.dumps(man, indent=2) + "\n")


def build(out, log=print):
    """Render (or reuse) every pack's damage job and pack them into the `damage_sol` sheets."""
    import bpy
    from . import pack
    base = Path(os.environ.get("SOL_DIR", Path(tempfile.gettempdir()) / "sol-pack-1x"))
    rots = [str(r) for r in range(int(os.environ.get("SOL_DAMAGE_ROTS", 4)))]
    quality = os.environ.get("SOL_DAMAGE_QUALITY", "final")
    items = []
    for kind in DIRS:
        d = base / f"damage-{kind}"
        if not (d / "manifest.fragment.json").exists():
            tmp = base / f"damage-{kind}.part"
            tmp.mkdir(parents=True, exist_ok=True)
            cmd = [bpy.app.binary_path, "-b", "-t", os.environ.get("SOL_THREADS", "3"), "--factory-startup",
                   "--python-exit-code", "1", "--python", str(Path(__file__)), "--", "--kind", kind, "--out", str(tmp),
                   "--quality", quality, "--rot", *rots]
            log("SOL damage", kind)
            subprocess.run(cmd, check=True, cwd=ROOT, stdout=subprocess.DEVNULL)
            tmp.rename(d)
        frag = json.loads((d / "manifest.fragment.json").read_text())
        for sid, a in frag["assets"].items():
            img = pack.read_png(d / "sprites" / f"{sid}.png")
            gp = d / "sprites" / f"{sid}.glow.png"
            glow = pack.read_png(gp) if gp.exists() else img * 0
            items.append({"id": sid, "fp": a["footprint"], "rgba": img, "g": glow, "ax": a["anchor"]["x"],
                          "ay": a["anchor"]["y"]})
    return pack.pack("damage_sol", items, out, log)


if __name__ == "__main__":
    job()
