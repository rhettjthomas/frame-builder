import { describe, expect, it } from 'vitest';
import { extensionFor, safeFolder, SHIPPED_FOLDERS } from '../src/core/delivery';
import { DELIVERABLES, findDeliverable } from '../src/core/deliverables';

describe('shipped folders', () => {
  it('are the three the delivery package uses', () => {
    expect([...SHIPPED_FOLDERS]).toEqual(['SCREENS', 'SOCIAL MEDIA', 'WEB']);
  });

  it('cover every folder the shipped library delivers into', () => {
    for (const d of DELIVERABLES) {
      expect(SHIPPED_FOLDERS as readonly string[], d.id).toContain(d.folder);
    }
  });
});

describe('extensions', () => {
  it('matches the format', () => {
    expect(extensionFor('PNG')).toBe('.png');
    expect(extensionFor('JPG')).toBe('.jpg');
  });

  it('gives Lower Thirds a png, for the transparency', () => {
    expect(extensionFor(findDeliverable('lower-third')!.format)).toBe('.png');
  });

  it('gives photographic deliverables a jpg', () => {
    expect(extensionFor(findDeliverable('hero-4k')!.format)).toBe('.jpg');
  });
});

describe('safeFolder', () => {
  it('upper-cases a group name into a folder', () => {
    expect(safeFolder('Print')).toBe('PRINT');
    expect(safeFolder('Social Media')).toBe('SOCIAL MEDIA');
  });

  it('replaces characters a file system will not take', () => {
    expect(safeFolder('Kids/Students')).toBe('KIDS-STUDENTS');
    expect(safeFolder('Q1: Launch')).toBe('Q1- LAUNCH');
  });

  it('trims trailing dots, which Windows refuses', () => {
    expect(safeFolder('Extras...')).toBe('EXTRAS');
  });

  it('collapses runs of whitespace', () => {
    expect(safeFolder('  Lobby   Signage  ')).toBe('LOBBY SIGNAGE');
  });

  it('never returns an empty folder name', () => {
    expect(safeFolder('   ')).toBe('EXTRAS');
    expect(safeFolder('///')).toBe('EXTRAS');
  });
});
