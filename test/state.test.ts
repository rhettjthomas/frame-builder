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
