"""Render cache for the env-style families (plain python + numpy, no bpy), the twin of crew_cache.py.

One entry = the finished, cropped items of ONE job (a sprite, or a callable job that returns several). The key is a hash of
everything that can change those pixels (env_build composes it: render code, palette, tile scale, settings, scene state and
the job's geometry); it is part of the file name, so "is it cached" is one stat() and a changed input simply misses.
Location: `<repo>/.cache/sprites/<family>` (gitignored; `$SPRITE_CACHE` moves the root); preview renders (SPRITE_PREVIEW=1)
live under `preview/` so they never evict or replace a final render."""
import ast
import os
import re
from pathlib import Path
import numpy as np
from .crew_cache import ROOT, digest, files_digest  # noqa: F401  (re-exported)

SRC = Path(__file__).resolve().parent
BL = SRC.parent
PREVIEW = os.environ.get("SPRITE_PREVIEW") == "1"


def root(family):
    base = Path(os.environ.get("SPRITE_CACHE") or ROOT / ".cache/sprites")
    return base / ("preview" if PREVIEW else "") / family


def entry_path(family, stem, key):
    return root(family) / f"{stem}.{key[:20]}.npz"


_CLOSURE = {}


def closure_files(module):
    """Source files of a sprites module and of every sprites module it imports, directly or in a function (static AST scan,
    so it is the same in every process). `module` is a dotted name such as 'sprites.consoles'."""
    if module not in _CLOSURE:
        seen, todo = set(), [module.split(".")[-1]]
        while todo:
            m = todo.pop()
            f = SRC / f"{m}.py"
            if m in seen or not f.exists():
                continue
            seen.add(m)
            for n in ast.walk(ast.parse(f.read_text())):
                if not isinstance(n, ast.ImportFrom):
                    continue
                if n.level == 1 and n.module:                                    # from .x import y
                    todo.append(n.module.split(".")[0])
                elif (n.level == 1 and not n.module) or n.module == "sprites":   # from . import x / from sprites import x
                    todo += [a.name for a in n.names]
                elif n.module and n.module.startswith("sprites."):               # from sprites.x import y
                    todo.append(n.module.split(".")[1])
        _CLOSURE[module] = sorted(SRC / f"{m}.py" for m in seen)
    return _CLOSURE[module]


def store(path, items):
    """items: [{id, fp, rgba, g, ax, ay}] (may be empty: the job made nothing visible)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    stale = re.compile(re.escape(path.name[:-len(".npz")].rsplit(".", 1)[0]) + r"\.[0-9a-f]{20}\.npz")
    for old in path.parent.iterdir():                                    # stale entries of the same job
        if stale.fullmatch(old.name) and old != path:
            old.unlink()
    arrs = {"n": np.array(len(items))}
    for k, it in enumerate(items):
        arrs.update({f"id{k}": np.array(it["id"]), f"fp{k}": np.array(it["fp"]), f"rgba{k}": it["rgba"], f"g{k}": it["g"],
                     f"a{k}": np.array([it["ax"], it["ay"]])})
    tmp = path.with_suffix(".tmp.npz")
    np.savez_compressed(tmp, **arrs)
    os.replace(tmp, path)


def load(path):
    with np.load(path) as z:
        return [{"id": str(z[f"id{k}"]), "fp": tuple(int(v) for v in z[f"fp{k}"]), "rgba": z[f"rgba{k}"], "g": z[f"g{k}"],
                 "ax": int(z[f"a{k}"][0]), "ay": int(z[f"a{k}"][1])} for k in range(int(z["n"]))]
