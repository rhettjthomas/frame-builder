import { describe, expect, it } from 'vitest';
import { DELIVERABLES, findDeliverable } from '../src/core/deliverables';
import { frameCount, normalizeState, stateFromPreset } from '../src/core/state';

describe('stateFromPreset', () => {
  it('checks everything for Sermon Series', () => {
    const state = stateFromPreset('sermon-series');
    for (const d of DELIVERABLES) expect(state.rows[d.id].checked, d.id).toBe(true);
  });

  it('checks nothing for Custom', () => {
    const state = stateFromPreset('custom');
    for (const d of DELIVERABLES) expect(state.rows[d.id].checked, d.id).toBe(false);
  });

  it('applies the Event Launch quantity override', () => {
    const state = stateFromPreset('event-launch');
    expect(state.rows['lower-third'].checked).toBe(true);
    expect(state.rows['lower-third'].quantity).toBe(1);
    expect(state.rows['bg-blank'].checked).toBe(false);
  });

  it('gives every shipped deliverable a row, checked or not', () => {
    const state = stateFromPreset('event-launch');
    for (const d of DELIVERABLES) expect(state.rows[d.id], d.id).toBeDefined();
  });

  it('falls back to the default preset for an unknown id', () => {
    expect(stateFromPreset('nope').presetId).toBe('sermon-series');
  });
});

describe('normalizeState', () => {
  it('falls back to the default for junk', () => {
    for (const junk of [null, undefined, 42, 'nope', []]) {
      expect(normalizeState(junk).presetId).toBe('sermon-series');
    }
  });

  it('keeps a stored checkbox', () => {
    const state = normalizeState({ presetId: 'custom', rows: { story: { checked: false } } });
    expect(state.presetId).toBe('custom');
    expect(state.rows['story'].checked).toBe(false);
  });

  it('drops a deliverable that is no longer in the library', () => {
    const state = normalizeState({ rows: { 'retired-size': { checked: true, quantity: 3 } } });
    expect(state.rows['retired-size']).toBeUndefined();
  });

  it('clamps a stored quantity that is now out of range', () => {
    const max = findDeliverable('bg')!.quantity!.max;
    const state = normalizeState({ rows: { bg: { checked: true, quantity: 99 } } });
    expect(state.rows['bg'].quantity).toBe(max);
  });

  it('ignores a mistyped field without losing the rest of the row', () => {
    const state = normalizeState({ rows: { bg: { checked: 'yes', quantity: 2 } } });
    expect(state.rows['bg'].checked).toBe(true); // untouched default
    expect(state.rows['bg'].quantity).toBe(2);
  });

  it('rejects a preset id it does not recognise', () => {
    expect(normalizeState({ presetId: 'made-up' }).presetId).toBe('sermon-series');
  });
});

describe('frameCount', () => {
  it('counts nothing when nothing is checked', () => {
    expect(frameCount(stateFromPreset('custom'))).toBe(0);
  });

  it('counts quantities, not just checked rows', () => {
    const state = stateFromPreset('custom');
    state.rows['hero-4k'].checked = true;
    state.rows['carousel'].checked = true;
    state.rows['carousel'].quantity = 4;
    expect(frameCount(state)).toBe(5);
  });

  it('respects the clamp when a quantity was tampered with', () => {
    const state = stateFromPreset('custom');
    state.rows['bg'].checked = true;
    state.rows['bg'].quantity = 999;
    expect(frameCount(state)).toBe(findDeliverable('bg')!.quantity!.max);
  });
});

describe('settings', () => {
  it('defaults the folder prefix on, so an export arrives sorted', () => {
    expect(stateFromPreset('sermon-series').settings.folderPrefix).toBe(true);
  });

  it('keeps a stored setting, including one turned off deliberately', () => {
    expect(normalizeState({ settings: { folderPrefix: false } }).settings.folderPrefix).toBe(false);
    expect(normalizeState({ settings: { folderPrefix: true } }).settings.folderPrefix).toBe(true);
  });

  it('leaves a mistyped setting at the default rather than coercing it', () => {
    for (const junk of ['yes', 'false', 0, 1, null]) {
      expect(normalizeState({ settings: { folderPrefix: junk } }).settings.folderPrefix).toBe(true);
    }
  });

  it('survives storage with no settings at all, as older saves have', () => {
    expect(normalizeState({ presetId: 'custom' }).settings.folderPrefix).toBe(true);
  });
});

