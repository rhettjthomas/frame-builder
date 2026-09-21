import { describe, expect, it } from 'vitest';
import { findDeliverable } from '../src/core/deliverables';
import { frameName, MAX_ROW_WIDTH, PADDING, planFrames, type PlannedFrame } from '../src/core/layout';
import type { BuildItem } from '../src/core/messages';
import { stateFromPreset } from '../src/core/state';

/** The full Sermon Series checklist, as the dialog would hand it over. */
function sermonSeriesItems(): BuildItem[] {
  const state = stateFromPreset('sermon-series');
  return Object.entries(state.rows)
    .filter(([, row]) => row.checked)
    .map(([deliverableId, row]) => ({ deliverableId, quantity: row.quantity }));
}

function overlaps(a: PlannedFrame, b: PlannedFrame): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

describe('frameName', () => {
  it('matches the brief', () => {
    expect(frameName('Hope Has a Name', findDeliverable('story')!, 1)).toBe('Hope Has a Name_Story_01');
  });

  it('pads to two digits and keeps going past nine', () => {
    const carousel = findDeliverable('carousel')!;
    expect(frameName('Advent', carousel, 9)).toBe('Advent_Carousel_09');
    expect(frameName('Advent', carousel, 10)).toBe('Advent_Carousel_10');
  });
});

describe('planFrames', () => {
  const plan = planFrames('Hope Has a Name', sermonSeriesItems());

  it('plans one frame per requested copy', () => {
    expect(plan.frames.length).toBe(18);
  });

  it('never overlaps two frames', () => {
    for (let i = 0; i < plan.frames.length; i++) {
      for (let j = i + 1; j < plan.frames.length; j++) {
        const a = plan.frames[i];
        const b = plan.frames[j];
        expect(overlaps(a, b), `${a.name} overlaps ${b.name}`).toBe(false);
      }
    }
  });

  it('keeps every frame inside the section, padding included', () => {
    for (const f of plan.frames) {
      expect(f.x, f.name).toBeGreaterThanOrEqual(PADDING);
      expect(f.y, f.name).toBeGreaterThanOrEqual(PADDING);
      expect(f.x + f.width, f.name).toBeLessThanOrEqual(plan.width - PADDING);
      expect(f.y + f.height, f.name).toBeLessThanOrEqual(plan.height - PADDING);
    }
  });

  it('puts Screens above Social & Web', () => {
    const lastScreen = Math.max(
      ...plan.frames.filter((f) => f.group === 'screens').map((f) => f.y + f.height),
    );
    const firstSocial = Math.min(
      ...plan.frames.filter((f) => f.group !== 'screens').map((f) => f.y),
    );
    expect(firstSocial).toBeGreaterThan(lastScreen);
  });

  it('numbers per deliverable type rather than across the whole set', () => {
    const bg = plan.frames.filter((f) => f.deliverableId === 'bg');
    expect(bg.map((f) => f.index)).toEqual([1, 2, 3, 4]);
    const carousel = plan.frames.filter((f) => f.deliverableId === 'carousel');
    expect(carousel.map((f) => f.index)).toEqual([1, 2, 3, 4]);
  });

  it('wraps a row rather than running past the max width', () => {
    for (const f of plan.frames) {
      expect(f.x + f.width, f.name).toBeLessThanOrEqual(PADDING + MAX_ROW_WIDTH);
    }
  });

  it('keeps a multi-frame deliverable together on one row', () => {
    for (const id of ['bg', 'carousel', 'lower-third']) {
      const ys = new Set(plan.frames.filter((f) => f.deliverableId === id).map((f) => f.y));
      expect(ys.size, id).toBe(1);
    }
  });

  it('gives a multi-frame deliverable a row nothing else shares', () => {
    for (const id of ['bg', 'carousel', 'lower-third']) {
      const y = plan.frames.find((f) => f.deliverableId === id)!.y;
      const sharing = plan.frames.filter((f) => f.y === y && f.deliverableId !== id);
      expect(sharing.map((f) => f.name), id).toEqual([]);
    }
  });

  it('lays the whole Sermon Series set out in five rows', () => {
    const rows = new Set(plan.frames.map((f) => f.y));
    expect(rows.size).toBe(5);
  });

  it('carries the fill and safe margin from the library', () => {
    const lowerThird = plan.frames.find((f) => f.deliverableId === 'lower-third')!;
    expect(lowerThird.fill).toBe(false);
    expect(lowerThird.safe).toEqual({ sides: 0, ends: 0 });
    const story = plan.frames.find((f) => f.deliverableId === 'story')!;
    expect(story.fill).toBe(true);
    expect(story.safe).toEqual({ sides: 100, ends: 250 });
  });

  it('routes Web to its own export group', () => {
    expect(plan.frames.find((f) => f.deliverableId === 'web')!.group).toBe('web');
  });
});

describe('planFrames edge cases', () => {
  it('plans nothing for an empty checklist', () => {
    const plan = planFrames('Hope Has a Name', []);
    expect(plan.frames).toEqual([]);
    expect(plan.width).toBe(PADDING * 2);
  });

  it('ignores a deliverable id that is no longer in the library', () => {
    const plan = planFrames('Hope', [{ deliverableId: 'retired-size', quantity: 2 }]);
    expect(plan.frames).toEqual([]);
  });

  it('clamps a quantity that arrived out of range', () => {
    const plan = planFrames('Hope', [{ deliverableId: 'bg', quantity: 99 }]);
    expect(plan.frames.length).toBe(findDeliverable('bg')!.quantity!.max);
  });

  it('gives a single Social & Web deliverable the top band', () => {
    const plan = planFrames('Hope', [{ deliverableId: 'story', quantity: 1 }]);
    expect(plan.frames[0].y).toBe(PADDING);
  });

  it('wraps a multi-frame deliverable that cannot fit one row', () => {
    const plan = planFrames('Hope', [{ deliverableId: 'bg', quantity: 4 }]);
    const widths = plan.frames[0].width * 4 + 200 * 3;
    expect(widths).toBeLessThanOrEqual(MAX_ROW_WIDTH);
    expect(new Set(plan.frames.map((f) => f.y)).size).toBe(1);
  });

  it('sizes the section around one frame', () => {
    const plan = planFrames('Hope', [{ deliverableId: 'square', quantity: 1 }]);
    const square = findDeliverable('square')!;
    expect(plan.width).toBe(PADDING * 2 + square.width);
    expect(plan.height).toBe(PADDING * 2 + square.height);
  });
});
