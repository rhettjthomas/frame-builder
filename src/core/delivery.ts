/**
 * Where each exported file lands inside the delivery package.
 *
 * The folder comes from the frame's `group` tag rather than from parsing its
 * name, so a frame renamed by hand still lands in the right place. The package
 * mirrors the structure already used for client delivery, so the folder a church
 * team member needs is the one they already know.
 */
import { findDeliverable, type Format, type Group } from './deliverables';

export const FOLDERS: Record<Group, string> = {
  screens: 'SCREENS',
  social: 'SOCIAL MEDIA',
  web: 'WEB',
};

/**
 * Created empty so the rest of the package has a home, and nothing has to be
 * made by hand after the fact.
 */
export const EMPTY_FOLDERS = ['VIDEOS', 'PROPRESENTER'] as const;

/** Lower Thirds export PNG for transparency; everything else is photographic. */
export function formatFor(deliverableId: string): Format {
  return findDeliverable(deliverableId)?.format ?? 'JPG';
}

export function extensionFor(format: Format): string {
  return format === 'PNG' ? '.png' : '.jpg';
}

/** Figma allows characters in a layer name that a file system will not. */
export function safeFileName(name: string): string {
  const cleaned = name
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '');
  return cleaned || 'Untitled';
}

/** The series folder at the top of the package, e.g. `HOPE HAS A NAME`. */
export function packageFolder(seriesLabel: string): string {
  return safeFileName(seriesLabel.toUpperCase());
}

/** Path inside the package, e.g. `SOCIAL MEDIA/Hope Has a Name_Story 01.jpg`. */
export function filePathFor(name: string, group: Group, deliverableId: string): string {
  const format = formatFor(deliverableId);
  return `${FOLDERS[group]}/${safeFileName(name)}${extensionFor(format)}`;
}
