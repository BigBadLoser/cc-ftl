"""Shared bits of the starter variant builders (see tools/shipgen/templateDraw.py)."""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
from templateDraw import Ship, Shift, hull, hline, vline, box, show, emit  # noqa: E402,F401

HERE = os.path.dirname(os.path.abspath(__file__))
GALLEY = {'orders': [{'recipe': 'recipe.ration', 'mode': 'keep', 'target': 12}]}
STOCK_BUILD = [{'item': 'item.metal', 'count': 60}, {'item': 'item.electronics', 'count': 20}, {'item': 'item.polymer', 'count': 20}]
STOCK_ARMS = [{'item': 'item.rifle', 'count': 1}, {'item': 'item.sidearm', 'count': 2}, {'item': 'item.blade', 'count': 1}, {'item': 'item.fuel', 'count': 16}, {'item': 'item.water', 'count': 30}, {'item': 'item.oxygen', 'count': 20}]


def tagged(s, kind):
    s.kind = kind
    return s


def write(name, ships, doc):
    emit(os.path.join(HERE, name + '.ts'), ships, doc)
    # the kind label goes into the variant entry
    path = os.path.join(HERE, name + '.ts')
    t = open(path).read()
    for sh in ships:
        k = getattr(sh, 'kind', None)
        if k: t = t.replace(f"    name: '{sh.name}', note:", f"    name: '{sh.name}', kind: '{k}', note:", 1)
    open(path, 'w').write(t)
