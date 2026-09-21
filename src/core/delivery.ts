/**
 * How a built frame is set up to leave Figma.
 *
 * A plugin can't write to a folder you choose, so Frame Builder doesn't try to
 * export at all. It sets each frame up so Figma's own export does the right
 * thing: the correct format already selected, and optionally a folder prefix on
 * the name, because Figma turns a slash in a layer name into a subfolder when
 * several layers are exported at once.
 */
import { type Format, type Group } from './deliverables';

export const FOLDERS: Record<Group, string> = {
  screens: 'SCREENS',
  social: 'SOCIAL MEDIA',
  web: 'WEB',
};

/** The folder a deliverable's frames belong in, for the optional name prefix. */
export function folderFor(group: Group): string {
  return FOLDERS[group];
}

export function extensionFor(format: Format): string {
  return format === 'PNG' ? '.png' : '.jpg';
}
