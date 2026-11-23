/**
 * Trim spare outer plating to a one-tile hull (salvage builds, user decision): welding donor sections together leaves slabs of solid
 * hull several tiles thick around the rooms. A wall tile goes to space when no floor, door or other fitted tile is among its eight
 * neighbours and it touches space, repeated until nothing more goes; so every room keeps its one wall and the trim only eats in from
 * outside (wall mass enclosed between rooms stays). Deterministic; returns new rows and how many tiles went.
 */
export function erodeHull(rows: readonly string[], width: number): { rows: string[]; trimmed: number } {
  const h = rows.length;
  const cells = rows.flatMap((r) => Array.from({ length: width }, (_, x) => r[x] ?? '.'));
  const at = (x: number, y: number): string => (x < 0 || y < 0 || x >= width || y >= h ? '.' : (cells[y * width + x] as string));
  // Anything but wall or space is something a wall must hold in (floor, doors, beams, fitted tiles).
  const inner = (c: string): boolean => c !== '#' && c !== '.';
  const spare = (x: number, y: number): boolean => {
    if (at(x, y) !== '#') return false;
    let space = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const c = at(x + dx, y + dy);
      if (inner(c)) return false;
      if (c === '.' && (dx === 0 || dy === 0)) space = true;
    }
    return space;
  };
  let trimmed = 0;
  let queue: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < width; x++) if (spare(x, y)) queue.push(y * width + x);
  while (queue.length > 0) {
    const next = new Set<number>();
    for (const i of queue) {
      const x = i % width;
      const y = Math.floor(i / width);
      if (!spare(x, y)) continue;
      cells[i] = '.';
      trimmed++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (spare(x + dx, y + dy)) next.add((y + dy) * width + x + dx);
    }
    queue = [...next];
  }
  const out: string[] = [];
  for (let y = 0; y < h; y++) out.push(cells.slice(y * width, y * width + width).join('').slice(0, (rows[y] as string).length));
  return { rows: out, trimmed };
}

