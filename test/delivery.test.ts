import { describe, expect, it } from 'vitest';
import { extensionFor, folderFor, FOLDERS } from '../src/core/delivery';
import { DELIVERABLES, findDeliverable } from '../src/core/deliverables';

describe('folders', () => {
  it('has one for every export group', () => {
    expect(Object.values(FOLDERS).sort()).toEqual(['SCREENS', 'SOCIAL MEDIA', 'WEB']);
  });

  it('names the folder each group delivers into', () => {
    expect(folderFor('screens')).toBe('SCREENS');
    expect(folderFor('social')).toBe('SOCIAL MEDIA');
    expect(folderFor('web')).toBe('WEB');
  });

  it('covers every group the library actually uses', () => {
    for (const d of DELIVERABLES) expect(folderFor(d.group), d.id).toBeTruthy();
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
