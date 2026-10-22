#!/usr/bin/env python3
"""Validate sprite manifest and produce portable SHA256 inventories, no Blender needed."""
import argparse
import hashlib
import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def digest(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def required_files(assets):
    manifest_path = assets / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    paths = {"manifest.json"}
    for sid, sheet in manifest.get("sheets", {}).items():
        for field in ("image", "glow"):
            if field not in sheet:
                if field == "image":
                    raise ValueError(f"{sid}: image missing")
                continue
            name = sheet[field]
            p = Path(name)
            if p.is_absolute() or ".." in p.parts or not p.parts or p.parts[0] != "sprites":
                raise ValueError(f"{sid}: unsafe sprite path {name}")
            paths.add(p.as_posix())
    return manifest, sorted(paths)


def verify(assets, require_complete=False, state_path=None):
    manifest, files = required_files(assets)
    if manifest.get("tile", {}).get("w") != 128 or manifest.get("tile", {}).get("h") != 64:
        raise ValueError("Expected ART_SCALE=2 (128x64 tiles)")
    missing = [name for name in files if not (assets / name).is_file()]
    if missing:
        raise ValueError(f"Missing {len(missing)} files, first: {missing[:5]}")
    if require_complete:
        if not state_path or not state_path.exists():
            raise ValueError("Cannot verify completion: cloud render state missing")
        state = json.loads(state_path.read_text())
        from cloud_render import clips, FAMILIES
        required = [f"crew:{c}" for c in clips()] + [f"family:{f}" for f in FAMILIES] + ["pack:crew"]
        failed = [k for k in required if state.get("jobs", {}).get(k, {}).get("status") != "done"]
        if failed:
            raise ValueError(f"Incomplete render jobs: {len(failed)}; first: {failed[:5]}")
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--assets", type=Path, default=Path("public/assets"))
    parser.add_argument("--state", type=Path, default=Path(".cache/cloud-render/state.json"))
    parser.add_argument("--require-complete", action="store_true")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--write", type=Path, help="Write SHA256 inventory (outside assets)")
    group.add_argument("--check", type=Path, help="Verify a previously written SHA256 inventory")
    args = parser.parse_args()
    try:
        files = verify(args.assets, args.require_complete, args.state)
        if args.write:
            args.write.parent.mkdir(parents=True, exist_ok=True)
            with args.write.open("w") as out:
                for name in files:
                    out.write(f"{digest(args.assets / name)}  {name}\n")
        if args.check:
            expected = {}
            for line in args.check.read_text().splitlines():
                checksum, path = line.split("  ", 1)
                expected[path] = checksum
            if set(expected) != set(files):
                raise ValueError("Checksum inventory file list differs from manifest")
            mismatches = [name for name in files if digest(args.assets / name) != expected[name]]
            if mismatches:
                raise ValueError(f"Corrupt or changed files: {mismatches[:5]}")
        print(f"Verified {len(files)} required files in {args.assets}")
    except (ValueError, OSError, json.JSONDecodeError) as exc:
        parser.exit(1, f"Asset verification failed: {exc}\n")


if __name__ == "__main__":
    main()
