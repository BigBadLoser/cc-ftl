"""Render cache for the crew sprites (plain python + numpy, no bpy).

One entry = the raw render of ONE item in ONE clip frame facing ONE direction (RGBA plus optional glow, padded to the
fixed frame). The key is a hash of everything that can change those pixels (crew_build.py composes it); the key is part
of the file name, so "is it cached" is one stat() and a changed input simply misses. Location: `<repo>/.cache/sprites/crew`
(gitignored; override with $SPRITE_CACHE)."""
import hashlib
import os
from pathlib import Path
import numpy as np

ROOT = Path(__file__).resolve().parents[3]


def root():
    return Path(os.environ.get("SPRITE_CACHE") or ROOT / ".cache/sprites") / "crew"


def digest(*parts):
    h = hashlib.sha1()
    for p in parts:
        h.update(str(p).encode())
        h.update(b"\x1f")
    return h.hexdigest()


def files_digest(paths):
    h = hashlib.sha1()
    for p in sorted(Path(x) for x in paths):
        h.update(p.name.encode())
        h.update(p.read_bytes())
    return h.hexdigest()


def entry_path(item_id, clip, d, i, key):
    return root() / item_id / clip / f"d{d}_f{i}.{key[:20]}.npz"


def store(path, rgba, glow, muzzle=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    stem = path.name.split(".")[0]
    for old in path.parent.glob(stem + ".*.npz"):         # stale entries of the same frame
        old.unlink()
    tmp = path.with_suffix(".tmp.npz")
    extra = {} if glow is None else {"glow": glow}
    if muzzle is not None:
        extra["muzzle"] = muzzle                          # held weapons: the muzzle point (sprite px from the anchor)
    np.savez_compressed(tmp, rgba=rgba, **extra)
    os.replace(tmp, path)


def load(path):
    with np.load(path) as z:
        return z["rgba"], (z["glow"] if "glow" in z.files else None)


def load_muzzle(path):
    with np.load(path) as z:
        return [round(float(v), 1) for v in z["muzzle"]] if "muzzle" in z.files else None