describe('custom sizes in state', () => {
  const custom = {
    id: 'custom:abc',
    name: 'Bulletin Insert',
    section: 'social-web',
    sectionLabel: 'Social & Web',
    folder: 'SOCIAL MEDIA',
    width: 1275,
    height: 1650,
    safe: { sides: 75, ends: 75 },
    quantity: 2,
  };

  it('gives a stored custom size a row of its own', () => {
    const state = normalizeState({ customs: [custom] });
    expect(state.customs).toHaveLength(1);
    expect(state.rows['custom:abc']).toBeDefined();
  });

  it('restores whether that row was checked', () => {
    const state = normalizeState({
      customs: [custom],
      rows: { 'custom:abc': { checked: true, quantity: 2 } },
    });
    expect(state.rows['custom:abc']).toEqual({ checked: true, quantity: 2 });
  });

  it('counts a checked custom size in the total', () => {
    const state = normalizeState({ customs: [custom] });
    // Clear the shipped rows so the count is only about the custom size.
    for (const id of Object.keys(state.rows)) state.rows[id].checked = false;
    state.rows['custom:abc'] = { checked: true, quantity: 2 };
    expect(frameCount(state)).toBe(2);
  });

  it('adds a custom size on top of the shipped checklist it was saved with', () => {
    const withCustom = normalizeState({ customs: [custom] });
    withCustom.rows['custom:abc'] = { checked: true, quantity: 2 };
    // Sermon Series is the default, so this is the shipped 20 plus the custom 2.
    expect(frameCount(withCustom)).toBe(22);
  });

  it('drops a size with no usable dimensions rather than building a bad frame', () => {
    const state = normalizeState({
      customs: [
        { ...custom, width: 0 },
        { ...custom, id: 'custom:b', height: -5 },
        { ...custom, id: 'custom:c', name: '  ' },
      ],
    });
    expect(state.customs).toEqual([]);
  });

  it('rejects an id that is not a custom id, so nothing can shadow a shipped one', () => {
    expect(normalizeState({ customs: [{ ...custom, id: 'story' }] }).customs).toEqual([]);
  });

  it('keeps only the first of two sizes sharing an id', () => {
    const state = normalizeState({ customs: [custom, { ...custom, name: 'Second' }] });
    expect(state.customs.map((c) => c.name)).toEqual(['Bulletin Insert']);
  });

  it('clamps a quantity that arrived out of range', () => {
    expect(normalizeState({ customs: [{ ...custom, quantity: 99 }] }).customs[0].quantity).toBe(10);
    expect(normalizeState({ customs: [{ ...custom, quantity: 0 }] }).customs[0].quantity).toBe(1);
  });

  it('survives junk in place of the customs list', () => {
    expect(normalizeState({ customs: 'nope' }).customs).toEqual([]);
    expect(normalizeState({ customs: [null, 7, 'x'] }).customs).toEqual([]);
  });
});

describe('saved presets in state', () => {
  const saved = { id: 'saved:1', name: 'Christmas Eve', include: ['story', 'square'] };

  it('reads a saved preset back', () => {
    const state = normalizeState({ savedPresets: [saved] });
    expect(state.savedPresets.map((p) => p.name)).toEqual(['Christmas Eve']);
  });

  it("marks it as the user's, so it can be told from a shipped one", () => {
    expect(normalizeState({ savedPresets: [saved] }).savedPresets[0].saved).toBe(true);
  });

  it('lets a saved preset be selected', () => {
    const state = normalizeState({ presetId: 'saved:1', savedPresets: [saved] });
    expect(state.presetId).toBe('saved:1');
  });

  it('refuses a saved preset that would shadow a shipped id', () => {
    const state = normalizeState({ savedPresets: [{ ...saved, id: 'sermon-series' }] });
    expect(state.savedPresets).toEqual([]);
  });

  it('carries the custom sizes a preset needs, so it travels complete', () => {
    const preset = {
      ...saved,
      include: ['custom:abc'],
      customs: [
        {
          id: 'custom:abc',
          name: 'Bulletin Insert',
          section: 'social-web',
          sectionLabel: 'Social & Web',
          folder: 'SOCIAL MEDIA',
          width: 1275,
          height: 1650,
          safe: { sides: 75, ends: 75 },
          quantity: 1,
        },
      ],
    };
    const state = stateFromPreset('saved:1', normalizeState({ savedPresets: [preset] }).savedPresets);
    expect(state.customs.map((c) => c.name)).toEqual(['Bulletin Insert']);
    expect(state.rows['custom:abc'].checked).toBe(true);
  });

  it('keeps a size already in play when switching preset', () => {
    const inPlay = {
      id: 'custom:keep',
      name: 'Keep Me',
      section: 'screens',
      sectionLabel: 'Screens',
      folder: 'SCREENS',
      width: 100,
      height: 100,
      safe: { sides: 0, ends: 0 },
      quantity: 1,
    };
    const state = stateFromPreset('event-launch', [], [inPlay]);
    expect(state.customs.map((c) => c.id)).toEqual(['custom:keep']);
    expect(state.rows['custom:keep']).toBeDefined();
  });

  it('survives junk in place of the preset list', () => {
    expect(normalizeState({ savedPresets: 'nope' }).savedPresets).toEqual([]);
    expect(normalizeState({ savedPresets: [{ id: '', name: '' }] }).savedPresets).toEqual([]);
  });
});

describe('custom sections from storage', () => {
  const printSize = {
    id: 'custom:print',
    name: 'Bulletin',
    section: 'section:print',
    sectionLabel: 'Print',
    folder: 'PRINT',
    width: 2550,
    height: 3300,
    safe: { sides: 150, ends: 150 },
    quantity: 1,
  };

  it('keeps a section a custom size invented', () => {
    const state = normalizeState({ customs: [printSize] });
    expect(state.customs[0].section).toBe('section:print');
    expect(state.customs[0].folder).toBe('PRINT');
  });

  it('gives that size a checklist row of its own', () => {
    expect(normalizeState({ customs: [printSize] }).rows['custom:print']).toBeDefined();
  });

  it('forces a shipped section back onto its shipped folder', () => {
    const lying = { ...printSize, section: 'screens', sectionLabel: 'Nope', folder: 'NOPE' };
    const state = normalizeState({ customs: [lying] });
    expect(state.customs[0].sectionLabel).toBe('Screens');
    expect(state.customs[0].folder).toBe('SCREENS');
  });

  it('derives a folder from the label when the stored one is unusable', () => {
    const state = normalizeState({ customs: [{ ...printSize, folder: '   ' }] });
    expect(state.customs[0].folder).toBe('PRINT');
  });

  it('cleans a folder name a file system would refuse', () => {
    const state = normalizeState({ customs: [{ ...printSize, folder: 'Kids/Students' }] });
    expect(state.customs[0].folder).toBe('KIDS-STUDENTS');
  });
});
