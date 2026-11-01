"""
Drawing aid for hand-made ship templates (dev tool, not shipped). A layout is still drawn by hand: you choose every room,
door, beam and module position; this only saves typing the row strings.

    s = Ship('W2 SPINE HAULER', 35, 25, crew, 'one-line pitch')
    s.room(24, 4, 33, 20)                 # walls on the rectangle's edge, floor inside; overlapping rooms merge
    hull(s, [(x, ylo, yhi), ...])         # an outline from column extents (stepped noses, tapers): edge ring = wall
    vline(s, 8, 0, 24); hline(...)        # interior walls (only over floor)
    s.door(8, 12); s.beam(15, 5, 23, 5)   # doors, exposed frame (Beam tiles)
    box(s, 15, 6, 0, 's')                 # a sealed 2x4 container on its own beam cells, clamped south
    s.section('Cockpit: helm and consoles')  # a comment heading the modules that follow
    s.m('helm', 4, 8); s.lights((3, 10), ...)
    emit('tools/shipgen/starters/wayfarer.ts', [s, ...])   # the variant file the sheet CLI reads
    show(s)                               # print the grid with a coordinate ruler (module anchors as *)

Then: node tools/shipgen/cli.js --templates tools/shipgen/starters/wayfarer.ts   (see docs/SHIPGEN_HANDOFF.md)
"""
import json

class Ship:
    def __init__(self, name, w, h, crew, note=''):
        self.name, self.w, self.h, self.crew, self.note = name, w, h, crew, note
        self.g = [['.'] * w for _ in range(h)]
        self.mods = []
        self.marks = []

    def room(self, x0, y0, x1, y1):
        """A room: walls on the rectangle's edge (only over space), floor inside (always, so overlapping rooms merge)."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if x in (x0, x1) or y in (y0, y1):
                    if self.g[y][x] in '.=': self.g[y][x] = '#'
                else:
                    self.g[y][x] = '_'
        return self

    def open(self, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.g[y][x] = '_'

    def clear(self, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.g[y][x] = '.'

    def door(self, x, y): self.g[y][x] = 'D'

    def beam(self, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if self.g[y][x] == '.': self.g[y][x] = '='

    def section(self, comment): self.marks.append((comment, len(self.mods)))

    def m(self, d, x, y, rot=0, **kw):
        """A module: 'helm' means 'module.helm'; ids starting with module. or container. are used as given."""
        e = {'def': d if d.startswith(('module.', 'container.')) else 'module.' + d, 'x': x, 'y': y, 'rot': rot}
        e.update(kw)
        self.mods.append(e)

    def lights(self, *pts):
        for x, y in pts: self.m('light', x, y)

    def rows(self): return [''.join(r) for r in self.g]


def hull(s, cols):
    """Outline from columns: (x, ylo, yhi) inclusive extents (walls included). The outer ring (8-neighbour edge) becomes
    wall, the rest floor, merged with what is already drawn. Several entries for one x make separate parts (prongs, jaws)."""
    inside = set()
    for x, ylo, yhi in cols:
        for y in range(ylo, yhi + 1): inside.add((x, y))
    for (x, y) in inside:
        edge = any((x + dx, y + dy) not in inside for dx in (-1, 0, 1) for dy in (-1, 0, 1))
        if edge:
            if s.g[y][x] in '.=': s.g[y][x] = '#'
        else:
            s.g[y][x] = '_'


def hline(s, x0, x1, y):
    for x in range(x0, x1 + 1):
        if s.g[y][x] == '_': s.g[y][x] = '#'


def vline(s, x, y0, y1):
    for y in range(y0, y1 + 1):
        if s.g[y][x] == '_': s.g[y][x] = '#'


def box(s, x, y, rot=0, clamp='n', big=False):
    """A sealed container (2x4, or 3x6 with big) on beam cells of its own, clamped by a short end (n, e, s, w)."""
    w, h = (3, 6) if big else (2, 4)
    if rot % 2: w, h = h, w
    s.beam(x, y, x + w - 1, y + h - 1)
    s.m('container.3x6' if big else 'container.2x4', x, y, rot, clamp=clamp)


def show(s):
    """Print the grid with a coordinate ruler; module anchors show as *."""
    print('   ' + ''.join(str(x // 10) for x in range(s.w)))
    print('   ' + ''.join(str(x % 10) for x in range(s.w)))
    occ = {(m['x'], m['y']): '*' for m in s.mods}
    for y, r in enumerate(s.rows()):
        print(f'{y:2d} ' + ''.join(occ.get((x, y), c) for x, c in enumerate(r)))


def _js(v):
    if isinstance(v, str): return "'" + v.replace("'", "\\'") + "'"
    if isinstance(v, list): return '[' + ', '.join(_js(x) for x in v) + ']'
    if isinstance(v, dict): return '{ ' + ', '.join(f'{k}: {_js(x)}' for k, x in v.items()) + ' }'
    return json.dumps(v)


def template_ts(s, indent='    '):
    """The template object literal (name, crew, rows, modules with their section comments)."""
    marks = list(s.marks)
    if not marks or marks[0][1] > 0: marks = [('Containers and frame' if any(m['def'].startswith('container.') for m in s.mods[:marks[0][1] if marks else None]) else 'Modules', 0)] + marks
    out = [f"{indent}name: {_js(s.name)}, crew: {_js(s.crew)},", f'{indent}rows: [']
    out += [f"{indent}  '{r}'," for r in s.rows()]
    out += [f'{indent}],', f'{indent}modules: [']
    for i, (comment, a) in enumerate(marks):
        b = marks[i + 1][1] if i + 1 < len(marks) else len(s.mods)
        out.append(f'{indent}  // {comment}')
        out += [f'{indent}  {_js(m)},' for m in s.mods[a:b]]
    out.append(f'{indent}],')
    return '\n'.join(out)


def emit(path, ships, doc='Hand-drawn layout variants (#241)'):
    """Write a variants file for `node tools/shipgen/cli.js --templates <path>`. Generated: edit the .py next to it."""
    body = ',\n'.join(f"  {{\n    name: {_js(s.name)}, note: {_js(s.note)},\n    template: {{\n{template_ts(s, '      ')}\n    }},\n  }}" for s in ships)
    open(path, 'w').write(f"""import type {{ Variant }} from '../templates';

