/**
 * Creates the frames. Everything about where they go is decided in core/layout,
 * so this module only turns a plan into Figma nodes.
 */
import type { SafeMargin } from '../core/deliverables';
import { planFrames, type PlannedFrame } from '../core/layout';
import type { BuildItem } from '../core/messages';

const WHITE: SolidPaint = { type: 'SOLID', color: { r: 1, g: 1, b: 1 } };

/**
 * The plugin's rose. Figma's own default grid alpha of 0.1 is far too faint on a
 * 3840-wide frame viewed zoomed out, which is most of this library.
 */
const GRID_COLOR = { r: 0.859, g: 0.325, b: 0.459, a: 0.15 };

export interface BuildResult {
  section: SectionNode;
  frames: FrameNode[];
}

/**
 * Safe margins are layout grids rather than drawn rectangles: grids are visible
 * while designing and never rasterize into an export, so there is nothing to
 * hide or delete before delivery. STRETCH alignment insets both edges by `offset`,
 * which is why margins are modelled as a symmetric pair.
 */
export function safeGrids(safe: SafeMargin): LayoutGrid[] {
  const grids: LayoutGrid[] = [];
  if (safe.sides > 0) {
    grids.push({
      pattern: 'COLUMNS',
      alignment: 'STRETCH',
      count: 1,
      gutterSize: 0,
      offset: safe.sides,
      visible: true,
      color: GRID_COLOR,
    });
  }
  if (safe.ends > 0) {
    grids.push({
      pattern: 'ROWS',
      alignment: 'STRETCH',
      count: 1,
      gutterSize: 0,
      offset: safe.ends,
      visible: true,
      color: GRID_COLOR,
    });
  }
  return grids;
}

/** Free space to the right of everything already on the page. */
function placementForSection(section: SectionNode): { x: number; y: number } {
  const others = figma.currentPage.children.filter((n) => n !== section);
  if (others.length === 0) return { x: 0, y: 0 };
  let right = -Infinity;
  let top = Infinity;
  for (const n of others) {
    right = Math.max(right, n.x + n.width);
    top = Math.min(top, n.y);
  }
  return { x: Math.round(right + 400), y: Math.round(top) };
}

function createFrame(planned: PlannedFrame): FrameNode {
  const frame = figma.createFrame();
  frame.name = planned.name;
  frame.resize(planned.width, planned.height);
  // Lower Thirds ship with no fill so they export as transparent PNGs.
  frame.fills = planned.fill ? [WHITE] : [];
  frame.layoutGrids = safeGrids(planned.safe);
  frame.clipsContent = true;
  return frame;
}

export function buildSeries(seriesName: string, items: readonly BuildItem[]): BuildResult {
  const plan = planFrames(seriesName, items);
  if (plan.frames.length === 0) throw new Error('Nothing was checked, so there is nothing to build.');

  const section = figma.createSection();
  section.name = seriesName;
  section.resizeWithoutConstraints(plan.width, plan.height);
  const at = placementForSection(section);
  section.x = at.x;
  section.y = at.y;

  const frames: FrameNode[] = [];
  for (const planned of plan.frames) {
    const frame = createFrame(planned);
    // Append first: x and y are relative to the containing parent, so they only
    // mean what the plan intends once the frame is inside the section.
    section.appendChild(frame);
    frame.x = planned.x;
    frame.y = planned.y;
    frames.push(frame);
  }

  figma.currentPage.selection = [section];
  figma.viewport.scrollAndZoomIntoView([section]);
  return { section, frames };
}
