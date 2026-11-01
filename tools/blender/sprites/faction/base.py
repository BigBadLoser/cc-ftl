"""What every faction look is (a restyle.Look with a relief) and the faction palettes' ramps."""
import colorsys

from .. import wall3d as T
from .. import walls as W
from ..relief_style import Style
from ..restyle import STEP, Look, ramp
from ..structure_looks import FLOOR_STEP

# base colours: wall (partitions), hull (far hull, belly), trim (accents), second (a second tone: headers, recesses,
# frames), shade (faces toward +x), floor
BASES = {
    "fN": dict(wall="#a9b4c4", hull="#97a3b3", trim="#8c3a46", second="#24344a", shade="#3d5a80", floor="#3e4651"),
    "fD": dict(wall="#6b7a82", hull="#5e6d75", trim="#1f2a30", second="#2c3a41", shade="#364757", floor="#2c3236"),
    "fC1": dict(wall="#c9d1d1", hull="#bec6c7", trim="#c4553f", second="#8e989c", shade="#3d5a7c", floor="#5a5852"),
    "fC2": dict(wall="#c9d1d1", hull="#bec6c7", trim="#3d74c4", second="#8e989c", shade="#3d5a7c", floor="#50565b"),
    "fC3": dict(wall="#cfcdc5", hull="#c3c0b7", trim="#d39a2e", second="#948f85", shade="#46526e", floor="#57534b"),
    "fC4": dict(wall="#c8d0ca", hull="#bcc5be", trim="#3f9a66", second="#8a968d", shade="#3b5d6a", floor="#4b544c"),
    "fB": dict(wall="#2f3542", hull="#272d3a", trim="#5c6c86", second="#1e2330", shade="#262c3c", floor="#2f3440"),
    "fS": dict(wall="#736c60", hull="#5d5b55", trim="#9a5a2c", second="#4a463f", shade="#2e2c29", floor="#46443f"),
}


# a look's own lightness steps (restyle.LIGHT's, spread): bastion's set 8 is dark charcoal-slate with strong
# highlights against it
OFFSETS = {"fB": (0.30, 0.22, 0.09, 0.0, -0.05, -0.10, -0.16, 0.045, 0.155)}   # (its 8th, <pre>W7: between 3 and
                                                                                # 2; its 9th, <pre>W8: 2 and 1)


# a look's hue and saturation drifting down its ramps (else each ramp keeps its base colour's): (lightness, hue°,
# saturation) at the dark end and at the light end, between them by lightness; bastion's shadows indigo, its
# highlights steel blue
TINT = {"fB": ((0.20, 237, 0.23), (0.44, 212, 0.18))}


