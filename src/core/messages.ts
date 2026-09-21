import type { BuildState } from './state';

/** One deliverable the user asked to build. The main thread resolves sizes from the library. */
export interface BuildItem {
  deliverableId: string;
  quantity: number;
}

/** UI iframe → main thread. */
export type UIToMain =
  | { type: 'ui-ready' }
  | { type: 'save-state'; state: BuildState }
  | { type: 'build'; seriesName: string; seriesId: string; items: BuildItem[] };

/** Main thread → UI iframe. */
export type MainToUI =
  | { type: 'init'; state: BuildState; version: string }
  | { type: 'status'; message: string }
  | { type: 'error'; message: string };

/** Plugin data keys stamped on every frame the builder creates. */
export const TAG = {
  seriesId: 'frame-builder/seriesId',
  deliverable: 'frame-builder/deliverable',
  group: 'frame-builder/group',
  builderVersion: 'frame-builder/builderVersion',
  role: 'frame-builder/role',
} as const;
