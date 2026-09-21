import { describe, expect, it } from 'vitest';
import { countFrames, groupForConfirm, type FoundFrame } from '../src/core/confirm';

function frame(name: string, deliverableId: string, adopted = false): FoundFrame {
  return {
    nodeId: `id-${name}`,
    name,
    deliverableId,
    group: 'social',
    pageName: 'Page 1',
    adopted,
  };
}

describe('groupForConfirm', () => {
  it('groups by deliverable type so a stray duplicate shows as a count', () => {
    const groups = groupForConfirm([
      frame('Hope_Story_01', 'story'),
      frame('Hope_Story_02', 'story'),
      frame('Hope_Square_01', 'square'),
    ]);
    expect(groups.map((g) => [g.label, g.frames.length])).toEqual([
      ['Square', 1],
      ['Story', 2],
    ]);
  });

  it('orders groups the way the library lists them, not by when they were found', () => {
    const groups = groupForConfirm([
      frame('a', 'carousel'),
      frame('b', 'hero-4k'),
      frame('c', 'story'),
    ]);
    expect(groups.map((g) => g.deliverableId)).toEqual(['hero-4k', 'story', 'carousel']);
  });

  it('keeps a deliverable the library has forgotten, rather than dropping it', () => {
    const groups = groupForConfirm([frame('old', 'retired-size'), frame('new', 'story')]);
    expect(groups.map((g) => g.deliverableId)).toEqual(['story', 'retired-size']);
    expect(groups[1].label).toContain('no longer in the library');
  });

  it('sorts untagged frames adopted from the section to the very end', () => {
    const groups = groupForConfirm([
      frame('hand-built', '', true),
      frame('old', 'retired-size'),
      frame('Hope_Story_01', 'story'),
    ]);
    expect(groups.map((g) => g.deliverableId)).toEqual(['story', 'retired-size', '']);
    expect(groups[2].label).toBe('In the section, untagged');
  });

  it('plans nothing for an empty file', () => {
    expect(groupForConfirm([])).toEqual([]);
  });
});

describe('countFrames', () => {
  it('adds up across groups', () => {
    const groups = groupForConfirm([
      frame('a', 'story'),
      frame('b', 'story'),
      frame('c', 'square'),
      frame('d', '', true),
    ]);
    expect(countFrames(groups)).toBe(4);
  });

  it('counts nothing when nothing was found', () => {
    expect(countFrames([])).toBe(0);
  });
});
