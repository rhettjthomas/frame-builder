/**
 * Writing the package into a folder the user picks.
 *
 * A Figma plugin normally can't reach the file system: the UI is a sandboxed
 * iframe and the only sanctioned way out is a flat browser download. The File
 * System Access API is the one exception, and it may be refused in Figma's
 * sandbox, so every call here is guarded and the reason is reported in words
 * rather than swallowed.
 */
import { EMPTY_FOLDERS, FOLDERS, packageFolder } from '../core/delivery';

/** Minimal shape of the parts of the File System Access API this uses. */
export interface DirectoryHandle {
  name: string;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle>;
}
export interface FileHandle {
  createWritable(): Promise<{ write(data: BufferSource): Promise<void>; close(): Promise<void> }>;
}
type PickerWindow = Window & {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<DirectoryHandle>;
};

export class FolderUnavailable extends Error {}
export class FolderCancelled extends Error {}

/** Whether this runtime exposes the API at all. Calling it may still be refused. */
export function folderPickerExists(): boolean {
  return typeof (window as PickerWindow).showDirectoryPicker === 'function';
}

/**
 * Ask for a destination folder. Must be called straight off a click: the picker
 * needs user activation and will refuse a call made later.
 */
export async function pickFolder(): Promise<DirectoryHandle> {
  const picker = (window as PickerWindow).showDirectoryPicker;
  if (!picker) {
    throw new FolderUnavailable('This Figma build does not allow a plugin to choose a folder.');
  }
  try {
    return await picker({ mode: 'readwrite' });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    if (name === 'AbortError') throw new FolderCancelled('No folder chosen.');
    // SecurityError and NotAllowedError are the sandbox refusing, not the user.
    throw new FolderUnavailable(
      err instanceof Error ? err.message : 'Figma refused access to the file system.',
    );
  }
}

/**
 * The package root inside the chosen folder, with every delivery folder created
 * up front. The empty ones are real directories rather than a placeholder file,
 * which is the one thing writing to a real folder does better than a ZIP.
 */
export async function preparePackage(
  root: DirectoryHandle,
  seriesLabel: string,
): Promise<DirectoryHandle> {
  const pkg = await root.getDirectoryHandle(packageFolder(seriesLabel), { create: true });
  for (const folder of [...Object.values(FOLDERS), ...EMPTY_FOLDERS]) {
    await pkg.getDirectoryHandle(folder, { create: true });
  }
  return pkg;
}

/** Write one file at a path like `SOCIAL MEDIA/Hope Has a Name_Story 01.jpg`. */
export async function writeFile(
  pkg: DirectoryHandle,
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  const parts = path.split('/');
  const fileName = parts.pop()!;
  let dir = pkg;
  for (const part of parts) dir = await dir.getDirectoryHandle(part, { create: true });
  const handle = await dir.getFileHandle(fileName, { create: true });
  const writable = await handle.createWritable();
  try {
    // Copy into a plain ArrayBuffer: the bytes arrive across postMessage and
    // some runtimes refuse to write a view backed by a transferred buffer.
    await writable.write(new Uint8Array(bytes).buffer);
  } finally {
    await writable.close();
  }
}
