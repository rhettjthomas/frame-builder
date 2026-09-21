/**
 * Selection commands, run from the plugin's menu without opening the window.
 *
 * These are what the tags are for. Frame Builder doesn't export, so a tag's job
 * is to answer "which frames belong to this series" long after the build, when
 * copies have been made and things have been moved around.
 *
 * Each command works from the current selection rather than asking a question,
 * so there is nothing to fill in and no window to wait for.
 */
import { belongsTo, clearTags, readTags, stampTags, TAG } from '../core/tags';

/**
 * Walk up to the nearest ancestor carrying a series tag, the node itself
 * included. This is what lets a hand-built frame inside the series section be
 * adopted without the user naming the series: the section already knows.
 */
export function seriesFrom(node: BaseNode): string | null {
  let current: BaseNode | null = node;
  while (current && current.type !== 'PAGE' && current.type !== 'DOCUMENT') {
    const tags = readTags(current as SceneNode);
    if (tags) return tags.seriesId;
    current = current.parent;
  }
  return null;
}

/** The series the selection is pointing at, from the node or its section. */
function seriesFromSelection(): string | null {
  for (const node of figma.currentPage.selection) {
    const seriesId = seriesFrom(node);
    if (seriesId) return seriesId;
  }
  return null;
}

/**
 * Select every frame of the series on this page.
 *
 * Figma's selection can only hold nodes from one page, so frames elsewhere are
 * counted and named rather than silently left out. Saying "12 here, 6 on other
 * pages" is the difference between a tool you can trust and one you have to
 * double-check.
 */
export async function selectSeries(): Promise<string> {
  const seriesId = seriesFromSelection();
  if (!seriesId) {
    return 'Select a frame from the series first, then run this again.';
  }

  const here = figma.currentPage
    .findAllWithCriteria({ types: ['FRAME'], pluginData: { keys: [TAG.seriesId] } })
    .filter((node) => belongsTo(node, seriesId));

  await figma.loadAllPagesAsync();
  let elsewhere = 0;
  for (const page of figma.root.children) {
    if (page === figma.currentPage) continue;
    elsewhere += page
      .findAllWithCriteria({ types: ['FRAME'], pluginData: { keys: [TAG.seriesId] } })
      .filter((node) => belongsTo(node, seriesId)).length;
  }

  if (here.length === 0) {
    return elsewhere > 0
      ? `No frames from ${seriesId} on this page. ${elsewhere} are on other pages.`
      : `No frames tagged ${seriesId} anywhere in this file.`;
  }

  figma.currentPage.selection = here;
  figma.viewport.scrollAndZoomIntoView(here);
  const noun = here.length === 1 ? 'frame' : 'frames';
  return elsewhere > 0
    ? `Selected ${here.length} ${noun}. ${elsewhere} more on other pages.`
    : `Selected ${here.length} ${noun} from ${seriesId}.`;
}

/**
 * Adopt hand-built frames into a series.
 *
 * The series is taken from the section the frames sit in, or from a tagged frame
 * selected alongside them, so there is nothing to type. An adopted frame carries
 * no deliverable, which is honest: it isn't one of the shipped sizes.
 */
export function retagSelection(version: string): string {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return 'Select the frames to add to a series.';

  const seriesId = seriesFromSelection();
  if (!seriesId) {
    return 'Nothing here says which series. Put the frames in the series section, or select a tagged frame too.';
  }

  let adopted = 0;
  for (const node of selection) {
    if (node.type !== 'FRAME') continue;
    if (belongsTo(node, seriesId)) continue;
    const existing = readTags(node);
    stampTags(node, {
      seriesId,
      // Keep what it already claimed to be, if anything.
      deliverable: existing?.deliverable ?? '',
      group: existing?.group ?? 'screens',
      builderVersion: version,
    });
    adopted++;
  }

  if (adopted === 0) return `Nothing to add: those frames are already in ${seriesId}.`;
  const noun = adopted === 1 ? 'frame' : 'frames';
  return `Added ${adopted} ${noun} to ${seriesId}.`;
}

/** Drop frames out of their series, for art repurposed elsewhere. */
export function untagSelection(): string {
  const selection = figma.currentPage.selection;
  if (selection.length === 0) return 'Select the frames to remove from their series.';

  let cleared = 0;
  for (const node of selection) {
    if (!readTags(node)) continue;
    clearTags(node);
    cleared++;
  }

  if (cleared === 0) return 'None of those frames belong to a series.';
  const noun = cleared === 1 ? 'frame' : 'frames';
  return `Removed the series tags from ${cleared} ${noun}.`;
}
