import { DELIVERABLES, type Deliverable } from './deliverables';

export interface Preset {
  id: string;
  name: string;
  /** Deliverable ids to check. 'all' checks every shipped deliverable. */
  include: 'all' | readonly string[];
  /** Quantity overrides. Anything omitted uses the deliverable's own default. */
  quantities?: Readonly<Record<string, number>>;
}

export const SHIPPED_PRESETS: readonly Preset[] = [
  {
    id: 'sermon-series',
    name: 'Sermon Series',
    include: 'all',
  },
  {
    // Listed out rather than derived from a section, so a deliverable added to
    // the library later has to be opted in here deliberately.
    id: 'event-launch',
    name: 'Event Launch',
    include: ['hero-4k', 'lower-third', 'square', 'post', 'post-bg', 'story', 'story-bg', 'web', 'carousel'],
    quantities: { 'lower-third': 1 },
  },
  {
    id: 'custom',
    name: 'Custom',
    include: [],
  },
];

export const DEFAULT_PRESET_ID = 'sermon-series';

export function findPreset(id: string): Preset | undefined {
  return SHIPPED_PRESETS.find((p) => p.id === id);
}

/** Whether a preset checks a given deliverable. */
export function presetIncludes(preset: Preset, d: Deliverable): boolean {
  return preset.include === 'all' || preset.include.indexOf(d.id) !== -1;
}

/** The quantity a preset wants for a deliverable, before clamping. */
export function presetQuantity(preset: Preset, d: Deliverable): number {
  const override = preset.quantities?.[d.id];
  if (typeof override === 'number') return override;
  return d.quantity ? d.quantity.default : 1;
}

/** Every deliverable id the shipped library knows about. */
export const ALL_DELIVERABLE_IDS = DELIVERABLES.map((d) => d.id);
