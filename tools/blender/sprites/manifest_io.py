"""Reading and writing the sprite manifest on disk (plain json/re/pathlib: no bpy, numpy or pipeline imports, so review
scripts and tests can use it).

The live manifest of an art set (public/assets/1x) is split so that rebuilding one family rewrites only its own file:

    manifest.json        the index: every top-level key except `sheets`/`assets` (version, tile, keyColors, heights) plus
                         `parts`, the sorted list of part names
    manifest/<part>.json {"sheets": {...}, "assets": {...}}: the assets of one part and the sheets they draw from,
                         one entry per line so a git diff shows only the sprites that changed

A part is a sprite family (the sheet name without its `.N` page suffix: `hull`, `hull.1` -> `hull`), or `crew` for every
layer asset (their sheets are one per clip). A manifest without `parts` (a single file, like the `manifest.fragment.json`
packages) reads and writes as it always did. `assemble(index, parts)` is mirrored by src/render/assets/manifestParts.ts."""
import json
import re
from pathlib import Path

PARTS_DIR = "manifest"
_PART_NAME = re.compile(r"[A-Za-z0-9_][A-Za-z0-9_.-]*")


def part_of_sheet(name):
    """`hull.1` -> `hull`: the family a sheet page belongs to."""
    return re.sub(r"\.\d+$", "", name)


def sheets_of(a):
    """The sheets an asset draws from: its one sheet, or (crew layers, one sheet per clip) every clip's."""
    return {a["sheet"]} if "sheet" in a else {c["sheet"] for c in a.get("clips", {}).values()}


def part_of(a):
    """The part file an asset is stored in."""
    return "crew" if "clips" in a and "sheet" not in a else part_of_sheet(a["sheet"])


def split(m):
    """(index, {part: {"sheets", "assets"}}) of a manifest; every key of `m` other than sheets/assets goes to the index."""
    parts = {}
    sheet_part = {}
    for k, a in m["assets"].items():
        p = part_of(a)
        if not _PART_NAME.fullmatch(p):
            raise ValueError(f"asset {k}: part name {p!r} is not a file name")
        parts.setdefault(p, {"sheets": {}, "assets": {}})["assets"][k] = a
        for s in sheets_of(a):
            sheet_part.setdefault(s, p)
    for s, d in m["sheets"].items():
        p = sheet_part.get(s) or part_of_sheet(s)      # (a sheet no asset draws from stays with its family)
        if not _PART_NAME.fullmatch(p):
            raise ValueError(f"sheet {s}: part name {p!r} is not a file name")
        parts.setdefault(p, {"sheets": {}, "assets": {}})["sheets"][s] = d
    index = {k: v for k, v in m.items() if k not in ("sheets", "assets")}
    index["parts"] = sorted(parts)
    return index, parts


def assemble(index, parts):
    """The manifest again: the index without `parts`, then every part's sheets and assets, each sorted by key."""
    m = {k: v for k, v in index.items() if k != "parts"}
    sheets, assets = {}, {}
    for p in index["parts"]:
        sheets.update(parts[p]["sheets"])
        assets.update(parts[p]["assets"])
    m["sheets"] = dict(sorted(sheets.items()))
    m["assets"] = dict(sorted(assets.items()))
    return m


def _line(k, v):
    return json.dumps(k) + ":" + json.dumps(v, separators=(",", ":"))


def part_text(part):
    """One entry per line, sorted by key (compact JSON inside the line)."""
    def block(d):
        return ",\n".join(_line(k, d[k]) for k in sorted(d))
    return '{\n"sheets":{\n' + block(part["sheets"]) + '\n},\n"assets":{\n' + block(part["assets"]) + "\n}\n}\n"


def index_text(index):
    return json.dumps(index, indent=1) + "\n"


def _write_if_changed(path, text):
    if path.exists() and path.read_text() == text:
        return False
    path.write_text(text)
    return True


def write_manifest(path, m):
    """Write the split manifest next to `path` (the index, manifest.json) and return the names of the files that changed.
    Part files of parts that no longer exist are removed."""
    path = Path(path)
    index, parts = split(m)
    pdir = path.parent / PARTS_DIR
    pdir.mkdir(parents=True, exist_ok=True)
    changed = [p for p, part in parts.items() if _write_if_changed(pdir / f"{p}.json", part_text(part))]
    for f in pdir.glob("*.json"):
        if f.stem not in parts:
            f.unlink()
            changed.append(f.stem)
    if _write_if_changed(path, index_text(index)):
        changed.append(path.name)
    return changed


def read_manifest(src):
    """The whole manifest of an art dir (public/assets/1x) or of a manifest file: the split layout is assembled, a
    single-file manifest (a fragment) is returned as it is."""
    src = Path(src)
    path = src / "manifest.json" if src.is_dir() else src
    index = json.loads(path.read_text())
    if "parts" not in index:
        return index
    parts = {p: json.loads((path.parent / PARTS_DIR / f"{p}.json").read_text()) for p in index["parts"]}
    return assemble(index, parts)