/** {doc}. Generated by the .py file of the same name (tools/shipgen/templateDraw.py): edit that, then run it. */
export const variants: Variant[] = [
{body},
];
""")


class Shift:
    """Draw a block (a hab, an engine room) at an offset: Shift(s, dx, dy).m('helm', 4, 8) places it at (4 + dx, 8 + dy)."""
    def __init__(self, s, dx, dy): self.s, self.dx, self.dy = s, dx, dy
    def room(self, x0, y0, x1, y1): self.s.room(x0 + self.dx, y0 + self.dy, x1 + self.dx, y1 + self.dy)
    def door(self, x, y): self.s.door(x + self.dx, y + self.dy)
    def beam(self, x0, y0, x1, y1): self.s.beam(x0 + self.dx, y0 + self.dy, x1 + self.dx, y1 + self.dy)
    def m(self, d, x, y, rot=0, **kw): self.s.m(d, x + self.dx, y + self.dy, rot, **kw)
    def lights(self, *pts): self.s.lights(*[(x + self.dx, y + self.dy) for x, y in pts])
    def section(self, c): self.s.section(c)
    def hull(self, cols): hull(self.s, [(x + self.dx, a + self.dy, b + self.dy) for x, a, b in cols])
    def vline(self, x, y0, y1): vline(self.s, x + self.dx, y0 + self.dy, y1 + self.dy)
    def hline(self, x0, x1, y): hline(self.s, x0 + self.dx, x1 + self.dx, y + self.dy)
    def box(self, x, y, rot=0, clamp='n', big=False): box(self.s, x + self.dx, y + self.dy, rot, clamp, big)
