/**
 * The shipped deliverable library. Defaults stay generic enough for any church,
 * since this is a Community release: Midwood Road's own extras belong in a saved
 * preset, not in this list.
 */

/**
 * Which checklist section a deliverable appears under. A string rather than a
 * fixed pair, because a custom size can bring a section of its own: a church with
 * a print or email habit shouldn't have to file those under Social & Web.
 */
export type Section = string;

/**
 * The delivery folder a deliverable belongs in, as it should appear on disk.
 * Stamped on the frame and used for the optional name prefix.
 */
export type Folder = string;

export interface SectionDef {
  id: Section;
  label: string;
  folder: Folder;
}

/** The two that ship. Anything else arrives with a custom size. */
export const SHIPPED_SECTIONS: readonly SectionDef[] = [
  { id: 'screens', label: 'Screens', folder: 'SCREENS' },
  { id: 'social-web', label: 'Social & Web', folder: 'SOCIAL MEDIA' },
];

/**
 * Folder names offered when adding a section, as a starting point rather than a
 * rule. A church's package is its own; these are the ones that come up most.
 */
export const SUGGESTED_SECTIONS: readonly string[] = [
  'Print',
  'Email',
  'Signage',
  'Motion',
  'Merch',
  'Kids',
  'Students',
];

export type Format = 'JPG' | 'PNG';

/**
 * Safe margins become Figma layout grids, which can only inset symmetrically:
 * one COLUMNS grid carries `sides`, one ROWS grid carries `ends`. Zero means none.
 */
export interface SafeMargin {
  sides: number;
  ends: number;
}

export interface Deliverable {
  /** Stamped on the frame as `deliverable`. Stable: renaming the display name won't break exports. */
  id: string;
  /** Display name, also used in the frame name: `SeriesName_Name 01`. */
  name: string;
  section: Section;
  folder: Folder;
  width: number;
  height: number;
  safe: SafeMargin;
  /** Lower Thirds ship with no fill so they export as transparent PNGs. */
  fill: boolean;
  format: Format;
  /** null means exactly one frame, with no quantity control in the dialog. */
  quantity: { default: number; min: number; max: number } | null;
  note: string;
}

const NO_MARGIN: SafeMargin = { sides: 0, ends: 0 };
const MARGIN_100: SafeMargin = { sides: 100, ends: 100 };

export const DELIVERABLES: readonly Deliverable[] = [
  {
    id: 'hero-4k',
    name: 'Hero 4K',
    section: 'screens',
    folder: 'SCREENS',
    width: 3840,
    height: 2160,
    safe: MARGIN_100,
    fill: true,
    format: 'JPG',
    quantity: null,
    note: 'Main series screen art',
  },
  {
    id: 'bg-blank',
    name: 'BG Blank',
    section: 'screens',
    folder: 'SCREENS',
    width: 3840,
    height: 2160,
    safe: MARGIN_100,
    fill: true,
    format: 'JPG',
    quantity: null,
    note: 'Art with no type',
  },
  {
    id: 'bg',
    name: 'BG',
    section: 'screens',
    folder: 'SCREENS',
    width: 3840,
    height: 2160,
    safe: MARGIN_100,
    fill: true,
    format: 'JPG',
    quantity: { default: 4, min: 1, max: 4 },
    note: 'Numbered backgrounds',
  },
  {
    id: 'lower-third',
    name: 'Lower Third',
    section: 'screens',
    folder: 'SCREENS',
    width: 1920,
    height: 1080,
    safe: NO_MARGIN,
    fill: false,
    format: 'PNG',
    quantity: { default: 2, min: 1, max: 2 },
    note: 'No fill, exports PNG for transparency',
  },
  {
    id: 'square',
    name: 'Square',
    section: 'social-web',
    folder: 'SOCIAL MEDIA',
    width: 1080,
    height: 1080,
    safe: MARGIN_100,
    fill: true,
    format: 'JPG',
    quantity: null,
    note: '1:1 feed post',
  },
  {
    id: 'post',
    name: 'Post',
    section: 'social-web',
    folder: 'SOCIAL MEDIA',
    width: 1080,
    height: 1350,
    safe: MARGIN_100,
    fill: true,
    format: 'JPG',
    quantity: null,
    note: '4:5 feed post',
  },
  {
    id: 'post-bg',
    name: 'PostBG',
    section: 'social-web',
    folder: 'SOCIAL MEDIA',
    width: 1080,
    height: 1350,
    safe: MARGIN_100,
    fill: true,
    format: 'JPG',
    quantity: null,
    note: '4:5, no type',
  },
  {
    id: 'story',
    name: 'Story',
    section: 'social-web',
    folder: 'SOCIAL MEDIA',
    width: 1080,
    height: 1920,
    safe: { sides: 100, ends: 250 },
    fill: true,
    format: 'JPG',
    quantity: null,
    note: '9:16',
  },
  {
    id: 'story-bg',
    name: 'StoryBG',
    section: 'social-web',
    folder: 'SOCIAL MEDIA',
    width: 1080,
    height: 1920,
    safe: { sides: 100, ends: 250 },
    fill: true,
    format: 'JPG',
    quantity: null,
    note: '9:16, no type',
  },
  {
    id: 'web',
    name: 'Web',
    section: 'social-web',
    folder: 'WEB',
    width: 1920,
    height: 1080,
    safe: NO_MARGIN,
    fill: true,
    format: 'JPG',
    quantity: null,
    note: '16:9',
  },
  {
    id: 'youtube-cover',
    name: 'YouTube Cover',
    section: 'social-web',
    folder: 'SOCIAL MEDIA',
    width: 2560,
    height: 1440,
    // YouTube's all-devices safe area is 1546 x 423 centred, which is what the
    // grid insets to. Anything outside it is cropped on some device.
    safe: { sides: 507, ends: 508 },
    fill: true,
    format: 'JPG',
    quantity: null,
    note: 'Channel banner',
  },
  {
    id: 'facebook-cover',
    name: 'Facebook Cover',
    section: 'social-web',
    folder: 'SOCIAL MEDIA',
    width: 1640,
    height: 856,
    safe: MARGIN_100,
    fill: true,
    format: 'JPG',
    quantity: null,
    note: 'Page cover photo',
  },
  {
    id: 'carousel',
    name: 'Carousel',
    section: 'social-web',
    folder: 'SOCIAL MEDIA',
    width: 1080,
    height: 1350,
    safe: MARGIN_100,
    fill: true,
    format: 'JPG',
    quantity: { default: 4, min: 2, max: 10 },
    note: 'Numbered in sequence',
  },
];

