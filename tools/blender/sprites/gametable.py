"""Holo game table (family `gametable_module`): `module.gametable`, the approved look study r1 + s4
(gametable_study.py: a slim table on one round column, a recessed projector in its top, a creature duel on a wide
arena over the table lit by a fan of rays from the lens: the pink serpent against the green dragon) as a 2x1 module,
four rotations, front = +v. Two players sit on the stools on the tiles in front (+v, left) and behind (-v, right).

Sprites per rotation r, ids `module.gametable.r<r>[.state]` (`module.gametable` is the r0 idle copy):
  (idle)       powered, nobody playing: the table lit, the lens on, no hologram
  .unpowered   every light dark
  .active      two playing: the hologram composited over the table (partial alpha baked in, as the research
  .active.f1.. bench's), FRAMES frames at the renderer's ANIM_FPS: a round of the fight (see FIGHT).
Seated players: as the research bench's chair, `module.gametable.front.r<r>[.state]` is the overlay drawn over them
(the sprite's pixels where the table hides a seated crew member at either stool in some sit frame, grown 1 px over the
outline ring). The hologram stands in front of the far player and behind the near one: its part over the far player
is left out of the `.active` sprites and is `module.gametable.holo.r<r>.active[.fN]` instead, an overlay drawn over the
players (so with or without a player there the hologram comes out whole). Layering: the table at K, both players at
K + 0.02, the front overlay at K + 0.03, the hologram overlay at K + 0.04."""
import math

import numpy as np

from . import consoles as CO
from . import core, env_build as E, post
from .gametable_study import AU, AV, FP2, SEATS, TOP, ZA, bar2, dragon, r_table, rim_points, serpent, stadium_ring
from .modkit import K
from .research_bench import drop, over
from .research_kit import Bench, bar, holo_item

PAL = "arcade"
PAD = 72                                            # canvas margin for the hologram, px
# The fight, frame by frame (8 frames, 2 s at ANIM_FPS 4): the dragon rears and breathes fire across the arena, it
# bursts on the serpent, which flashes and recoils; then the serpent winds back and strikes across to bite the dragon,
# which flashes and is knocked back. Per frame: dragon (shift toward the serpent, wing flap, rear), serpent (sway: head
# forward + / back -), the flame (how far it has gone, 0..3 blobs, or "hit"), who flashes ("s" / "d"), whose bar
# shows the damage.
FIGHT = (
    dict(d=(0.0, 0.0, 0.0), s=0.0),
    dict(d=(-0.03, 0.12, 0.08), s=0.0),                              # the dragon rears, wings up
    dict(d=(0.08, -0.04, 0.0), s=0.0, flame=2),                      # lunges, the flame leaves its jaws
    dict(d=(0.08, 0.0, 0.0), s=-0.07, flame="hit", flash="s"),       # the flame bursts on the serpent; it recoils
    dict(d=(0.0, 0.06, 0.0), s=-0.03),
    dict(d=(0.0, 0.0, 0.0), s=-0.06),                                # the serpent winds back,
    dict(d=(-0.06, 0.1, 0.06), s=0.22, flash="d"),                   # strikes across: the dragon is knocked back
    dict(d=(-0.02, 0.04, 0.0), s=0.06),
)
FRAMES = len(FIGHT)


def sid(rot, tag=""):
    return f"module.gametable.r{rot}{tag}"


def table(rot, off=False):
    return r_table("gametable", rot=rot, off=off)


