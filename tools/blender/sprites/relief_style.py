"""What a look sets on the relief walls (wall3d.STYLE while one of its pieces builds): a typed record in place of the
free-form dict the looks used to pass, so every setting has one name, one default and one meaning. wall3d.style()
gives the current one (the defaults while a default wall builds; wall3d.STYLE itself stays None then)."""
from dataclasses import dataclass
from typing import Callable, Optional


@dataclass(frozen=True)
class Style:
    # the faces and the shell
    wall: Optional[Callable] = None       # a partition face's dressing (wall3d.wall_face's signature); None:
                                          # the default
    hull: Optional[Callable] = None       # the far hull face's (wall3d.hull_face's signature)
    ext: Optional[Callable] = None        # the exterior hull face's (wall3d_ext.ext_face's)
    shell: Optional[type] = None          # the Shell class the pieces build on; None: wall3d.Shell
    features: tuple = ()                  # the shell's features (faction.shell.LookShell: each a Feature)
    shade: Optional[int] = None           # how many ramp levels darker the +x side sits; None: wall3d.SHADE
    end_out: Optional[float] = None       # how far an end piece's section runs past the face's line (< 0: stops short
                                          # of it); None: wall3d.PX
    face_holes: Optional[Callable] = None  # (a, b, zs, top, top design) -> the openings cut in a face
                                           # [(u0, u1, z0, z1)]
    # the ramp
    skirt: Optional[str] = "panel"        # the dressing under each field: "panel" | "outline" | None (bare plates)
    seam: Optional[float] = None          # the plates' seams this far in from each tile edge (0: one plate a tile);
                                          # None: wall3d.STILE
    joint: Optional[int] = None           # the ramp level of the plates' joints, lit on the shade side too; None: the
                                          # default's dark joints (level 1, the shade side black)
    toe: Optional[str] = None             # a family for a band along the ramp's toe
    toe_at: float = 0.72                  # where down the ramp the toe band starts (a fraction of its run)
    foot: float = 0.0                     # the ramp ends in an upright face this high (0: it runs down to the floor)
    ramp_solid: bool = False              # the ramp built as one solid along each face
                                          # (faction.shell.LookShell.ramp) instead of the shell's height grid
    chamfer: Optional[float] = None       # an outer corner's chamfer along each axis (the shell must match); None:
                                          # square
    outline_lvl: int = 0                  # the outlined panel's seam level (skirt "outline")
    outline_round: bool = False           # ... its corners softened (each corner pixel left out)
    outline_d: tuple = (0.15, 0.62)       # ... its top and bottom down the ramp (fractions of the run)
    slot: bool = False                    # a dark handle slot in the outlined panel (the base design)
    slot_d: tuple = (0.5, 0.57, 0.1)      # ... painted: its top and bottom (fractions of the run) and half width
    slot_hole: Optional[tuple] = None     # ... cut into the ramp instead (the shell's holes): (top, bottom, half width)
    ramp_var: Optional[Callable] = None   # the look's own ramp designs (in place of its panel): wall3d.skirt's rv
    ramp_hole: Optional[Callable] = None  # (ramp design) -> the hole it opens in the ramp, or None
    hole_tone: Optional[Callable] = None  # (part "back" | "side", family, face axis, outward normal) -> the tone
                                          # a ramp design gives its hole's walls (the solid ramp's faces there)


DEFAULT = Style()
