import { describe, expect, it } from 'vitest';
import {
  buildLibrary,
  clampQuantity,
  customToDeliverable,
  DELIVERABLES,
  deliverablesIn,
  findDeliverable,
  findIn,
  formatSafe,
  formatSize,
  isCustomId,
  type CustomDeliverable,
} from '../src/core/deliverables';

describe('the shipped library', () => {
  it('has unique ids', () => {
    const ids = DELIVERABLES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers both checklist sections', () => {
    const library = buildLibrary();
    expect(deliverablesIn(library, 'screens').length).toBeGreaterThan(0);
    expect(deliverablesIn(library, 'social-web').length).toBeGreaterThan(0);
  });

  it('gives every deliverable a positive size', () => {
    for (const d of DELIVERABLES) {
      expect(d.width, d.id).toBeGreaterThan(0);
      expect(d.height, d.id).toBeGreaterThan(0);
    }
  });

  it('keeps quantity ranges coherent', () => {
    for (const d of DELIVERABLES) {
      if (!d.quantity) continue;
      const { min, max, default: def } = d.quantity;
      expect(min, d.id).toBeGreaterThan(0);
      expect(max, d.id).toBeGreaterThanOrEqual(min);
      expect(def, d.id).toBeGreaterThanOrEqual(min);
      expect(def, d.id).toBeLessThanOrEqual(max);
    }
  });

  it('routes Web to its own export folder and the rest of social to social', () => {
    expect(findDeliverable('web')?.group).toBe('web');
    expect(findDeliverable('story')?.group).toBe('social');
  });

  it('builds lower thirds with no fill so they export transparent', () => {
    const lowerThird = findDeliverable('lower-third');
    expect(lowerThird?.fill).toBe(false);
    expect(lowerThird?.format).toBe('PNG');
  });

  it('fills every other deliverable', () => {
    for (const d of DELIVERABLES) {
      if (d.id === 'lower-third') continue;
      expect(d.fill, d.id).toBe(true);
    }
  });
});

describe('clampQuantity', () => {
  const carousel = findDeliverable('carousel')!;
  const hero = findDeliverable('hero-4k')!;

  it('holds a quantity inside its range', () => {
    expect(clampQuantity(carousel, 3)).toBe(3);
  });

  it('clamps past either end', () => {
    expect(clampQuantity(carousel, 0)).toBe(carousel.quantity!.min);
    expect(clampQuantity(carousel, 99)).toBe(carousel.quantity!.max);
  });

  it('rounds a fractional quantity', () => {
    expect(clampQuantity(carousel, 3.6)).toBe(4);
  });

  it('falls back to the default when the number is not usable', () => {
    expect(clampQuantity(carousel, Number.NaN)).toBe(carousel.quantity!.default);
  });

  it('always returns 1 for a single-frame deliverable', () => {
    expect(clampQuantity(hero, 5)).toBe(1);
  });
});

describe('formatting', () => {
  it('reads out a size', () => {
    expect(formatSize(findDeliverable('post')!)).toBe('1080 × 1350');
  });

  it('describes a symmetric margin once', () => {
    expect(formatSafe({ sides: 100, ends: 100 })).toBe('100 all sides');
  });

  it('splits an asymmetric margin', () => {
    expect(formatSafe({ sides: 100, ends: 250 })).toBe('250 top/bottom, 100 sides');
  });

  it('names the absence of a margin', () => {
    expect(formatSafe({ sides: 0, ends: 0 })).toBe('No safe margin');
  });
});

describe('custom sizes', () => {
  const custom: CustomDeliverable = {
    id: 'custom:abc',
    name: 'Bulletin Insert',
    section: 'social-web',
    width: 1275,
    height: 1650,
    safe: { sides: 75, ends: 75 },
    quantity: 1,
  };

  it('recognises its own ids and nothing else', () => {
    expect(isCustomId('custom:abc')).toBe(true);
    expect(isCustomId('story')).toBe(false);
  });

  it('joins the library after the shipped deliverables', () => {
    const library = buildLibrary([custom]);
    expect(library).toHaveLength(DELIVERABLES.length + 1);
    expect(library[library.length - 1].id).toBe('custom:abc');
  });

  it('is found like any other deliverable once it is in the library', () => {
    expect(findIn(buildLibrary([custom]), 'custom:abc')?.name).toBe('Bulletin Insert');
    expect(findIn(buildLibrary([custom]), 'story')?.name).toBe('Story');
  });

  it('stays out of the shipped library, which presets and rules depend on', () => {
    expect(findDeliverable('custom:abc')).toBeUndefined();
    expect(buildLibrary()).toHaveLength(DELIVERABLES.length);
  });

  it('delivers to SCREENS or SOCIAL MEDIA depending on its section', () => {
    expect(customToDeliverable({ ...custom, section: 'screens' }).group).toBe('screens');
    expect(customToDeliverable({ ...custom, section: 'social-web' }).group).toBe('social');
  });

  it('is filled and photographic, like most of the library', () => {
    const d = customToDeliverable(custom);
    expect(d.fill).toBe(true);
    expect(d.format).toBe('JPG');
  });

  it('gets no quantity control when it only wants one frame', () => {
    expect(customToDeliverable(custom).quantity).toBeNull();
  });

  it('gets a quantity range when it wants several', () => {
    const d = customToDeliverable({ ...custom, quantity: 3 });
    expect(d.quantity).toEqual({ default: 3, min: 1, max: 10 });
  });

  it('shows its size and margin the same way as anything else', () => {
    const d = customToDeliverable(custom);
    expect(formatSize(d)).toBe('1275 × 1650');
    expect(formatSafe(d.safe)).toBe('75 all sides');
    expect(clampQuantity(d, 5)).toBe(1);
  });
});