/** Every section in play: the two that ship, then any a custom size introduced. */
export function sectionsFor(customs: readonly CustomDeliverable[] = []): SectionDef[] {
  const out = [...SHIPPED_SECTIONS];
  for (const c of customs) {
    if (out.some((s) => s.id === c.section)) continue;
    out.push({ id: c.section, label: c.sectionLabel, folder: c.folder });
  }
  return out;
}

export function sectionLabel(section: Section, customs: readonly CustomDeliverable[] = []): string {
  return sectionsFor(customs).find((s) => s.id === section)?.label ?? section;
}

/**
 * A size the user added themselves. Kept separate from the shipped library and
 * carried by the preset that uses it, so a preset handed to a church's team
 * arrives complete rather than referring to sizes they don't have.
 */
export interface CustomDeliverable {
  id: string;
  name: string;
  section: Section;
  /** Carried alongside the id so a shared preset can rebuild a section it invented. */
  sectionLabel: string;
  folder: Folder;
  width: number;
  height: number;
  safe: SafeMargin;
  quantity: number;
}

export const CUSTOM_SECTION_PREFIX = 'section:';

export const CUSTOM_PREFIX = 'custom:';

export function isCustomId(id: string): boolean {
  return id.indexOf(CUSTOM_PREFIX) === 0;
}

/** Custom sizes get no special treatment once they're in the library. */
export function customToDeliverable(c: CustomDeliverable): Deliverable {
  return {
    id: c.id,
    name: c.name,
    section: c.section,
    folder: c.folder,
    width: c.width,
    height: c.height,
    safe: c.safe,
    fill: true,
    format: 'JPG',
    quantity: c.quantity > 1 ? { default: c.quantity, min: 1, max: Math.max(c.quantity, 10) } : null,
    note: 'Custom size',
  };
}

/**
 * The deliverables actually on offer: the shipped library plus whatever custom
 * sizes are in play. Everything downstream works from this rather than from the
 * shipped constant, so a custom size behaves like any other row.
 */
export type Library = readonly Deliverable[];

export function buildLibrary(customs: readonly CustomDeliverable[] = []): Library {
  return [...DELIVERABLES, ...customs.map(customToDeliverable)];
}

export function findIn(library: Library, id: string): Deliverable | undefined {
  return library.find((d) => d.id === id);
}

export function deliverablesIn(library: Library, section: Section): Deliverable[] {
  return library.filter((d) => d.section === section);
}

/** Lookup restricted to the shipped library, for rules that can't involve customs. */
export function findDeliverable(id: string): Deliverable | undefined {
  return DELIVERABLES.find((d) => d.id === id);
}

/** How many frames a deliverable produces at a given quantity, clamped to its range. */
export function clampQuantity(d: Deliverable, requested: number): number {
  if (!d.quantity) return 1;
  if (!Number.isFinite(requested)) return d.quantity.default;
  return Math.min(d.quantity.max, Math.max(d.quantity.min, Math.round(requested)));
}

/** Human-readable size, e.g. "1080 × 1350". */
export function formatSize(d: Deliverable): string {
  return `${d.width} × ${d.height}`;
}

/** Human-readable safe margin, e.g. "250 top/bottom, 100 sides". */
export function formatSafe(safe: SafeMargin): string {
  if (!safe.sides && !safe.ends) return 'No safe margin';
  if (safe.sides === safe.ends) return `${safe.sides} all sides`;
  const parts: string[] = [];
  if (safe.ends) parts.push(`${safe.ends} top/bottom`);
  if (safe.sides) parts.push(`${safe.sides} sides`);
  return parts.join(', ');
}
