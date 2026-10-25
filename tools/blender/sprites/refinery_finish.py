"""Refinery material roles, independent of its approved geometry.

Muted bin-yellow on industrial hardware; blue-grey vessel, graphite castings
and pale working steel. Only the display gauges are self-lit in this preview.
"""
from . import core

PREFIX='refinery.finish.'
PALETTE={
    PREFIX+'vessel':{'hex':'#536c7b'},
    PREFIX+'lid':{'hex':'#637b86'},
    PREFIX+'yellow':{'hex':'#b6a45d'},
    PREFIX+'frame':{'hex':'#303b44'},
    PREFIX+'steel':{'hex':'#87979f'},
    PREFIX+'pipe':{'hex':'#99a5a6'},
    PREFIX+'dark':{'hex':'#222c32'},
    PREFIX+'billet':{'hex':'#b3bdc2'},
    PREFIX+'screen':{'hex':'#172b35'},
    PREFIX+'display':{'hex':'#70c5cc'},
}


class FinishMesh(core.Mesh):
    def __init__(self,name,finished=False):
        super().__init__(name)
        self.finished=finished;self.role='frame'

    def paint(self,role):
        self.role=role

    def _cols(self,color):
        if not self.finished: return super()._cols(color)
        if color=='refinery.blockout.grey': color=PREFIX+self.role
        elif color=='refinery.terminal.screen': color=PREFIX+'screen'
        elif color=='refinery.terminal.ui':
            c=core.lin(PREFIX+'display')
            return (0,0,0),c,tuple(x*.25 for x in c)
        return super()._cols(color)
