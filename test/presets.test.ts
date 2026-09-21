import { describe, expect, it } from 'vitest';
import { findDeliverable } from '../src/core/deliverables';
import { DEFAULT_PRESET_ID, findPreset, presetIncludes, presetQuantity, SHIPPED_PRESETS } from '../src/core/presets';

describe('shipped presets', () => {
  it('ships the three the brief calls for', () => {
    expect(SHIPPED_PRESETS.map((p) => p.id)).toEqual(['sermon-series', 'event-launch', 'custom']);
  });

  it('defaults to Sermon Series', () => {
    expect(findPreset(DEFAULT_PRESET_ID)?.name).toBe('Sermon Series');
  });

  it('gives Event Launch the hero, one lower third, and the social set', () => {
    const preset = findPreset('event-launch')!;
    expect(presetIncludes(preset, findDeliverable('hero-4k')!)).toBe(true);
    expect(presetIncludes(preset, findDeliverable('lower-third')!)).toBe(true);
    expect(presetQuantity(preset, findDeliverable('lower-third')!)).toBe(1);
    for (const id of ['square', 'post', 'post-bg', 'story', 'story-bg', 'web', 'carousel']) {
      expect(presetIncludes(preset, findDeliverable(id)!), id).toBe(true);
    }
    expect(presetIncludes(preset, findDeliverable('bg')!)).toBe(false);
  });

  it('defaults the two covers on for Sermon Series and off everywhere else', () => {
    for (const id of ['youtube-cover', 'facebook-cover']) {
      expect(presetIncludes(findPreset('sermon-series')!, findDeliverable(id)!), id).toBe(true);
      expect(presetIncludes(findPreset('event-launch')!, findDeliverable(id)!), id).toBe(false);
      expect(presetIncludes(findPreset('custom')!, findDeliverable(id)!), id).toBe(false);
    }
  });

  it('keeps Event Launch pinned to a list, so a new deliverable is never auto-added', () => {
    const preset = findPreset('event-launch')!;
    expect(Array.isArray(preset.include)).toBe(true);
  });

  it('uses a deliverable default when a preset has no override', () => {
    const preset = findPreset('sermon-series')!;
    expect(presetQuantity(preset, findDeliverable('bg')!)).toBe(findDeliverable('bg')!.quantity!.default);
    expect(presetQuantity(preset, findDeliverable('hero-4k')!)).toBe(1);
  });

  it('returns nothing for an unknown preset', () => {
    expect(findPreset('made-up')).toBeUndefined();
  });
});
