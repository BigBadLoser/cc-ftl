"""Entry point (npm run sprites):
  blender -b --factory-startup --python tools/blender/sprites/build_sprites.py -- [outdir] [crew|env|all]

Writes <outdir>/sprites/*.png (+ .glow.png twins) and <outdir>/manifest.json in the shape of
src/render/assets/manifest.ts. Default outdir = public/assets. Crew and env run separately for iteration; their
manifest fragments are cached in the temp dir so a partial run still writes a complete manifest."""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from sprites import core  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
PARTS = Path(tempfile.gettempdir()) / "sprites-parts"
MANIFEST_VERSION = 1


def write_manifest(out):
    sheets, assets = {}, {}
    for name in ("crew", "env"):
        f = PARTS / f"{name}.json"
        if f.exists():
            d = json.loads(f.read_text())
            sheets.update(d["sheets"])
            assets.update(d["assets"])
    from sprites.crew_pack import KEY_COLORS
    m = {"version": MANIFEST_VERSION, "tile": {"w": core.TILE_W, "h": core.TILE_H}, "keyColors": KEY_COLORS,
         "sheets": sheets, "assets": assets}
    (out / "manifest.json").write_text(json.dumps(m, indent=1))
    print("MANIFEST", len(sheets), "sheets", len(assets), "assets")


def save_part(name, sheets, assets):
    PARTS.mkdir(parents=True, exist_ok=True)
    (PARTS / f"{name}.json").write_text(json.dumps({"sheets": sheets, "assets": assets}))


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = Path(argv[0]) if argv else ROOT / "public/assets"
    what = argv[1] if len(argv) > 1 else "all"
    out.mkdir(parents=True, exist_ok=True)
    if what in ("crew", "all"):
        from sprites import crew_pack, human_render as hr
        arm, items = hr.build_items()
        res, cols = hr.render_all(arm, items)
        save_part("crew", *crew_pack.pack(items, res, cols, out))
    if what in ("env", "all"):
        from sprites import env_build
        core.setup_scene()
        save_part("env", *env_build.build(out))
    write_manifest(out)


main()
