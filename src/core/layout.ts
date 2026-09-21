/**
 * Works out where every frame goes before a single Figma node is created, so the
 * arrangement can be tested without a document. Coordinates are relative to the
 * section's top-left corner.
 */
import {
  buildLibrary,
  clampQuantity,
  findIn,
  type Deliverable,
  type Folder,
  type Library,
  type SafeMargin,
  type Section,
} from './deliverables';
import { safeFolder } from './delivery';
import type { BuildItem } from './messages';

/** Space between frames in a row, and between rows. */
export const GUTTER = 200;
/** Extra breathing room between the Screens band and the Social & Web band. */
export const SECTION_GAP = 600;
/** Space between the section edge and the frames inside it. */
export const PADDING = 200;
/** A row wraps once it would pass this width. Fits four 4K frames across. */
export const MAX_ROW_WIDTH = 16000;

export interface PlannedFrame {
  deliverableId: string;
  /** `SeriesName_Deliverable 01` */
  name: string;
  /** 1-based, counted per deliverable type. */
  index: number;
  width: number;
  height: number;
  /** Relative to the section's top-left corner. */
  x: number;
  y: number;
  fill: boolean;
  safe: SafeMargin;
  folder: Folder;
}

export interface Plan {
  frames: PlannedFrame[];
  width: number;
  height: number;
}

/**
 * Screens first, then Social & Web, then any section a custom size introduced,
 * in the order the sizes were added.
 */
function sectionOrder(library: Library): Section[] {
  const out: Section[] = [];
  for (const d of library) if (out.indexOf(d.section) === -1) out.push(d.section);
  return out;
}

/**
 * `SeriesName_Deliverable 01`. The space before the number is deliberate: Figma
 * increments a trailing number when a layer is duplicated, so copies made by hand
 * carry on the sequence by themselves and nothing has to renumber them later.
 *
 * With `folderPrefix`, the name gains a full delivery path, as in
 * `HOPE HAS A NAME/SOCIAL MEDIA/Hope Has a Name_Story 01`. Figma nests a folder
 * per slash when several layers are exported at once, so two levels give the
 * series its own folder with the groups inside it, rather than dropping SCREENS
 * and SOCIAL MEDIA loose wherever the export landed.
 */
export function frameName(
  seriesName: string,
  d: Deliverable,
  index: number,
  folderPrefix = false,
): string {
  const base = `${seriesName}_${d.name} ${String(index).padStart(2, '0')}`;
  return folderPrefix ? `${deliveryPath(seriesName, d.folder)}/${base}` : base;
}

/** `HOPE HAS A NAME/SCREENS`: the master folder, then the group inside it. */
export function deliveryPath(seriesName: string, folder: string): string {
  return `${safeFolder(seriesName)}/${folder}`;
}

/** The checked deliverables in library order, each with how many frames it wants. */
function resolve(items: readonly BuildItem[], library: Library): { d: Deliverable; count: number }[] {
  const wanted = new Map<string, number>();
  for (const item of items) {
    const d = findIn(library, item.deliverableId);
    if (d) wanted.set(d.id, clampQuantity(d, item.quantity));
  }
  const out: { d: Deliverable; count: number }[] = [];
  for (const d of library) {
    const count = wanted.get(d.id);
    if (count) out.push({ d, count });
  }
  return out;
}

export function planFrames(
  seriesName: string,
  items: readonly BuildItem[],
  folderPrefix = false,
  library: Library = buildLibrary(),
): Plan {
  const resolved = resolve(items, library);
  const frames: PlannedFrame[] = [];

  // Cursor and extents are relative to the content origin; PADDING is added last.
  let cursorX = 0;
  let cursorY = 0;
  let rowOpen = false;
  let contentRight = 0;
  let contentBottom = 0;

  /** Drop to a fresh row below everything placed so far. */
  function endRow(gap: number) {
    if (!rowOpen) return;
    cursorY = contentBottom + gap;
    cursorX = 0;
    rowOpen = false;
  }

  for (const section of sectionOrder(library)) {
    const inSection = resolved.filter((r) => r.d.section === section);
    if (inSection.length === 0) continue;

    if (frames.length > 0) {
      // A new band always clears the previous one, whether or not a row was open.
      cursorY = contentBottom + SECTION_GAP;
      cursorX = 0;
      rowOpen = false;
    }

    for (const { d, count } of inSection) {
      // A deliverable with several frames reads as a set, so it gets its own
      // row or rows rather than being split around whatever came before it.
      const ownRow = count > 1;
      if (ownRow) endRow(GUTTER);

      for (let index = 1; index <= count; index++) {
        // Wrap before placing, but never leave a row empty: a frame wider than
        // the max gets its own row rather than being dropped from the plan.
        if (rowOpen && cursorX + d.width > MAX_ROW_WIDTH) endRow(GUTTER);

        frames.push({
          deliverableId: d.id,
          name: frameName(seriesName, d, index, folderPrefix),
          index,
          width: d.width,
          height: d.height,
          x: PADDING + cursorX,
          y: PADDING + cursorY,
          fill: d.fill,
          safe: d.safe,
          folder: d.folder,
        });

        contentRight = Math.max(contentRight, cursorX + d.width);
        contentBottom = Math.max(contentBottom, cursorY + d.height);
        cursorX += d.width + GUTTER;
        rowOpen = true;
      }

      if (ownRow) endRow(GUTTER);
    }
  }

  if (frames.length === 0) return { frames, width: PADDING * 2, height: PADDING * 2 };
  return {
    frames,
    width: PADDING * 2 + contentRight,
    height: PADDING * 2 + contentBottom,
  };
}
