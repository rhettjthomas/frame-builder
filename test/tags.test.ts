import { describe, expect, it } from 'vitest';
import { belongsTo, clearTags, readTags, stampTags, TAG, type TaggableNode } from '../src/core/tags';

/** Stands in for a Figma node's plugin data, including the duplication rule. */
class FakeNode implements TaggableNode {
  constructor(private data: Record<string, string> = {}) {}
  getPluginData(key: string): string {
    return this.data[key] ?? '';
  }
  setPluginData(key: string, value: string): void {
    this.data[key] = value;
  }
  /** Figma copies plugin data onto a duplicate. That is the whole design. */
  duplicate(): FakeNode {
    return new FakeNode({ ...this.data });
  }
}

const TAGS = {
  seriesId: 'hope-has-a-name',
  deliverable: 'story',
  folder: 'SOCIAL MEDIA',
  builderVersion: '0.3.0',
} as const;

describe('stampTags and readTags', () => {
  it('round-trips', () => {
    const node = new FakeNode();
    stampTags(node, TAGS);
    expect(readTags(node)).toEqual(TAGS);
  });

  it('reads nothing off an untouched node', () => {
    expect(readTags(new FakeNode())).toBeNull();
  });

  it('treats a node with no seriesId as not ours, whatever else it carries', () => {
    const node = new FakeNode();
    node.setPluginData(TAG.deliverable, 'story');
    node.setPluginData(TAG.group, 'social');
    expect(readTags(node)).toBeNull();
  });

  it('keeps a folder it does not recognise, since folders are open-ended now', () => {
    const node = new FakeNode();
    stampTags(node, TAGS);
    node.setPluginData(TAG.group, 'PRINT');
    expect(readTags(node)!.folder).toBe('PRINT');
  });

  it('reads a pre-0.9.0 lowercase group as the folder it meant', () => {
    const node = new FakeNode();
    stampTags(node, TAGS);
    node.setPluginData(TAG.group, 'social');
    expect(readTags(node)!.folder).toBe('SOCIAL MEDIA');
    node.setPluginData(TAG.group, 'web');
    expect(readTags(node)!.folder).toBe('WEB');
  });

  it('falls back to a real folder when there is none stored at all', () => {
    const node = new FakeNode();
    stampTags(node, TAGS);
    node.setPluginData(TAG.group, '');
    expect(readTags(node)!.folder).toBe('SCREENS');
  });
});

describe('duplication', () => {
  it('carries the tags onto a duplicate, which is the point', () => {
    const original = new FakeNode();
    stampTags(original, TAGS);
    expect(readTags(original.duplicate())).toEqual(TAGS);
  });

  it('leaves a duplicate belonging to the same series', () => {
    const original = new FakeNode();
    stampTags(original, TAGS);
    expect(belongsTo(original.duplicate(), 'hope-has-a-name')).toBe(true);
  });

  it('does not answer for a different series', () => {
    const node = new FakeNode();
    stampTags(node, TAGS);
    expect(belongsTo(node, 'advent')).toBe(false);
  });
});

describe('clearTags', () => {
  it('drops a frame out of its series', () => {
    const node = new FakeNode();
    stampTags(node, TAGS);
    clearTags(node);
    expect(readTags(node)).toBeNull();
    expect(belongsTo(node, 'hope-has-a-name')).toBe(false);
  });

  it('clears every key, leaving nothing to be read back later', () => {
    const node = new FakeNode();
    stampTags(node, TAGS);
    clearTags(node);
    for (const key of Object.values(TAG)) expect(node.getPluginData(key), key).toBe('');
  });
});
