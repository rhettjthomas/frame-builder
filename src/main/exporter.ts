/**
 * Renders the chosen frames and hands the bytes to the UI one at a time.
 *
 * One at a time rather than all at once: a full series of 4K frames is far too
 * much to hold in memory twice, and streaming gives the progress line something
 * true to report.
 */
import { filePathFor, formatFor } from '../core/delivery';
import type { Group } from '../core/deliverables';
import { readTags } from '../core/tags';

export interface RenderedFile {
  nodeId: string;
  /** Path inside the package, folders included. */
  path: string;
  bytes: Uint8Array;
}

export interface ExportFailure {
  nodeId: string;
  name: string;
  reason: string;
}

export interface ExportSummary {
  written: number;
  failures: ExportFailure[];
}

/**
 * Render each node in turn, calling `onFile` with the bytes. A frame that fails
 * to render is reported rather than silently dropped, and does not stop the rest:
 * losing one file should not cost the other nineteen.
 */
export async function exportFrames(
  nodeIds: readonly string[],
  onFile: (file: RenderedFile, done: number, total: number) => Promise<void>,
): Promise<ExportSummary> {
  const total = nodeIds.length;
  const failures: ExportFailure[] = [];
  let written = 0;

  for (let i = 0; i < total; i++) {
    const nodeId = nodeIds[i];
    let name = nodeId;
    try {
      const node = await figma.getNodeByIdAsync(nodeId);
      if (!node || node.removed || node.type !== 'FRAME') {
        failures.push({ nodeId, name, reason: 'No longer in the file' });
        continue;
      }
      name = node.name;
      const tags = readTags(node);
      const group: Group = tags?.group ?? 'screens';
      const deliverableId = tags?.deliverable ?? '';
      const bytes = await node.exportAsync({
        format: formatFor(deliverableId),
        constraint: { type: 'SCALE', value: 1 },
      });
      await onFile({ nodeId, path: filePathFor(name, group, deliverableId), bytes }, i + 1, total);
      written++;
    } catch (err) {
      failures.push({ nodeId, name, reason: err instanceof Error ? err.message : String(err) });
    }
  }

  return { written, failures };
}