def duel(rot, f):
    """The hologram in frame f: the arena (rim, centre line, a pad under each), the serpent and the dragon posed, the
    bolt or its burst, the health bars, the fan of rays from the lens."""
    k = Bench("gametable_holo", FP2, rot)
    stadium_ring(k, AU, AV, ZA, 0.016, 0.02, "arcCyan", "arcCyan")
    k.box(0.0, 0.0, ZA, 0.014, 2 * AV, 0.008, "arcCyan", top="arcCyan")
    for u in (-0.44, 0.44):
        k.cyl(u, 0.0, ZA, 0.16, 0.004, "arcCyanF", top="arcCyanF", sides=14)
    st = FIGHT[f]
    du, flap, rear = st["d"]
    flash = st.get("flash")
    serpent(k, -0.44, ZA, "arcMarq" if flash == "s" else "arcPink", 1, sway=st["s"])
    dx = 0.44 - du
    dragon(k, dx, ZA, "arcMarq" if flash == "d" else "arcGrn", -1, flap=flap, rear=rear)
    mouth = dx - 0.2
    if st.get("flame") == "hit":                                                         # the burst on the serpent
        for rz in (0.0, 0.785, 1.571, 2.356):
            k.box(-0.3, 0.0, ZA + 0.27, 0.2, 0.024, 0.024, "arcAmb", rz=rz)
        k.box(-0.3, 0.0, ZA + 0.24, 0.07, 0.07, 0.07, "arcMarq", top="arcMarq")
    elif st.get("flame"):                                                                # the flame, growing as it
        for i in range(3):                                                               # leaves the jaws
            s_ = 0.04 + i * 0.02
            k.box(mouth - 0.06 - i * 0.1, 0.0, ZA + 0.26 - s_ / 2, s_, s_, s_, "arcAmb" if i < 2 else "arcAmbF",
                  top="arcAmb")
    hurt = {"s": (-0.44, 0.46, "arcPink"), "d": (0.44, 0.5, "arcGrn")}
    for who, (u, zb, col) in hurt.items():
        frac = 0.75 if who == "s" else 0.5
        bar2(k, u, ZA + zb, frac, "arcMarq" if flash == who else col)                    # a bar flashes when hit
    lens = (0.0, 0.0, TOP + 0.033)
    for i, q in enumerate(rim_points(12)):
        bar(k, lens, q, 0.01, "arcCyan" if i % 3 == 0 else "arcCyanF")
    return k.build()


def occluders(rot, W, H):
    """(hit, seen, hit_holo) as research_bench.occluders, for both stools: pixels where the table hides a seated cast
    member in any sit frame, where the crew shows in front of it, and where the hologram (every frame's at once) hides
    one (only the far player: the hologram is behind the near one)."""
    hr, (arm, items) = CO._rig()
    objs = table(rot)
    holo = [o for f in range(FRAMES) for o in duel(rot, f)]
    by = {it.id: it for it in items}
    hit = np.zeros((H + 2, W + 2), bool)
    seen, hit_holo = hit.copy(), hit.copy()
    for su, sv in SEATS:
        cx, cy = K("gametable_xy", FP2, rot).p(su, sv)
        face = CO.SEAT_DIR[rot] if sv > 0 else CO.SEAT_DIR[(rot + 2) % 4]
        for clip, n, _, _ in [c for c in hr.CLIPS if c[0].startswith("sit")]:
            for i in range(n):
                arm.rotation_euler = (0, 0, math.radians(hr.THETA[face]))
                hr.pose_frame(arm, clip, i, "idle_Armature", 0)
                arm.location = (cx, -cy, 0)
                for cast in CO.SIT_CAST:
                    hr.set_state(items, [by["crew.human." + c] for c in cast], [])
                    vis = []
                    for shown in ((), objs, holo):                        # crew alone, behind the table, the holo
                        for o in objs + holo:
                            o.is_holdout, o.hide_render = True, o not in shown
                        rgb, a = core.render(W, H, "color")
                        vis.append(np.pad(post.downsample(rgb, a > 0.5, core.SS, 6, False)[1], 1))
                    hit |= vis[0] & ~vis[1]
                    hit_holo |= vis[0] & ~vis[2]
                    seen |= vis[1]
    arm.location = (0, 0, 0)
    hr.set_state(items, [], [])
    drop(objs + holo)
    return hit, seen, hit_holo


def grow(m):
    out = m.copy()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        out |= np.roll(m, (dy, dx), (0, 1))
    return out


def canvas(objs, ox=None, oy=None):
    c, op, g, x, y, _ = E.render_sprite("x", "prop", objs)
    pad = lambda a: np.pad(a, ((PAD, PAD), (PAD, PAD)) + ((0, 0),) * (a.ndim - 2))   # noqa: E731
    c, op, g = pad(c), pad(op), pad(g)
    return {"rgba": np.dstack([c, (op * 255).astype(np.uint8)]), "g": g, "ax": x + PAD, "ay": y + PAD, "fp": FP2,
            "id": "x"}


