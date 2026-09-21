/**
 * Every frame the builder creates carries its own proof of belonging.
 *
 * Figma copies plugin data when a node is duplicated, so a frame duplicated by
 * hand weeks later still answers for itself. A saved list of node ids would be a
 * guest list at the door: anyone who arrives later isn't on it. These tags are a
 * wristband.
 *
 * Written against a minimal node shape rather than SceneNode so the rules can be
 * tested without a document.
 */
import type { Folder } from './deliverables';

export const TAG = {
  seriesId: 'frame-builder/seriesId',
  deliverable: 'frame-builder/deliverable',
  group: 'frame-builder/group',
  builderVersion: 'frame-builder/builderVersion',
} as const;

/** The part of a Figma node these helpers need. */
export interface TaggableNode {
  getPluginData(key: string): string;
  setPluginData(key: string, value: string): void;
}

export interface SeriesTags {
  seriesId: string;
  deliverable: string;
  /** Delivery folder, as it should appear on disk. */
  folder: Folder;
  builderVersion: string;
}

/**
 * Frames built before v0.9.0 stored a lowercase group name rather than the
 * folder itself. Read those as the folder they meant, so an old file still
 * answers correctly.
 */
const LEGACY_GROUPS: Record<string, Folder> = {
  screens: 'SCREENS',
  social: 'SOCIAL MEDIA',
  web: 'WEB',
};

export function stampTags(node: TaggableNode, tags: SeriesTags): void {
  node.setPluginData(TAG.seriesId, tags.seriesId);
  node.setPluginData(TAG.deliverable, tags.deliverable);
  node.setPluginData(TAG.group, tags.folder);
  node.setPluginData(TAG.builderVersion, tags.builderVersion);
}

/**
 * The tags on a node, or null when it isn't one of ours. A frame with no
 * seriesId never belongs to a series, whatever else it carries.
 */
export function readTags(node: TaggableNode): SeriesTags | null {
  const seriesId = node.getPluginData(TAG.seriesId);
  if (!seriesId) return null;
  const stored = node.getPluginData(TAG.group);
  // A frame with no readable folder still has to land somewhere.
  const folder = LEGACY_GROUPS[stored] ?? stored ?? '';
  return {
    seriesId,
    deliverable: node.getPluginData(TAG.deliverable),
    folder: folder || 'SCREENS',
    builderVersion: node.getPluginData(TAG.builderVersion),
  };
}

/** Drop a frame out of its series, for art repurposed elsewhere. */
export function clearTags(node: TaggableNode): void {
  for (const key of Object.values(TAG)) node.setPluginData(key, '');
}

/** Whether a node claims to belong to this series. */
export function belongsTo(node: TaggableNode, seriesId: string): boolean {
  return node.getPluginData(TAG.seriesId) === seriesId;
}
