/**
 * The dialog state that survives between runs. Stored in figma.clientStorage, so
 * it is per machine and has to be treated as untrusted on read: an older version
 * may have written a deliverable that no longer exists, or a quantity now out of
 * range.
 */
import { clampQuantity, DELIVERABLES, findDeliverable } from './deliverables';
import { DEFAULT_PRESET_ID, findPreset, presetIncludes, presetQuantity } from './presets';

export const STATE_KEY = 'frame-builder/state';

export interface Row {
  checked: boolean;
  quantity: number;
}

export interface BuildState {
  presetId: string;
  /** Keyed by deliverable id. Every shipped deliverable always has a row. */
  rows: Record<string, Row>;
}

/** The checklist a preset describes, with quantities clamped to each range. */
export function stateFromPreset(presetId: string): BuildState {
  const preset = findPreset(presetId) ?? findPreset(DEFAULT_PRESET_ID)!;
  const rows: Record<string, Row> = {};
  for (const d of DELIVERABLES) {
    rows[d.id] = {
      checked: presetIncludes(preset, d),
      quantity: clampQuantity(d, presetQuantity(preset, d)),
    };
  }
  return { presetId: preset.id, rows };
}

export const DEFAULT_STATE = stateFromPreset(DEFAULT_PRESET_ID);

/**
 * Merge stored state over the default, dropping unknown deliverables and
 * clamping quantities. Never throws: bad storage falls back to the default.
 */
export function normalizeState(stored: unknown): BuildState {
  const base = stateFromPreset(DEFAULT_PRESET_ID);
  if (!stored || typeof stored !== 'object') return base;
  const raw = stored as Record<string, unknown>;

  if (typeof raw.presetId === 'string' && findPreset(raw.presetId)) {
    base.presetId = raw.presetId;
  }

  const rows = raw.rows;
  if (rows && typeof rows === 'object') {
    for (const [id, value] of Object.entries(rows as Record<string, unknown>)) {
      const d = findDeliverable(id);
      if (!d || !value || typeof value !== 'object') continue;
      const row = value as Record<string, unknown>;
      if (typeof row.checked === 'boolean') base.rows[id].checked = row.checked;
      if (typeof row.quantity === 'number') {
        base.rows[id].quantity = clampQuantity(d, row.quantity);
      }
    }
  }
  return base;
}

/** Total frames the current checklist would build. */
export function frameCount(state: BuildState): number {
  let total = 0;
  for (const d of DELIVERABLES) {
    const row = state.rows[d.id];
    if (row?.checked) total += clampQuantity(d, row.quantity);
  }
  return total;
}