def place(item, full):
    """`item` put on `full`'s canvas grid (same shape and anchor)."""
    cv = np.zeros(full["rgba"].shape, np.uint8)
    gv = np.zeros(full["g"].shape, np.uint8)
    h, w = item["rgba"].shape[:2]
    x0, y0 = full["ax"] - item["ax"], full["ay"] - item["ay"]
    ys, xs = max(0, y0), max(0, x0)
    ye, xe = min(cv.shape[0], y0 + h), min(cv.shape[1], x0 + w)
    cv[ys:ye, xs:xe] = item["rgba"][ys - y0:ye - y0, xs - x0:xe - x0]
    gv[ys:ye, xs:xe] = item["g"][ys - y0:ye - y0, xs - x0:xe - x0]
    return {"rgba": cv, "g": gv, "ax": full["ax"], "ay": full["ay"], "fp": full["fp"], "id": item["id"]}


def items(rot):
    CO._rig()                                         # (the rig first: building it clears the scene)
    post.select(PAL)
    objs = table(rot)
    c, op, g, ox, oy, _ = E.render_sprite("x", "prop", objs)
    W, H = op.shape[1] - 2, op.shape[0] - 2
    rgb, a = core.render(W, H, "color")
    ring = op & ~np.pad(post.downsample(rgb, a > 0.5, core.SS, 8, False)[1], 1)      # the sprite's outline px
    drop(objs)
    hit, seen, hit_holo = occluders(rot, W, H)
    front = np.pad(hit | (grow(hit) & (ring | ~seen)), PAD)
    over_holo = np.pad(grow(hit_holo), PAD)                         # where the hologram goes over the far player
    objs = table(rot)
    full = canvas(objs)
    drop(objs)
    objs = table(rot, off=True)
    states = [("", full), (".unpowered", canvas(objs))]
    drop(objs)
    out = []
    ox, oy = full["ax"], full["ay"]
    for f in range(FRAMES):
        tag = ".active" + (f".f{f}" if f else "")
        mask, hobjs = table(rot), duel(rot, f)
        holo = holo_item("holo", FP2, mask, hobjs)
        drop(mask + hobjs)
        if not holo:
            states.append((tag, full))
            continue
        h = place(holo, full)                                          # the hologram on the table's grid: the part
        cut = dict(h, rgba=h["rgba"].copy(), g=h["g"].copy())          # over the far player leaves the sprite for an
        cut["rgba"][over_holo, 3] = 0                                  # overlay drawn over the players (K + 0.04)
        cut["g"][over_holo] = 0
        states.append((tag, over(full, cut)))
        ov = over_holo & (h["rgba"][..., 3] > 0)
        if ov.any():
            g = h["g"].copy()
            g[~ov] = 0
            out.append(E.crop_item(f"module.gametable.holo.r{rot}{tag}", FP2, h["rgba"][..., :3], ov, g, ox, oy,
                                   np.where(ov, h["rgba"][..., 3], 0)))
    for tag, item in states:
        cv = np.zeros(full["rgba"].shape, np.uint8)
        gv = np.zeros(full["g"].shape, np.uint8)
        h, w = item["rgba"].shape[:2]
        x0, y0 = ox - item["ax"], oy - item["ay"]
        ys, xs = max(0, y0), max(0, x0)
        ye, xe = min(cv.shape[0], y0 + h), min(cv.shape[1], x0 + w)
        cv[ys:ye, xs:xe] = item["rgba"][ys - y0:ye - y0, xs - x0:xe - x0]
        gv[ys:ye, xs:xe] = item["g"][ys - y0:ye - y0, xs - x0:xe - x0]
        al = cv[..., 3]
        fr = (al > 0) & front
        gb, gf = gv.copy(), gv.copy()
        gb[fr] = 0
        gf[~fr] = 0
        out.append(E.crop_item(sid(rot, tag), FP2, cv[..., :3], al > 0, gb, ox, oy, al))
        if rot == 0 and tag == "":
            out.append(E.crop_item("module.gametable", FP2, cv[..., :3], al > 0, gb, ox, oy, al))
        if fr.any():
            out.append(E.crop_item(f"module.gametable.front.r{rot}{tag}", FP2, cv[..., :3], fr, gf, ox, oy,
                                   np.where(fr, al, 0)))
    return [it for it in out if it]


def job(rot):
    def run(rot=rot):
        return items(rot)
    return run


def jobs(rots=range(4)):
    return [job(r) for r in rots]
