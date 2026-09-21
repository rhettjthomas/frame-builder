import { describe, expect, it } from 'vitest';
import { preparePackage, writeFile, type DirectoryHandle } from '../src/ui/folder';

/** Stands in for a picked folder, recording what the plugin creates in it. */
class FakeDir implements DirectoryHandle {
  readonly dirs = new Map<string, FakeDir>();
  readonly files = new Map<string, Uint8Array>();
  constructor(readonly name = 'root') {}

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle> {
    let dir = this.dirs.get(name);
    if (!dir) {
      if (!options?.create) throw new Error(`No such directory: ${name}`);
      dir = new FakeDir(name);
      this.dirs.set(name, dir);
    }
    return dir;
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.files.has(name) && !options?.create) throw new Error(`No such file: ${name}`);
    const files = this.files;
    return {
      createWritable: async () => {
        const chunks: Uint8Array[] = [];
        return {
          write: async (data: BufferSource) => {
            chunks.push(new Uint8Array(data instanceof ArrayBuffer ? data : data.buffer));
          },
          close: async () => {
            files.set(name, chunks[0] ?? new Uint8Array());
          },
        };
      },
    };
  }

  /** Every path in this tree, for comparing against the delivery structure. */
  paths(prefix = ''): string[] {
    const out: string[] = [];
    for (const [name, dir] of this.dirs) {
      out.push(`${prefix}${name}/`);
      out.push(...dir.paths(`${prefix}${name}/`));
    }
    for (const name of this.files.keys()) out.push(`${prefix}${name}`);
    return out.sort();
  }
}

describe('preparePackage', () => {
  it('creates the whole delivery structure up front', async () => {
    const root = new FakeDir();
    await preparePackage(root, 'Hope Has a Name');
    expect(root.paths()).toEqual([
      'HOPE HAS A NAME/',
      'HOPE HAS A NAME/PROPRESENTER/',
      'HOPE HAS A NAME/SCREENS/',
      'HOPE HAS A NAME/SOCIAL MEDIA/',
      'HOPE HAS A NAME/VIDEOS/',
      'HOPE HAS A NAME/WEB/',
    ]);
  });

  it('includes VIDEOS and PROPRESENTER as real empty folders, not placeholders', async () => {
    const root = new FakeDir();
    const pkg = (await preparePackage(root, 'Advent')) as FakeDir;
    expect(pkg.dirs.get('VIDEOS')!.files.size).toBe(0);
    expect(pkg.dirs.get('PROPRESENTER')!.files.size).toBe(0);
  });

  it('reuses the package folder rather than failing on a second export', async () => {
    const root = new FakeDir();
    await preparePackage(root, 'Hope Has a Name');
    await preparePackage(root, 'Hope Has a Name');
    expect(root.dirs.size).toBe(1);
  });
});

describe('writeFile', () => {
  it('writes into the folder the path names', async () => {
    const root = new FakeDir();
    const pkg = (await preparePackage(root, 'Hope Has a Name')) as FakeDir;
    await writeFile(pkg, 'SOCIAL MEDIA/Hope Has a Name_Story 01.jpg', new Uint8Array([1, 2, 3]));
    const social = pkg.dirs.get('SOCIAL MEDIA')!;
    expect([...social.files.keys()]).toEqual(['Hope Has a Name_Story 01.jpg']);
    expect([...social.files.get('Hope Has a Name_Story 01.jpg')!]).toEqual([1, 2, 3]);
  });

  it('puts a Lower Third png in SCREENS alongside the jpgs', async () => {
    const root = new FakeDir();
    const pkg = (await preparePackage(root, 'Hope')) as FakeDir;
    await writeFile(pkg, 'SCREENS/Hope_Hero 4K 01.jpg', new Uint8Array([1]));
    await writeFile(pkg, 'SCREENS/Hope_Lower Third 01.png', new Uint8Array([2]));
    expect([...pkg.dirs.get('SCREENS')!.files.keys()].sort()).toEqual([
      'Hope_Hero 4K 01.jpg',
      'Hope_Lower Third 01.png',
    ]);
  });

  it('creates a folder the package did not already have', async () => {
    const root = new FakeDir();
    const pkg = (await preparePackage(root, 'Hope')) as FakeDir;
    await writeFile(pkg, 'EXTRAS/note.jpg', new Uint8Array([9]));
    expect(pkg.dirs.has('EXTRAS')).toBe(true);
  });

  it('overwrites a file from an earlier export rather than erroring', async () => {
    const root = new FakeDir();
    const pkg = (await preparePackage(root, 'Hope')) as FakeDir;
    await writeFile(pkg, 'WEB/Hope_Web 01.jpg', new Uint8Array([1]));
    await writeFile(pkg, 'WEB/Hope_Web 01.jpg', new Uint8Array([2]));
    expect([...pkg.dirs.get('WEB')!.files.get('Hope_Web 01.jpg')!]).toEqual([2]);
  });
});
