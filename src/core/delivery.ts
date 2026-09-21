/**
 * How a built frame is set up to leave Figma.
 *
 * A plugin can't write to a folder you choose, so Frame Builder doesn't export at
 * all. It sets each frame up so Figma's own export does the right thing: the
 * correct format already selected, and optionally a folder prefix on the name,
 * because Figma turns a slash in a layer name into a subfolder when several
 * layers are exported at once.
 */
import type { Folder, Format } from './deliverables';

/** The folders the shipped library delivers into. */
export const SHIPPED_FOLDERS = ['SCREENS', 'SOCIAL MEDIA', 'WEB'] as const;

export function extensionFor(format: Format): string {
  return format === 'PNG' ? '.png' : '.jpg';
}

/**
 * Figma allows characters in a folder name that a file system will not. A name
 * made only of those characters cleans down to punctuation, which is a worse
 * folder than an honest fallback, so it gets the fallback too.
 */
export function safeFolder(name: string): Folder {
  const cleaned = name
    .replace(/[\/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\.+$/, '')
    .toUpperCase();
  return /[A-Z0-9]/.test(cleaned) ? cleaned : 'EXTRAS';
}
