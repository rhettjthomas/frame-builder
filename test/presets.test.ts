import { describe, expect, it } from 'vitest';
import { deliverablesIn, findDeliverable } from '../src/core/deliverables';
import { DEFAULT_PRESET_ID, findPreset, presetIncludes, presetQuantity, SHIPPED_PRESETS } from '../src/core/presets';

describe('shipped presets', () => {
  it('ships the three the brief calls for', () => {
    expect(SHIPPED_PRESETS.map((p) => p.id)).toEqual(['sermon-series', 'event-launch', 'custom']);
  });

  it('defaults to Sermon Series', () => {
    expect(findPreset(DEFAULT_PRESET_ID)?.name).toBe('Sermon Series');
  });

  it('gives Event Launch the hero, one lower third, and all of Social & Web', () => {
    const preset = findPreset('event-launch')!;
    expect(presetIncludes(preset, findDeliverable('hero-4k')!)).toBe(true);
    expect(presetIncludes(preset, findDeliverable('lower-third')!)).toBe(true);
    expect(presetQuantity(preset, findDeliverable('lower-third')!)).toBe(1);
    for (const d of deliverablesIn('social-web')) {
      expect(presetIncludes(preset, d), d.id).toBe(true);
    }
    expect(presetIncludes(preset, findDeliverable('bg')!)).toBe(false);
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
