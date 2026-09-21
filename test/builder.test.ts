import { describe, expect, it } from 'vitest';
import { safeGrids } from '../src/main/builder';

/** The band a grid describes, as an inset from one edge. */
function describeBand(grid: LayoutGrid) {
  if (grid.pattern === 'GRID') throw new Error('Unexpected uniform grid');
  return { pattern: grid.pattern, alignment: grid.alignment, size: grid.sectionSize };
}

describe('safeGrids', () => {
  it('draws no band when there is no safe margin', () => {
    expect(safeGrids({ sides: 0, ends: 0 })).toEqual([]);
  });

  it('pins a band to each side, leaving the safe area clear', () => {
    const grids = safeGrids({ sides: 100, ends: 0 });
    expect(grids.map(describeBand)).toEqual([
      { pattern: 'COLUMNS', alignment: 'MIN', size: 100 },
      { pattern: 'COLUMNS', alignment: 'MAX', size: 100 },
    ]);
  });

  it('pins a band to the top and the bottom', () => {
    const grids = safeGrids({ sides: 0, ends: 250 });
    expect(grids.map(describeBand)).toEqual([
      { pattern: 'ROWS', alignment: 'MIN', size: 250 },
      { pattern: 'ROWS', alignment: 'MAX', size: 250 },
    ]);
  });

  it('draws all four edges for an asymmetric margin', () => {
    const grids = safeGrids({ sides: 100, ends: 250 });
    expect(grids).toHaveLength(4);
    expect(grids.map(describeBand)).toEqual([
      { pattern: 'COLUMNS', alignment: 'MIN', size: 100 },
      { pattern: 'COLUMNS', alignment: 'MAX', size: 100 },
      { pattern: 'ROWS', alignment: 'MIN', size: 250 },
      { pattern: 'ROWS', alignment: 'MAX', size: 250 },
    ]);
  });

  it('sits flush against the edge, with one section and no gutter', () => {
    for (const grid of safeGrids({ sides: 100, ends: 250 })) {
      expect(grid).toMatchObject({ count: 1, offset: 0, gutterSize: 0, visible: true });
    }
  });

  it('marks the unsafe edge at 30 percent, not Figma default faintness', () => {
    for (const grid of safeGrids({ sides: 100, ends: 250 })) {
      expect(grid.color?.a).toBe(0.3);
    }
  });
});
