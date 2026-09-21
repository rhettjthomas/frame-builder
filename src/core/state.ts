/**
 * The dialog state that survives between runs. Stored in figma.clientStorage, so
 * it is per machine and has to be treated as untrusted on read: an older version
 * may have written a deliverable that no longer exists, or a quantity now out of
 * range.
 */
import {
  buildLibrary,
  clampQuantity,
  findIn,
  isCustomId,
  SHIPPED_SECTIONS,
  type CustomDeliverable,
  type Library,
} from './deliverables';
import { safeFolder } from './delivery';
import { DEFAULT_PRESET_ID, findPreset, presetIncludes, presetQuantity, type Preset } from './presets';

export const STATE_KEY = 'frame-builder/state';

export interface Row {
  checked: boolean;
  quantity: number;
}

export interface BuildSettings {
  /**
   * Prefix each frame name with its delivery folder, so Figma's own export turns
   * the slash into a subfolder. Off by default: the shipped behaviour has to suit
   * a church seeing the plugin for the first time, and a long prefixed name in the
   * layers panel is a surprise until you know why it's there.
   */
  folderPrefix: boolean;
}

export const DEFAULT_SETTINGS: BuildSettings = {
  folderPrefix: false,
};

export interface BuildState {
  presetId: string;
  /** Keyed by deliverable id. Every deliverable in the library has a row. */
  rows: Record<string, Row>;
  /** Custom sizes currently in play, shown alongside the shipped library. */
  customs: CustomDeliverable[];
  /** Presets the user saved, on top of the three that ship. */
  savedPresets: Preset[];
  settings: BuildSettings;
}

/** The deliverables a state is working with: shipped plus its own customs. */
export function libraryFor(state: BuildState): Library {
  return buildLibrary(state.customs);
}

/**
 * The checklist a preset describes, with quantities clamped to each range. A
 * preset brings its own custom sizes, so choosing one installs them too.
 */
export function stateFromPreset(
  presetId: string,
  saved: readonly Preset[] = [],
  keepCustoms: readonly CustomDeliverable[] = [],
): BuildState {
  const preset = findPreset(presetId, saved) ?? findPreset(DEFAULT_PRESET_ID)!;
  // A preset's own customs win; anything else in play is kept so switching
  // presets doesn't quietly discard a size the user just added.
  const customs = [...(preset.customs ?? [])];
  for (const c of keepCustoms) if (!customs.some((existing) => existing.id === c.id)) customs.push(c);

  const rows: Record<string, Row> = {};
  for (const d of buildLibrary(customs)) {
    rows[d.id] = {
      checked: presetIncludes(preset, d),
      quantity: clampQuantity(d, presetQuantity(preset, d)),
    };
  }
  return {
    presetId: preset.id,
    rows,
    customs,
    savedPresets: [...saved],
    settings: { ...DEFAULT_SETTINGS },
  };
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

  const savedPresets = normalizePresets(raw.savedPresets);
  base.savedPresets = savedPresets;

  const customs = normalizeCustoms(raw.customs);
  if (customs.length > 0) {
    base.customs = customs;
    // Rows are keyed by deliverable id, so the library has to include the stored
    // customs before any row can be read back onto it.
    for (const d of buildLibrary(customs)) {
      if (!base.rows[d.id]) base.rows[d.id] = { checked: false, quantity: clampQuantity(d, 1) };
    }
  }

  if (typeof raw.presetId === 'string' && findPreset(raw.presetId, savedPresets)) {
    base.presetId = raw.presetId;
  }

  const settings = raw.settings;
  if (settings && typeof settings === 'object') {
    for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof BuildSettings)[]) {
      const value = (settings as Record<string, unknown>)[key];
      if (typeof value === 'boolean') base.settings[key] = value;
    }
  }

  const library = buildLibrary(base.customs);
  const rows = raw.rows;
  if (rows && typeof rows === 'object') {
    for (const [id, value] of Object.entries(rows as Record<string, unknown>)) {
      const d = findIn(library, id);
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
  for (const d of libraryFor(state)) {
    const row = state.rows[d.id];
    if (row?.checked) total += clampQuantity(d, row.quantity);
  }
  return total;
}

/* ------------------------------------------------- reading untrusted storage */

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/**
 * Custom sizes come back from storage, or out of a shared JSON file, so every
 * field is checked. A size with no usable dimensions is dropped rather than
 * building a frame nobody asked for.
 */
export function normalizeCustoms(raw: unknown): CustomDeliverable[] {
  if (!Array.isArray(raw)) return [];
  const out: CustomDeliverable[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const c = entry as Record<string, unknown>;
    const id = typeof c.id === 'string' && isCustomId(c.id) ? c.id : '';
    const name = typeof c.name === 'string' ? c.name.trim() : '';
    const width = Math.round(num(c.width, 0));
    const height = Math.round(num(c.height, 0));
    if (!id || !name || width < 1 || height < 1 || seen.has(id)) continue;
    const safe = (c.safe ?? {}) as Record<string, unknown>;
    seen.add(id);

    // A section the size invented travels with it. Fall back to the shipped pair
    // when the stored section is unrecognisable, rather than inventing a folder.
    const shipped = SHIPPED_SECTIONS.find((s) => s.id === c.section);
    const section = typeof c.section === 'string' && c.section ? c.section : 'social-web';
    const sectionLabel =
      shipped?.label ??
      (typeof c.sectionLabel === 'string' && c.sectionLabel.trim() ? c.sectionLabel.trim() : section);
    const folder =
      shipped?.folder ??
      safeFolder(typeof c.folder === 'string' && c.folder.trim() ? c.folder : sectionLabel);

    out.push({
      id,
      name,
      section: shipped?.id ?? section,
      sectionLabel,
      folder,
      width,
      height,
      safe: {
        sides: Math.max(0, Math.round(num(safe.sides, 0))),
        ends: Math.max(0, Math.round(num(safe.ends, 0))),
      },
      quantity: Math.min(10, Math.max(1, Math.round(num(c.quantity, 1)))),
    });
  }
  return out;
}

/** Saved presets, checked the same way and never allowed to shadow a shipped id. */
export function normalizePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  const out: Preset[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const p = entry as Record<string, unknown>;
    const id = typeof p.id === 'string' ? p.id : '';
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    if (!id || !name || seen.has(id) || findPreset(id)) continue;
    const include = Array.isArray(p.include)
      ? p.include.filter((v): v is string => typeof v === 'string')
      : p.include === 'all'
        ? ('all' as const)
        : [];
    const quantities: Record<string, number> = {};
    if (p.quantities && typeof p.quantities === 'object') {
      for (const [key, value] of Object.entries(p.quantities as Record<string, unknown>)) {
        if (typeof value === 'number' && Number.isFinite(value)) quantities[key] = Math.round(value);
      }
    }
    seen.add(id);
    out.push({
      id,
      name,
      include,
      quantities,
      customs: normalizeCustoms(p.customs),
      saved: true,
    });
  }
  return out;
}
