"""Review poses for the approved refinery; no sim or renderer integration."""
from dataclasses import replace


def operating_pose(parameters,state,frame=0):
    if state=='idle': return parameters
    if state=='unpowered':
        return replace(parameters,display_power=False,work_frame=-1,
                       gate_closed=True,gate_travel=0)
    if state=='working':
        assert frame in range(4)
        return replace(parameters,display_power=True,work_frame=frame,
                       gate_closed=False,gate_travel=(0,.035,.070,.035)[frame],
                       billet_u=(1.33,1.48,1.63,1.63)[frame],show_billet=frame!=3)
    raise ValueError(state)
