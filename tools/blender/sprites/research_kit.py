"""Research bench look studies: the shared kit (family `research`, preview only). Local frame: modkit.K, footprint
(3, 2), front = +v; the chair is the middle front tile (u 0, v +0.5), facing -v. A design is a pair (bench(layer),
holo()): the bench sprite `.on` (see-through parts through Bench.part), and its hologram as its own translucent layer
`.holo` (holo_job)."""
import math

from .modkit import K

FP = (3, 2)
CU, CV = 0.0, 0.5                 # the chair tile (local)
GLASS_A, GLASS_RIM = 0.07, 0.12   # see-through glass (as hydroponics: baked by the render over what is behind it)
FLUID_A = 0.3
HOLO_FILM, HOLO_LINE = 90, 230    # the hologram layer's alpha: film (non-emissive colours), lines (emissive)


class Bench(K):
    """K with see-through parts: part(name) is a K whose objects render with the alpha `SEE[name]`."""
    SEE = {"glass": (GLASS_A, GLASS_RIM), "fluid": (FLUID_A, 0.2)}

    def __init__(self, name):
        super().__init__(name, FP, 0)
        self.name, self.parts = name, {}

    def part(self, name):
        if name not in self.parts:
            self.parts[name] = K(f"{self.name}_{name}", FP, 0)
        return self.parts[name]

    def build(self):
        out = super().build()
        for n, p in self.parts.items():
            for o in p.build():
                o["alpha"], o["rim"] = self.SEE[n]
                out.append(o)
        return out


def ring(k, axis, cu, cv, cz, r, n, w, t, col):
    """A ring of n boxes round an axis ('u', 'v' or 'z') through (cu, cv, cz): w thick along the axis, t radial."""
    seg = 2 * math.pi * r / n * 1.1
    for i in range(n):
        a = i * math.tau / n
        if axis == "u":
            k.box(cu, cv + r * math.cos(a), cz + r * math.sin(a) - t / 2, w, seg, t, col, rx=a + math.pi / 2)
        elif axis == "v":
            k.box(cu + r * math.cos(a), cv, cz + r * math.sin(a) - t / 2, seg, w, t, col, ry=-a - math.pi / 2)
        else:
            k.box(cu + r * math.cos(a), cv + r * math.sin(a), cz, seg, t, w, col, rz=a + math.pi / 2)


def bar(k, a, b, w, col):
    """A square bar from point a to point b (local u, v, z)."""
    du, dv, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    L = math.sqrt(du * du + dv * dv + dz * dz)
    k.box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2 - L / 2, w, w, L, col,
          rz=math.atan2(dv, du) - math.pi / 2, rx=-math.atan2(math.hypot(du, dv), dz))


def chair(k, shell="steelD", pad="navy"):
    """A lab chair on the chair tile facing -v: five-star base, gas post, seat pad (top 0.39), backrest at +v."""
    u, v = CU, CV
    for i in range(5):
        a = i * math.tau / 5 + 0.3
        k.box(u + 0.11 * math.cos(a), v + 0.11 * math.sin(a), 0.04, 0.22, 0.06, 0.045, "steelD", rz=a)
        k.box(u + 0.21 * math.cos(a), v + 0.21 * math.sin(a), 0.0, 0.07, 0.07, 0.06, "dark")
    k.cyl(u, v, 0.08, 0.045, 0.2, "steelL", top="steel", sides=8)
    k.box(u, v, 0.28, 0.46, 0.44, 0.07, shell, top="steel", bevel=0.02)
    k.box(u, v - 0.01, 0.35, 0.4, 0.38, 0.04, pad, top=pad, bevel=0.012)
    k.box(u, v + 0.2, 0.3, 0.07, 0.05, 0.14, "steelL")
    k.box(u, v + 0.23, 0.42, 0.42, 0.07, 0.34, shell, top="steel", rx=-0.12, bevel=0.02)
    k.box(u, v + 0.19, 0.45, 0.34, 0.02, 0.27, pad, rx=-0.12)


def body(k, u, v, su, sv, h, col="steel", top="plate", panel="plateB", faces=(1, 1)):
    """A cabinet body: kick recess, the shell, inset panels on its +v and +u/-u faces, a top skin."""
    k.box(u, v, 0.0, su - 0.08, sv - 0.08, 0.08, "dark")
    k.box(u, v, 0.08, su, sv, h - 0.12, col, top=top, bevel=0.02)
    if faces[0]:
        k.box(u, v, 0.15, su - 0.16, sv + 0.014, h - 0.3, panel)
    if faces[1]:
        k.box(u, v, 0.15, su + 0.014, sv - 0.16, h - 0.3, panel)
    k.box(u, v, h - 0.04, su + 0.03, sv + 0.03, 0.04, "gm", top=top, bevel=0.012)


def slope_panel(k, u, v, z, su, sv, ry, glow, n=4):
    """A sloped control panel on a wing top, tipped by ry toward the chair: a dark face, a row of buttons, a readout."""
    k.box(u, v, z, su, sv, 0.08, "steelD", top="blueGrey", ry=ry, bevel=0.012)
    s = math.copysign(1, ry)
    k.box(u - s * 0.06, v - 0.12, z + 0.06, su * 0.55, sv * 0.36, 0.03, "dark", ry=ry)
    k.box(u - s * 0.06, v - 0.12, z + 0.085, su * 0.4, 0.04, 0.012, glow, ry=ry)
    for i in range(n):
        k.box(u + s * 0.02, v - 0.18 + i * 0.1, z + 0.08, 0.06, 0.05, 0.025, (glow, "gmD", "hivis", "steelL")[i % 4],
              ry=ry)


def holo_job(sid, v):
    """A translucent layer: the hologram rendered alone (the bench as holdout, so the bench hides what is behind it),
    alpha HOLO_LINE on its lit px and HOLO_FILM on the rest; no outline. Same origin as the bench sprite."""
    def run(sid=sid, v=v):                  # (the defaults key the render cache: one entry per layer)
        import numpy as np
        from . import core, post
        from . import env_build as E
        core.clear_scene_meshes()
        post.select("research")
        bench, holo = BUILD()[v]
        mask = bench("on")
        for o in mask:
            o.is_holdout = True
        objs = holo().build()
        xmin, xmax, ymin, ymax = core.extent_px(objs + mask)
        W = 2 * (int(math.ceil(max(-xmin, xmax))) + 5)
        H = 2 * (int(math.ceil(max(-ymin, ymax))) + 5)
        rgb, a = core.render(W, H, "color")
        c, op = post.downsample(rgb, a > 0.5, E.SS, 8, True)
        grgb, _ = core.render(W, H, "glow")
        g = post.glow_down(grgb, E.SS, 3)
        al = np.where(op, np.where(g[..., 3] > 0, HOLO_LINE, HOLO_FILM), 0).astype(np.uint8)
        g[..., :3] = (g[..., :3] * 0.45).astype(np.uint8)                              # a soft glow, not a lamp
        it = E.crop_item(sid, FP, E._pad1(c), E._pad1(op), E._pad1(g), (W + 2) // 2, (H + 2) // 2, np.pad(al, 1))
        return [it] if it else []
    return run


def BUILD():
    from . import research_r2, research_r4, research_r5, research_r6
    return {**research_r2.BUILD, **research_r4.BUILD, **research_r5.BUILD, **research_r6.BUILD}
