/**
 * Turning what was found in the file into the list the user confirms before
 * exporting. Kept out of the main thread so the grouping rules can be tested.
 */
import { DELIVERABLES, findDeliverable, type Group } from './deliverables';

export interface FoundFrame {
  nodeId: string;
  name: string;
  /** Empty when the frame was found inside the section but carries no tags. */
  deliverableId: string;
  group: Group;
  pageName: string;
  /** Found by sitting inside the series section rather than by its own tag. */
  adopted: boolean;
}

export interface FoundSeries {
  seriesId: string;
  /** The section's name where there is one, otherwise the id itself. */
  label: string;
  frames: FoundFrame[];
}

export interface ConfirmGroup {
  deliverableId: string;
  label: string;
  frames: FoundFrame[];
}

const ORDER = new Map(DELIVERABLES.map((d, i) => [d.id, i]));

/**
 * Group by deliverable type so an accidental duplicate shows up as a count
 * rather than quietly becoming an extra file. Anything the library no longer
 * recognises, and anything adopted from inside the section, sorts to the end
 * instead of being dropped.
 */
export function groupForConfirm(frames: readonly FoundFrame[]): ConfirmGroup[] {
  const groups = new Map<string, ConfirmGroup>();
  for (const frame of frames) {
    const key = frame.deliverableId || '';
    let group = groups.get(key);
    if (!group) {
      group = { deliverableId: key, label: labelFor(key), frames: [] };
      groups.set(key, group);
    }
    group.frames.push(frame);
  }
  return [...groups.values()].sort((a, b) => rank(a.deliverableId) - rank(b.deliverableId));
}

function labelFor(deliverableId: string): string {
  if (!deliverableId) return 'In the section, untagged';
  return findDeliverable(deliverableId)?.name ?? `${deliverableId} (no longer in the library)`;
}

function rank(deliverableId: string): number {
  const known = ORDER.get(deliverableId);
  if (known !== undefined) return known;
  // Unknown types, then untagged, after everything the library still knows.
  return deliverableId ? DELIVERABLES.length : DELIVERABLES.length + 1;
}

/** Total frames across every group, for the footer count. */
export function countFrames(groups: readonly ConfirmGroup[]): number {
  return groups.reduce((sum, g) => sum + g.frames.length, 0);
}

/**
 * Frame names that appear more than once among the frames being exported.
 *
 * Nothing guarantees unique names now that the exporter doesn't rename anything,
 * and two frames with the same name would quietly overwrite each other inside the
 * ZIP. Surfacing the clash in the confirm list lets it be fixed in the file,
 * where the user chose the name, rather than being papered over at export.
 */
export function collidingNames(frames: readonly FoundFrame[]): Set<string> {
  const counts = new Map<string, number>();
  for (const frame of frames) counts.set(frame.name, (counts.get(frame.name) ?? 0) + 1);
  const clashes = new Set<string>();
  for (const [name, count] of counts) if (count > 1) clashes.add(name);
  return clashes;
}
