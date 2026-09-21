import { describe, expect, it } from 'vitest';
import { safeGrids } from '../src/main/builder';

describe('safeGrids', () => {
  it('draws no grid when there is no safe margin', () => {
    expect(safeGrids({ sides: 0, ends: 0 })).toEqual([]);
  });

  it('carries the side margin on a stretched COLUMNS grid', () => {
    const grids = safeGrids({ sides: 100, ends: 0 });
    expect(grids).toHaveLength(1);
    expect(grids[0]).toMatchObject({ pattern: 'COLUMNS', alignment: 'STRETCH', count: 1, offset: 100 });
  });

  it('carries the top and bottom margin on a stretched ROWS grid', () => {
    const grids = safeGrids({ sides: 0, ends: 250 });
    expect(grids).toHaveLength(1);
    expect(grids[0]).toMatchObject({ pattern: 'ROWS', alignment: 'STRETCH', count: 1, offset: 250 });
  });

  it('pairs both grids for an asymmetric margin', () => {
    const grids = safeGrids({ sides: 100, ends: 250 });
    expect(grids.map((g) => g.pattern)).toEqual(['COLUMNS', 'ROWS']);
    expect(grids.every((g) => g.visible)).toBe(true);
  });

  it('never leaves a gutter, so the offset is the whole margin', () => {
    for (const grid of safeGrids({ sides: 100, ends: 250 })) {
      expect(grid).toMatchObject({ gutterSize: 0 });
    }
  });
});
