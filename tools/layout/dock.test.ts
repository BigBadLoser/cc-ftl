import { describe, expect, it } from 'vitest';
import { DEFAULT_DOCK, MIN_RECT, dockOpen, dockReducer, floating, panelsIn, parseDock } from './dock';

describe('dock reducer', () => {
  it('docks a floating panel and expands it', () => {
    const s = dockReducer(dockReducer(DEFAULT_DOCK, { type: 'collapse', id: 'preview', collapsed: true }), { type: 'dock', id: 'preview', dock: 'right' });
    expect(s.panels.preview.place).toBe('right');
    expect(s.panels.preview.collapsed).toBe(false);
    expect(panelsIn(s, 'right')).toEqual(['layers', 'preview']);
    expect(floating(s)).toEqual([]);
  });
  it('floats a panel at a rect, clamped to a usable size, and keeps the rect while docked', () => {
    let s = dockReducer(DEFAULT_DOCK, { type: 'float', id: 'palette', rect: { x: -30, y: 12.4, w: 50, h: 50 } });
    expect(s.panels.palette.place).toBe('float');
    expect(s.panels.palette.rect).toEqual({ x: 0, y: 12, w: MIN_RECT.w, h: MIN_RECT.h });
    s = dockReducer(s, { type: 'dock', id: 'palette', dock: 'bottom' });
    expect(s.panels.palette.rect.y).toBe(12);
  });
  it('a dock is closed when every panel in it is collapsed', () => {
    expect(dockOpen(DEFAULT_DOCK, 'left')).toBe(true);
    const s = dockReducer(DEFAULT_DOCK, { type: 'collapse', id: 'palette' });
    expect(s.panels.palette.collapsed).toBe(true);
    expect(dockOpen(s, 'left')).toBe(false);
    expect(dockOpen(s, 'bottom')).toBe(false);
    expect(dockReducer(s, { type: 'collapse', id: 'palette' }).panels.palette.collapsed).toBe(false);
  });
  it('limits dock sizes and does not change its input', () => {
    const s = dockReducer(DEFAULT_DOCK, { type: 'size', dock: 'left', size: 99 });
    expect(s.sizes.left).toBe(60);
    expect(DEFAULT_DOCK.sizes.left).toBe(17);
    expect(dockReducer(s, { type: 'reset' })).toEqual(DEFAULT_DOCK);
  });
  it('survives a round trip and ignores malformed saves', () => {
    const s = dockReducer(DEFAULT_DOCK, { type: 'dock', id: 'preview', dock: 'bottom' });
    expect(parseDock(JSON.stringify(s))).toEqual(s);
    expect(parseDock('{nope')).toEqual(DEFAULT_DOCK);
    expect(parseDock(null)).toEqual(DEFAULT_DOCK);
    const odd = parseDock(JSON.stringify({ panels: { palette: { place: 'moon', rect: { x: 'a' } } }, sizes: { left: 'wide' } }));
    expect(odd).toEqual(DEFAULT_DOCK);
  });
});
