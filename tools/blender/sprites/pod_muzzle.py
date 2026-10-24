"""Where the mining pod's laser barrel tip is in a `vehicle.mining_pod.mine.d<k>.f<j>` frame, in sprite px from the anchor.

Pure Python (no bpy), so pack.py can call it without Blender. The projection is the art camera's (2:1 iso: x = (u_x - u_y) * TILE_W / 2,
y = (u_x + u_y) * TILE_H / 2 - z * ZPX), the geometry is mining_pod.laser (pivot LASER_U, LASER_Z; barrel pitched down 60 degrees while
mining; the emitter face 0.71 along it) plus the frame's bob. The game projects the same geometry (src/render/podMuzzle.ts; its test holds the measured tips) and agrees with the sheet within
a few px; once a render has run, the manifest's `muzzle` is the source and the table can go."""
import math
import re

from .scale import TILE_H, TILE_W

LASER_U, LASER_Z = 0.98, 0.54          # mining_pod.py: LASER_U, LASER_Z = WIND_ZB - 0.2 (WIND_ZB = C - 0.44, C = 1.18)
BARREL = 0.71                          # the pivot to the emitter face
PITCH = math.radians(60)               # mining pose: barrel pitched down this far
BOB = (0.0, 0.03)                      # mining_pod_family.BOB: the two frames' lift
ZPX = TILE_W / 2 * math.sqrt(2) * math.cos(math.radians(30))     # core.ZPX: px per tile of height


def muzzle_px(sid):
    """[x, y] of the barrel tip for a `vehicle.mining_pod.mine.d<k>.f<j>` id, else None."""
    m = re.fullmatch(r"vehicle\.mining_pod\.mine\.d(\d)\.f(\d)", sid)
    if not m:
        return None
    heading = int(m.group(1)) * math.pi / 4
    u = LASER_U + BARREL * math.cos(PITCH)
    z = LASER_Z - BARREL * math.sin(PITCH) + BOB[int(m.group(2))]
    ux, uy = math.cos(heading) * u, math.sin(heading) * u
    return [round((ux - uy) * TILE_W / 2, 1), round((ux + uy) * TILE_H / 2 - z * ZPX, 1)]
