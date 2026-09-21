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
  it('separates the number with a space, so Figma increments it on duplicate', () => {
    expect(frameName('Hope Has a Name', findDeliverable('story')!, 1)).toBe('Hope Has a Name_Story 01');
  });

  it('pads to two digits and keeps going past nine', () => {
    const carousel = findDeliverable('carousel')!;
    expect(frameName('Advent', carousel, 9)).toBe('Advent_Carousel 09');
    expect(frameName('Advent', carousel, 10)).toBe('Advent_Carousel 10');
  });

  it('keeps the series and deliverable joined by an underscore', () => {
    const name = frameName('Hope Has a Name', findDeliverable('post-bg')!, 2);
    expect(name.split('_')).toEqual(['Hope Has a Name', 'PostBG 02']);
  });

  it('prefixes the master folder and the group, so the package arrives whole', () => {
    expect(frameName('Hope Has a Name', findDeliverable('story')!, 1, true)).toBe(
      'HOPE HAS A NAME/SOCIAL MEDIA/Hope Has a Name_Story 01',
    );
    expect(frameName('Hope', findDeliverable('hero-4k')!, 1, true)).toBe(
      'HOPE/SCREENS/Hope_Hero 4K 01',
    );
    expect(frameName('Hope', findDeliverable('web')!, 1, true)).toBe('HOPE/WEB/Hope_Web 01');
  });

  it('cleans a series name a file system would refuse, in the folder only', () => {
    const name = frameName('Faith/Works', findDeliverable('story')!, 1, true);
    expect(name).toBe('FAITH-WORKS/SOCIAL MEDIA/Faith/Works_Story 01');
  });

  it('leaves the name alone when the prefix is off, which is the default', () => {
    expect(frameName('Hope', findDeliverable('story')!, 1)).toBe('Hope_Story 01');
    expect(frameName('Hope', findDeliverable('story')!, 1, false)).toBe('Hope_Story 01');
  });
});

describe('planFrames', () => {
  const plan = planFrames('Hope Has a Name', sermonSeriesItems());

  it('plans one frame per requested copy', () => {
    expect(plan.frames.length).toBe(20);
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
      ...plan.frames.filter((f) => f.folder === 'SCREENS').map((f) => f.y + f.height),
    );
    const firstSocial = Math.min(
      ...plan.frames.filter((f) => f.folder !== 'SCREENS').map((f) => f.y),
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

  it('keeps both covers on the row of single social frames', () => {
    const web = plan.frames.find((f) => f.deliverableId === 'web')!;
    for (const id of ['youtube-cover', 'facebook-cover']) {
      expect(plan.frames.find((f) => f.deliverableId === id)!.y, id).toBe(web.y);
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

  it('routes Web to its own delivery folder', () => {
    expect(plan.frames.find((f) => f.deliverableId === 'web')!.folder).toBe('WEB');
  });
});

describe('the folder prefix', () => {
  it('reaches every planned frame, with both folder levels', () => {
    const plan = planFrames('Hope Has a Name', sermonSeriesItems(), true);
    for (const f of plan.frames) {
      expect(f.name.startsWith('HOPE HAS A NAME/'), f.name).toBe(true);
      expect(f.name.split('/').length, f.name).toBe(3);
    }
  });

  it('gives every frame the same master folder, so they land together', () => {
    const plan = planFrames('Hope Has a Name', sermonSeriesItems(), true);
    const masters = new Set(plan.frames.map((f) => f.name.split('/')[0]));
    expect([...masters]).toEqual(['HOPE HAS A NAME']);
  });

  it('does not move anything, since the name is all that changes', () => {
    const plain = planFrames('Hope', sermonSeriesItems());
    const prefixed = planFrames('Hope', sermonSeriesItems(), true);
    expect(prefixed.frames.map((f) => [f.x, f.y])).toEqual(plain.frames.map((f) => [f.x, f.y]));
    expect(prefixed.width).toBe(plain.width);
    expect(prefixed.height).toBe(plain.height);
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
