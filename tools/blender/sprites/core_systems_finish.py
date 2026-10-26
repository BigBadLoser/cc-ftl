"""Material roles for the approved core-system geometry; no vertex changes.

Grey is the default, preserving all earlier previews byte for byte. Emission
belongs only to designated display/inspection faces, never the whole housing.
"""
from . import core

PREFIX = 'systems.finish.'
PALETTE = {PREFIX + k: {'hex': v} for k, v in {
    'shield': '#566e80', 'crown': '#718594', 'frame': '#303e49',
    'steel': '#8d9fa6', 'yellow': '#b6a45d', 'dark': '#222e36',
    'screen': '#1c3038', 'pale': '#b6c2c5', 'cartridge': '#7c969b',
    'teal': '#46787c', 'vent_teal': '#447d94', 'core_light': '#76c5dc',
    'display': '#80c8b8', 'amber': '#cdb86c',
}.items()}
GREYS = {'systems.blockout.body': 'body', 'systems.blockout.frame': 'frame',
         'systems.blockout.recess': 'recess'}


class FinishMesh(core.Mesh):
    def __init__(self, name, finished=False, powered=True):
        super().__init__(name)
        self.finished, self.powered = finished, powered
        self.paint()

    def paint(self, body='steel', frame='frame', recess='dark'):
        self.roles = {'body': body, 'frame': frame, 'recess': recess}

    def _cols(self, color):
        if not self.finished or color not in GREYS:
            return super()._cols(color)
        role = self.roles[GREYS[color]]
        if role in ('core_light', 'display', 'amber'):
            if not self.powered: return super()._cols(PREFIX + 'screen')
            c = core.lin(PREFIX + role)
            glow = .18 if role == 'core_light' else .22
            return (0, 0, 0), c, tuple(v * glow for v in c)
        return super()._cols(PREFIX + role)