def _snap(h, l, s):
    """The colour (HLS) on a centre of post.quantize's bins (8 a channel, centred at 8n + 4), so the quantiser keeps
    it (not a near tone of another look's): of the 8 round it, the nearest in lightness, saturation and hue (a channel
    rounded on its own can turn a dark blue green), grey enough to anti-alias where one is."""
    def err(c):
        hh, ll, ss = colorsys.rgb_to_hls(*(v / 255 for v in c))
        dh = (hh - h + 0.5) % 1.0 - 0.5
        return (ll - l) ** 2 + 0.5 * (ss - s) ** 2 + (dh * 3 * s) ** 2
    near = [sorted({min(252, max(4, (int(v * 255 - 4) // 8 + d) * 8 + 4)) for d in (0, 1)})
            for v in colorsys.hls_to_rgb(h, l, s)]
    cands = [(r, g, b) for r in near[0] for g in near[1] for b in near[2]]
    aa = [c for c in cands if max(c) - min(c) < 48] or cands     # (inside post._aa_set's greys: it anti-aliases)
    return "#%02x%02x%02x" % min(aa, key=err)


def _tinted(ramp_, tint):
    """A ramp's steps ({name: hex}) at the hue and saturation tint gives their lightness, each on a bin centre
    (_snap)."""
    (l0, h0, s0), (l1, h1, s1) = tint
    out = {}
    for k, hexc in ramp_.items():
        _, l, _ = colorsys.rgb_to_hls(*(int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)))
        t = min(1.0, max(0.0, (l - l0) / (l1 - l0)))
        out[k] = _snap((h0 + (h1 - h0) * t) / 360, l, s0 + (s1 - s0) * t)
    return out


def _on_bin(hexc):
    """The colour on the nearest centre of post.quantize's bins (8 a channel, centred at 8n + 4), kept blue over
    green: a tone between steps that the quantiser maps to itself."""
    c = [int(hexc[i:i + 2], 16) for i in (1, 3, 5)]
    r, g, b = (min(252, max(4, round((v - 4) / 8) * 8 + 4)) for v in c)
    return "#%02x%02x%02x" % (r, g, max(b, g + 16))


def palette_entries():
    out = {}
    for pre, b in BASES.items():
        for key, tag in (("wall", "W"), ("hull", "H"), ("trim", "T"), ("second", "S"), ("shade", "X")):
            r = ramp(f"{pre}{tag}", b[key], **({"offsets": OFFSETS[pre]} if pre in OFFSETS else {}))
            out.update(_tinted(r, TINT[pre]) if pre in TINT else r)
            if pre in OFFSETS and len(OFFSETS[pre]) > 7 and pre not in TINT:   # (an extra step on a centre of
                out[f"{pre}{tag}7"] = _on_bin(out[f"{pre}{tag}7"])  # the quantiser's bins: it keeps it, not a near
                                                                    # tone of another look's, and anti-aliases)
        r = ramp(f"{pre}F", b["floor"], offsets=(0.16, 0.1, 0.05, 0.0, -0.05, -0.1, -0.16))
        out.update(_tinted(r, TINT[pre]) if pre in TINT else r)
        out.update(TONES.get(pre, {}))
    return out


TONES = {"fB": {"fBG": "#1c2444"}}     # a look's own single tones (bastion's screen glass, a deep navy on a bin centre)


class Faction(Look):
    pre = ""
    shaded = True                    # the end pieces' section takes the shade ramp (the sets' dark navy cut end)

    def __init__(self):
        self.ramps = {"wall": f"{self.pre}W", "hull": f"{self.pre}H", "trim": f"{self.pre}T", "rose": f"{self.pre}S"}

    def relief(self, sprite):
        return None

    @property
    def pairs(self):
        """Its straight runs' designs (.a1 ..): every top design with every ramp design but the base pair, tops
        first."""
        st = self.relief(None)
        return [(t, r) for t in range(len(st.tops)) for r in range(max(1, len(st.ramps))) if t or r]

    def paint(self, P):
        if P.sprite.startswith("tile.floor"):
            s = FLOOR_STEP.get(P.name)
            return f"{self.pre}F{max(0, min(6, s))}" if s is not None else P.name
        if ".cap." in P.sprite and P.name == T.CUT:                   # the far hull's cap (wall3d.hull_cap): its cuts
            return T.CUT                                                # black, as the partitions' caps
        if (P.kind == "top" or P.name == T.CUT) and P.sprite.startswith("tile.wall."):   # a partition's top (cap or
            lv = "up" if ".full." in P.sprite else "low" if ".low." in P.sprite else "cut"   # cut) and the dark line
            if P.z >= W.wall_top("wall", lv) - 0.03:            # under it: black, as the default walls' (the
                return T.CUT                                    # header's top, 0.02 under the cap, too)
        end = P.sprite.partition(".end.")[2][:1]                       # s / e: the end piece's section faces y / x
        if (self.shaded and end and P.kind == ("y" if end == "s" else "x") and P.fam in ("wall", "hull")
                and P.role in STEP["x"]):
            return f"{self.pre}X{STEP['x'][P.role]}"
        return super().paint(P)


def _style(face, **kw):
    return Style(wall=face(False), hull=face(True), shade=0, **kw)   # (the +x faces only a step darker)
