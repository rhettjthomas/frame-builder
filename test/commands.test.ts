import { describe, expect, it } from 'vitest';
import { seriesFrom } from '../src/main/commands';
import { stampTags, type TaggableNode } from '../src/core/tags';

/** A node in a fake tree, enough for walking up to a tagged ancestor. */
class FakeNode implements TaggableNode {
  parent: FakeNode | null = null;
  private data: Record<string, string> = {};
  constructor(readonly type: string) {}

  getPluginData(key: string): string {
    return this.data[key] ?? '';
  }
  setPluginData(key: string, value: string): void {
    this.data[key] = value;
  }
  appendChild(child: FakeNode): FakeNode {
    child.parent = this;
    return child;
  }
}

function tagged(type: string, seriesId: string): FakeNode {
  const node = new FakeNode(type);
  stampTags(node, { seriesId, deliverable: 'story', group: 'social', builderVersion: '0.8.0' });
  return node;
}

/** seriesFrom walks BaseNode; the fake matches the shape it actually touches. */
const as = (node: FakeNode) => node as unknown as BaseNode;

describe('seriesFrom', () => {
  it('reads the tag off the node itself', () => {
    expect(seriesFrom(as(tagged('FRAME', 'hope-has-a-name')))).toBe('hope-has-a-name');
  });

  it('finds the series from the section a hand-built frame sits in', () => {
    const section = tagged('SECTION', 'hope-has-a-name');
    const handBuilt = section.appendChild(new FakeNode('FRAME'));
    expect(seriesFrom(as(handBuilt))).toBe('hope-has-a-name');
  });

  it('walks up through nesting, not just one level', () => {
    const section = tagged('SECTION', 'advent');
    const group = section.appendChild(new FakeNode('GROUP'));
    const nested = group.appendChild(new FakeNode('FRAME'));
    expect(seriesFrom(as(nested))).toBe('advent');
  });

  it('prefers the frame own tag over the section it happens to be in', () => {
    const section = tagged('SECTION', 'advent');
    const frame = tagged('FRAME', 'hope-has-a-name');
    section.appendChild(frame);
    expect(seriesFrom(as(frame))).toBe('hope-has-a-name');
  });

  it('answers nothing for a frame that belongs to no series', () => {
    const page = new FakeNode('PAGE');
    const loose = page.appendChild(new FakeNode('FRAME'));
    expect(seriesFrom(as(loose))).toBeNull();
  });

  it('stops at the page rather than walking into the document', () => {
    const page = tagged('PAGE', 'should-not-be-read');
    const frame = page.appendChild(new FakeNode('FRAME'));
    expect(seriesFrom(as(frame))).toBeNull();
  });

  it('answers nothing for an untagged node with no parent', () => {
    expect(seriesFrom(as(new FakeNode('FRAME')))).toBeNull();
  });
});
