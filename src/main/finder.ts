/**
 * Finds every frame belonging to a series, wherever it sits in the file.
 *
 * The search is by tag rather than by page, which is what makes it work on
 * Figma's free tier: a church limited to a few pages per file can spread a
 * series across all of them and the export still gathers the whole set.
 *
 * Tags catch duplicates. The section catches frames built by hand that were
 * never tagged. Both are offered, because either one alone misses something.
 */
import type { FoundFrame, FoundSeries } from '../core/confirm';
import { readTags, TAG } from '../core/tags';

export async function findAllSeries(): Promise<FoundSeries[]> {
  // documentAccess is dynamic-page, so pages have to be loaded before a search
  // can reach across them.
  await figma.loadAllPagesAsync();

  const series = new Map<string, FoundSeries>();

  function seriesFor(seriesId: string): FoundSeries {
    let found = series.get(seriesId);
    if (!found) {
      found = { seriesId, label: seriesId, frames: [] };
      series.set(seriesId, found);
    }
    return found;
  }

  for (const page of figma.root.children) {
    const tagged = page.findAllWithCriteria({
      types: ['FRAME', 'SECTION'],
      pluginData: { keys: [TAG.seriesId] },
    });

    for (const node of tagged) {
      const tags = readTags(node);
      if (!tags) continue;
      const entry = seriesFor(tags.seriesId);

      if (node.type === 'SECTION') {
        // The section names the series, and adopts any untagged frame sitting
        // directly inside it.
        entry.label = node.name;
        for (const child of node.children) {
          if (child.type !== 'FRAME') continue;
          if (readTags(child)) continue; // already counted through its own tag
          entry.frames.push({
            nodeId: child.id,
            name: child.name,
            deliverableId: '',
            group: tags.group,
            pageName: page.name,
            adopted: true,
          });
        }
        continue;
      }

      entry.frames.push({
        nodeId: node.id,
        name: node.name,
        deliverableId: tags.deliverable,
        group: tags.group,
        pageName: page.name,
        adopted: false,
      });
    }
  }

  const out = [...series.values()];
  for (const entry of out) entry.frames.sort((a, b) => a.name.localeCompare(b.name));
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

/** Select a found frame in the file and bring it into view. */
export async function revealNode(nodeId: string): Promise<void> {
  const node = await figma.getNodeByIdAsync(nodeId);
  if (!node || node.removed || node.type === 'DOCUMENT' || node.type === 'PAGE') {
    figma.notify('That frame is no longer in the file.');
    return;
  }
  let page: BaseNode | null = node;
  while (page && page.type !== 'PAGE') page = page.parent;
  if (page && page !== figma.currentPage) await figma.setCurrentPageAsync(page as PageNode);
  figma.currentPage.selection = [node as SceneNode];
  figma.viewport.scrollAndZoomIntoView([node as SceneNode]);
}
