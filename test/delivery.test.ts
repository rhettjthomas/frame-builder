import { describe, expect, it } from 'vitest';
import {
  EMPTY_FOLDERS,
  extensionFor,
  filePathFor,
  FOLDERS,
  formatFor,
  packageFolder,
  safeFileName,
} from '../src/core/delivery';

describe('formatFor', () => {
  it('sends Lower Thirds out as PNG, for the transparency', () => {
    expect(formatFor('lower-third')).toBe('PNG');
  });

  it('sends photographic deliverables out as JPG', () => {
    expect(formatFor('hero-4k')).toBe('JPG');
    expect(formatFor('story')).toBe('JPG');
  });

  it('falls back to JPG for a frame carrying no deliverable tag', () => {
    expect(formatFor('')).toBe('JPG');
    expect(formatFor('retired-size')).toBe('JPG');
  });

  it('matches the extension to the format', () => {
    expect(extensionFor('PNG')).toBe('.png');
    expect(extensionFor('JPG')).toBe('.jpg');
  });
});

describe('filePathFor', () => {
  it('routes by the group tag, not by reading the name', () => {
    expect(filePathFor('Hope Has a Name_Story 01', 'social', 'story')).toBe(
      'SOCIAL MEDIA/Hope Has a Name_Story 01.jpg',
    );
    expect(filePathFor('Hope Has a Name_Web 01', 'web', 'web')).toBe(
      'WEB/Hope Has a Name_Web 01.jpg',
    );
  });

  it('keeps a hand-renamed frame in its tagged folder', () => {
    expect(filePathFor('Pastor approved this one', 'screens', 'hero-4k')).toBe(
      'SCREENS/Pastor approved this one.jpg',
    );
  });

  it('gives a Lower Third a png in SCREENS', () => {
    expect(filePathFor('Hope_Lower Third 01', 'screens', 'lower-third')).toBe(
      'SCREENS/Hope_Lower Third 01.png',
    );
  });
});

describe('safeFileName', () => {
  it('leaves an ordinary name alone', () => {
    expect(safeFileName('Hope Has a Name_Story 01')).toBe('Hope Has a Name_Story 01');
  });

  it('replaces characters a file system will not take', () => {
    expect(safeFileName('Advent: Light/Life?')).toBe('Advent- Light-Life-');
  });

  it('trims trailing dots, which Windows refuses', () => {
    expect(safeFileName('Series name...')).toBe('Series name');
  });

  it('collapses runs of whitespace', () => {
    expect(safeFileName('Hope   Has   a Name')).toBe('Hope Has a Name');
  });

  it('never returns an empty name', () => {
    expect(safeFileName('   ')).toBe('Untitled');
    expect(safeFileName('...')).toBe('Untitled');
  });
});

describe('the package', () => {
  it('names the top folder after the series, in caps', () => {
    expect(packageFolder('Hope Has a Name')).toBe('HOPE HAS A NAME');
  });

  it('keeps a slash out of the folder name', () => {
    expect(packageFolder('Faith/Works')).toBe('FAITH-WORKS');
  });

  it('has a folder for every export group', () => {
    expect(Object.values(FOLDERS).sort()).toEqual(['SCREENS', 'SOCIAL MEDIA', 'WEB']);
  });

  it('creates the folders the rest of the package needs', () => {
    expect([...EMPTY_FOLDERS]).toEqual(['VIDEOS', 'PROPRESENTER']);
  });
});
