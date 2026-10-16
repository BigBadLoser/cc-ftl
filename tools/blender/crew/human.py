"""Builds the human species: body.glb (armature + base meshes + clips) and every slot item .glb."""
import bpy

from lib import export, materials, rig
from lib.kit import Builder
from . import arms, clothing, gear, hair_eyes  # noqa: F401  (import registers the items)
from .body import build_body
from .clips import CLIPS, FPS
from .registry import ITEMS

OUT = "crew/human"


def _meshes(builder, arm=None):
    objs = []
    for target, ob in builder.finish():
        if arm is not None:
            rig.attach(ob, arm, target)
        objs.append((target, ob))
    return objs



def build_clips(arm):
    """Keyframe every clip as its own action (fake user), one extra closing key so the loop is seamless."""
    bpy.context.scene.render.fps = FPS
    info = []
    for name, (fn, n) in CLIPS.items():
        act = rig.new_action(arm, name, n)
        for k in range(n + 1):
            rig.key_pose(arm, k + 1, fn(k % n, n))
        info.append({"name": name, "duration": round(n / FPS, 4), "loop": True})
    arm.animation_data.action = None
    return info


def build_body_glb(root):
    """Returns the manifest entry for the body."""
    export.clear_scene()
    arm = rig.create_armature()
    b = Builder("body", rig.REST)
    build_body(b)
    objs = [o for _t, o in _meshes(b, arm)]
    sockets = rig.add_sockets(arm)
    clips = build_clips(arm)
    path = root / OUT / "body.glb"
    path.parent.mkdir(parents=True, exist_ok=True)
    export.export_glb(path, [arm] + objs + sockets, animations=True)
    return {
        "id": "crew.human.body", "file": f"{OUT}/body.glb", "kind": "crew.body", "species": "human",
        "bones": list(rig.BONES), "sockets": list(rig.SOCKETS), "clips": clips,
        "tint": sorted({m.name for o in objs for m in o.data.materials if m.name.startswith("team.")}),
    }


def build_slot_glb(root, item):
    export.clear_scene()
    b = Builder(item.name, rig.REST)
    item.build(b)
    parts = _meshes(b)
    objs = [o for _t, o in parts]
    targets = sorted({t for t, _o in parts})
    fname = item.id.removeprefix("crew.human.") + ".glb"
    path = root / OUT / "slots" / fname
    path.parent.mkdir(parents=True, exist_ok=True)
    export.export_glb(path, objs)
    mats = {m.name for o in objs for m in o.data.materials}
    entry = {
        "id": item.id, "file": f"{OUT}/slots/{fname}", "kind": "crew.slot", "species": "human", "slot": item.slot,
        "targets": targets, "tint": sorted(m for m in mats if m.startswith("team.")),
        "emissive": sorted(m for m in mats if m.startswith("emissive.")),
    }
    for t in targets:
        entry.setdefault("socket" if t.startswith("socket.") else "bone", t)
    return entry


def build_all(root):
    entries = [build_body_glb(root)]
    entries += [build_slot_glb(root, it) for it in ITEMS]
    return entries
